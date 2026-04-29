import { getCommsPool } from "../lib/migrations.js";
import { logger } from "../lib/logger.js";
import { getCommsSettings, flagOn } from "./commsCredentials.js";
import { hashPhone, normalizePhone } from "./phoneHash.js";
import { sendWhatsAppViaZavu } from "./zavuService.js";
import {
  sendSmsViaExotel,
  sendWhatsAppViaExotel,
  connectCallViaExotel,
  disconnectExotelCall,
} from "./exotelService.js";
import { consumeRateBucket } from "./rateLimitDb.js";

/* ─────────────────────── Tariffs / cost ─────────────────────── */

async function tariffPaise(channel: "whatsapp" | "sms" | "call"): Promise<number> {
  const s = await getCommsSettings();
  if (channel === "whatsapp") return Number(s.comms_tariff_whatsapp_paise) || 0;
  if (channel === "sms") return Number(s.comms_tariff_sms_paise) || 0;
  return Number(s.comms_tariff_call_paise_per_min) || 0;
}

export async function getTodayCostPaise(): Promise<number> {
  const pool = getCommsPool();
  const { rows } = await pool.query<{ total: string | null }>(
    `SELECT
       COALESCE((SELECT SUM(cost_paise) FROM message_logs WHERE created_at::date = (now() at time zone 'utc')::date), 0) +
       COALESCE((SELECT SUM(cost_paise) FROM call_logs    WHERE created_at::date = (now() at time zone 'utc')::date), 0)
       AS total`,
  );
  return Number(rows[0]?.total ?? 0);
}

async function isOverDailyCap(): Promise<boolean> {
  const s = await getCommsSettings();
  const cap = Number(s.comms_cost_cap_inr_per_day) || 0;
  if (!cap) return false;
  const todayPaise = await getTodayCostPaise();
  return todayPaise >= cap * 100;
}

/** Total comms spend for the current calendar month, in paise. */
export async function getMonthCostPaise(): Promise<number> {
  const pool = getCommsPool();
  const { rows } = await pool.query<{ total: string | null }>(
    `SELECT
       COALESCE((SELECT SUM(cost_paise) FROM message_logs
                  WHERE date_trunc('month', created_at) = date_trunc('month', now())), 0) +
       COALESCE((SELECT SUM(cost_paise) FROM call_logs
                  WHERE date_trunc('month', created_at) = date_trunc('month', now())), 0)
       AS total`,
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Per-spec monthly budget gate. Returns:
 *   - "ok"        — spend below budget (or budget = 0 = unlimited)
 *   - "calls_only" — over budget; only masked calls should be blocked
 *   - "all_comms" — over budget; block every channel
 */
export async function monthlyBudgetState(): Promise<"ok" | "calls_only" | "all_comms"> {
  const s = await getCommsSettings();
  const budget = Number(s.monthly_budget_paise) || 0;
  if (!budget) return "ok";
  const spent = await getMonthCostPaise();
  if (spent < budget) return "ok";
  return s.over_budget_behavior === "all_comms" ? "all_comms" : "calls_only";
}

/* ─────────────────────── Logging helpers ─────────────────────── */

interface LogMessageArgs {
  contactRequestId?: string | null;
  qrId?: string | null;
  recipientPhone: string;
  channel: "whatsapp" | "sms";
  provider: "zavu" | "exotel";
  providerMessageId: string | null;
  status: "queued" | "sent" | "failed" | "delivered";
  template?: string | null;
  payloadSummary?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  costPaise: number;
  fallbackFrom?: string | null;
}

export async function insertMessageLog(args: LogMessageArgs): Promise<string> {
  const pool = getCommsPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO message_logs
       (contact_request_id, qr_id, recipient_phone_hash, recipient_phone, channel, provider,
        provider_message_id, status, template, payload_summary,
        error_code, error_message, cost_paise, fallback_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      args.contactRequestId ?? null,
      args.qrId ?? null,
      hashPhone(args.recipientPhone),
      normalizePhone(args.recipientPhone) || null,
      args.channel,
      args.provider,
      args.providerMessageId,
      args.status,
      args.template ?? null,
      args.payloadSummary ?? null,
      args.errorCode ?? null,
      args.errorMessage ?? null,
      args.costPaise,
      args.fallbackFrom ?? null,
    ],
  );
  return rows[0].id;
}

interface LogCallArgs {
  contactRequestId?: string | null;
  qrId?: string | null;
  callerPhone: string;
  calleePhone: string;
  vehicleLast4?: string | null;
  provider: "exotel";
  providerCallId: string | null;
  status: "initiated" | "in_progress" | "completed" | "failed" | "disconnected";
  errorCode?: string | null;
  errorMessage?: string | null;
  costPaise: number;
}

export async function insertCallLog(args: LogCallArgs): Promise<string> {
  const pool = getCommsPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO call_logs
       (contact_request_id, qr_id, caller_phone_hash, callee_phone_hash, caller_phone, callee_phone,
        vehicle_last4, provider, provider_call_id, status, error_code, error_message, cost_paise, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, CASE WHEN $10 = 'initiated' THEN now() ELSE NULL END)
     RETURNING id`,
    [
      args.contactRequestId ?? null,
      args.qrId ?? null,
      hashPhone(args.callerPhone),
      hashPhone(args.calleePhone),
      normalizePhone(args.callerPhone) || null,
      normalizePhone(args.calleePhone) || null,
      args.vehicleLast4 ?? null,
      args.provider,
      args.providerCallId,
      args.status,
      args.errorCode ?? null,
      args.errorMessage ?? null,
      args.costPaise,
    ],
  );
  return rows[0].id;
}

/* ─────────────────────── Public sender APIs ─────────────────────── */

export type SendChannel = "whatsapp" | "sms";

export interface SendResult {
  ok: boolean;
  status: "queued" | "sent" | "failed";
  provider: "zavu" | "exotel" | null;
  providerMessageId: string | null;
  channelUsed: SendChannel | null;
  errorCode: string | null;
  errorMessage: string | null;
  logId: string | null;
}

interface SmartSendArgs {
  to: string;
  body: string;
  template?: { name: string; lang?: string; params?: string[] };
  contactRequestId?: string | null;
  qrId?: string | null;
}

/**
 * WhatsApp routing decision based on settings:
 *  - "zavu_first" → try Zavu, fall back to Exotel WhatsApp on failure.
 *  - "exotel_first" → try Exotel WhatsApp, fall back to Zavu.
 *  - "zavu" / "exotel" → only that provider, no fallback.
 *  - "off" → return a failed result.
 */
export async function sendWhatsAppSmart(args: SmartSendArgs): Promise<SendResult> {
  const s = await getCommsSettings();
  if (!flagOn(s, "whatsapp_enabled", "feature_whatsapp_enabled")) {
    return failed("whatsapp", "WHATSAPP_DISABLED", "WhatsApp is disabled in settings.");
  }
  if (await isOverDailyCap()) {
    return failed("whatsapp", "COST_CAP", "Daily comms cost cap reached.");
  }
  if ((await monthlyBudgetState()) === "all_comms") {
    return failed("whatsapp", "BUDGET_EXCEEDED", "Monthly communications budget reached.");
  }
  const route = (s.comms_routing_whatsapp ?? "zavu_first").toLowerCase();
  const order: Array<"zavu" | "exotel"> =
    route === "exotel_first" ? ["exotel", "zavu"] :
    route === "exotel" ? ["exotel"] :
    route === "zavu" ? ["zavu"] :
    route === "off" ? [] :
    ["zavu", "exotel"];
  if (order.length === 0) {
    return failed("whatsapp", "WHATSAPP_DISABLED", "WhatsApp routing is set to off.");
  }

  const tariff = await tariffPaise("whatsapp");
  let lastErr: { code: string | null; msg: string | null } = { code: null, msg: null };
  let fallbackFrom: string | null = null;

  for (const provider of order) {
    const r = provider === "zavu"
      ? await sendWhatsAppViaZavu({
          to: args.to,
          body: args.body,
          templateName: args.template?.name,
          templateLang: args.template?.lang,
          templateParams: args.template?.params,
        })
      : await sendWhatsAppViaExotel({ to: args.to, body: args.body });

    const logId = await insertMessageLog({
      contactRequestId: args.contactRequestId,
      qrId: args.qrId,
      recipientPhone: args.to,
      channel: "whatsapp",
      provider,
      providerMessageId: r.providerMessageId,
      status: r.ok ? "queued" : "failed",
      template: args.template?.name ?? null,
      payloadSummary: args.body.slice(0, 200),
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      costPaise: r.ok ? tariff : 0,
      fallbackFrom,
    }).catch((err) => {
      logger.error({ err }, "Failed to insert message_log");
      return null;
    });

    if (r.ok) {
      return {
        ok: true,
        status: "queued",
        provider,
        providerMessageId: r.providerMessageId,
        channelUsed: "whatsapp",
        errorCode: null,
        errorMessage: null,
        logId,
      };
    }
    lastErr = { code: r.errorCode, msg: r.errorMessage };
    fallbackFrom = provider;
  }
  return {
    ok: false,
    status: "failed",
    provider: null,
    providerMessageId: null,
    channelUsed: null,
    errorCode: lastErr.code,
    errorMessage: lastErr.msg,
    logId: null,
  };
}

export async function sendSmsSmart(args: SmartSendArgs): Promise<SendResult> {
  const s = await getCommsSettings();
  if (!flagOn(s, "sms_enabled", "feature_messages_enabled")) {
    return failed("sms", "SMS_DISABLED", "Messaging is disabled in settings.");
  }
  if ((s.comms_routing_sms ?? "exotel") === "off") {
    return failed("sms", "SMS_DISABLED", "SMS routing is off.");
  }
  if (await isOverDailyCap()) {
    return failed("sms", "COST_CAP", "Daily comms cost cap reached.");
  }
  if ((await monthlyBudgetState()) === "all_comms") {
    return failed("sms", "BUDGET_EXCEEDED", "Monthly communications budget reached.");
  }
  const tariff = await tariffPaise("sms");
  const r = await sendSmsViaExotel({ to: args.to, body: args.body });
  const logId = await insertMessageLog({
    contactRequestId: args.contactRequestId,
    qrId: args.qrId,
    recipientPhone: args.to,
    channel: "sms",
    provider: "exotel",
    providerMessageId: r.providerMessageId,
    status: r.ok ? "queued" : "failed",
    payloadSummary: args.body.slice(0, 200),
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    costPaise: r.ok ? tariff : 0,
  }).catch(() => null);

  if (r.ok) {
    return {
      ok: true, status: "queued", provider: "exotel",
      providerMessageId: r.providerMessageId, channelUsed: "sms",
      errorCode: null, errorMessage: null, logId,
    };
  }
  return {
    ok: false, status: "failed", provider: "exotel", providerMessageId: null,
    channelUsed: null, errorCode: r.errorCode, errorMessage: r.errorMessage, logId,
  };
}

/**
 * Send a *message* on the smartest channel available. Tries WhatsApp first
 * if enabled, then SMS as a final fallback. Used by the public scan flow
 * "Message owner" CTA.
 */
export async function sendMessageSmart(args: SmartSendArgs): Promise<SendResult> {
  const s = await getCommsSettings();
  const wa = flagOn(s, "whatsapp_enabled", "feature_whatsapp_enabled")
    && (s.comms_routing_whatsapp ?? "zavu_first") !== "off";
  if (wa) {
    const r = await sendWhatsAppSmart(args);
    if (r.ok) return r;
  }
  return sendSmsSmart(args);
}

/* ─────────────────────── Calls ─────────────────────── */

export async function placeMaskedCall(args: {
  callerPhone: string;
  calleePhone: string;
  contactRequestId?: string | null;
  qrId?: string | null;
}): Promise<{
  ok: boolean;
  callLogId: string | null;
  providerCallId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Hard cap, in seconds, the call will be allowed to last. */
  maxDurationSec: number;
}> {
  const s = await getCommsSettings();
  const maxDurationSec = Math.max(15, Math.min(Number(s.call_max_duration_sec) || 60, 600));
  if (!flagOn(s, "masked_call_enabled", "feature_calls_enabled")) {
    return { ok: false, callLogId: null, providerCallId: null, errorCode: "CALLS_DISABLED", errorMessage: "Masked calls are disabled.", maxDurationSec };
  }
  if ((s.comms_routing_call ?? "exotel") === "off") {
    return { ok: false, callLogId: null, providerCallId: null, errorCode: "CALLS_DISABLED", errorMessage: "Call routing is off.", maxDurationSec };
  }
  if (await isOverDailyCap()) {
    return { ok: false, callLogId: null, providerCallId: null, errorCode: "COST_CAP", errorMessage: "Daily comms cost cap reached.", maxDurationSec };
  }
  const monthState = await monthlyBudgetState();
  if (monthState !== "ok") {
    return { ok: false, callLogId: null, providerCallId: null, errorCode: "BUDGET_EXCEEDED", errorMessage: "Monthly communications budget reached.", maxDurationSec };
  }

  // Per-QR rate limit (spec: max calls per QR per hour, default 2) and
  // cooldown between calls on the same QR (default 60s). Persisted in
  // Postgres so the limits survive restarts.
  if (args.qrId) {
    const perHour = Math.max(1, Number(s.calls_per_qr_per_hour) || 2);
    const hourly = await consumeRateBucket({
      key: `qr_call_hourly:${args.qrId}`,
      limit: perHour,
      windowSeconds: 3600,
    });
    if (!hourly.allowed) {
      return {
        ok: false, callLogId: null, providerCallId: null,
        errorCode: "RATE_LIMIT_QR_HOURLY",
        errorMessage: `Too many calls for this tag (max ${perHour}/hour).`,
        maxDurationSec,
      };
    }
    const cooldownSec = Math.max(5, Number(s.call_cooldown_sec) || 60);
    const cooldown = await consumeRateBucket({
      key: `qr_call_cooldown:${args.qrId}`,
      limit: 1,
      windowSeconds: cooldownSec,
    });
    if (!cooldown.allowed) {
      return {
        ok: false, callLogId: null, providerCallId: null,
        errorCode: "RATE_LIMIT_QR_COOLDOWN",
        errorMessage: `Please wait ${cooldownSec}s before calling this tag again.`,
        maxDurationSec,
      };
    }
  }

  const r = await connectCallViaExotel({
    fromPhone: args.callerPhone,
    toPhone: args.calleePhone,
    maxDurationSec,
  });
  // Initial cost = 1 minute estimate; webhook will update with actual duration.
  const tariff = await tariffPaise("call");
  const logId = await insertCallLog({
    contactRequestId: args.contactRequestId,
    qrId: args.qrId,
    callerPhone: args.callerPhone,
    calleePhone: args.calleePhone,
    provider: "exotel",
    providerCallId: r.providerCallId,
    status: r.ok ? "initiated" : "failed",
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    costPaise: r.ok ? tariff : 0,
  }).catch(() => null);
  return {
    ok: r.ok,
    callLogId: logId,
    providerCallId: r.providerCallId,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    maxDurationSec,
  };
}

/* ─────────────────────── Pending disconnects ─────────────────────── */

/**
 * Persist a "please hang up at time T" intent so the call is forcibly
 * disconnected even if the server restarts before the timer fires. The
 * background flusher runs once at startup and then on a 30-sec interval.
 */
export async function schedulePendingDisconnect(args: {
  provider: "exotel";
  providerCallId: string;
  delaySeconds: number;
}): Promise<void> {
  const pool = getCommsPool();
  const scheduledAt = new Date(Date.now() + args.delaySeconds * 1000);
  await pool.query(
    `INSERT INTO pending_disconnects (provider, provider_call_id, scheduled_at) VALUES ($1, $2, $3)`,
    [args.provider, args.providerCallId, scheduledAt],
  );
}

let flushTimer: NodeJS.Timeout | null = null;

export function startPendingDisconnectFlusher(): void {
  if (flushTimer) return;
  const tick = async () => {
    try {
      const pool = getCommsPool();
      const { rows } = await pool.query<{ id: string; provider: string; provider_call_id: string }>(
        `SELECT id, provider, provider_call_id FROM pending_disconnects
          WHERE processed_at IS NULL AND scheduled_at <= now()
          LIMIT 50`,
      );
      for (const row of rows) {
        if (row.provider === "exotel") {
          await disconnectExotelCall(row.provider_call_id).catch(() => null);
        }
        await pool.query(`UPDATE pending_disconnects SET processed_at = now() WHERE id = $1`, [row.id]);
      }
    } catch (err) {
      logger.warn({ err }, "Pending disconnects flusher tick failed");
    }
  };
  // Run once on boot to flush anything that was scheduled before a restart,
  // then on a 30-second interval.
  void tick();
  flushTimer = setInterval(tick, 30_000);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

/* ─────────────────────── Misc helpers ─────────────────────── */

function failed(_channel: SendChannel, code: string, msg: string): SendResult {
  return {
    ok: false, status: "failed", provider: null, providerMessageId: null,
    channelUsed: null, errorCode: code, errorMessage: msg, logId: null,
  };
}

/* Re-export for the public OTP route to enforce per-phone limits. */
export { consumeRateBucket };
