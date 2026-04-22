import { Router, type IRouter, type Request, type Response } from "express";
import { getCommsPool } from "../lib/migrations.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { verifyZavuSignature } from "../services/zavuService.js";
import { verifyExotelSignature } from "../services/exotelService.js";
import { getCommsSettings } from "../services/commsCredentials.js";

const router: IRouter = Router();

/**
 * Pull the raw bytes the provider actually signed. We populated `req.rawBody`
 * in app.ts via the body-parser `verify` hook so that signature verification
 * works regardless of which body parser ran first.
 */
function rawString(req: Request): string {
  return req.rawBody ? req.rawBody.toString("utf8") : "";
}

function parseBody(req: Request): { json: Record<string, unknown>; raw: string } {
  const raw = rawString(req);
  if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    return { json: req.body as Record<string, unknown>, raw };
  }
  if (!raw) return { json: {}, raw: "" };
  try {
    return { json: JSON.parse(raw) as Record<string, unknown>, raw };
  } catch {
    return { json: {}, raw };
  }
}

function parseFormBody(req: Request): { json: Record<string, string>; raw: string } {
  const raw = rawString(req);
  // Express's urlencoded parser already gave us a key/value object — prefer it.
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return { json: out, raw };
  }
  if (!raw) return { json: {}, raw: "" };
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((v, k) => { out[k] = v; });
  return { json: out, raw };
}

async function applyMessageStatus(
  provider: "zavu" | "exotel",
  providerMessageId: string | null,
  status: string,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<boolean> {
  if (!providerMessageId) return false;
  const normalized =
    /deliver/i.test(status) ? "delivered" :
    /sent|accepted|queued/i.test(status) ? "sent" :
    /fail|undeliver|reject|expir/i.test(status) ? "failed" :
    status.toLowerCase();
  const pool = getCommsPool();
  const { rowCount } = await pool.query(
    `UPDATE message_logs
       SET status = $1, error_code = COALESCE($2, error_code),
           error_message = COALESCE($3, error_message), updated_at = now()
     WHERE provider = $4 AND provider_message_id = $5`,
    [normalized, errorCode, errorMessage, provider, providerMessageId],
  );
  return (rowCount ?? 0) > 0;
}

router.post("/webhooks/zavu/status", async (req: Request, res: Response) => {
  const { json, raw } = parseBody(req);
  const sigHeader = req.header("x-zavu-signature") ?? req.header("x-hub-signature-256") ?? undefined;
  const sig = await verifyZavuSignature(raw, sigHeader);
  if (!sig.ok) {
    logger.warn({ reason: sig.reason }, "Zavu webhook signature rejected");
    const status = sig.reason === "missing_secret" ? 503 : 401;
    res.status(status).json({
      error: sig.reason === "missing_secret"
        ? "Webhook secret is not configured. Set zavu_webhook_secret in admin settings."
        : "Invalid signature",
    });
    return;
  }
  // Zavu typically posts an array of statuses or a single { message_id, status }.
  const events = Array.isArray((json as { statuses?: unknown }).statuses)
    ? ((json as { statuses: Array<Record<string, unknown>> }).statuses)
    : [json];
  for (const ev of events) {
    const id = (ev.message_id as string) ?? (ev.id as string) ?? null;
    const status = String(ev.status ?? "");
    const errs = ev.errors as Array<{ code?: string; title?: string }> | undefined;
    const code = errs?.[0]?.code != null ? String(errs[0].code) : null;
    const msg = errs?.[0]?.title ?? null;
    await applyMessageStatus("zavu", id, status, code, msg).catch((err) => {
      logger.warn({ err }, "Failed to apply Zavu status");
    });
  }
  res.status(200).json({ ok: true });
});

router.post("/webhooks/exotel/status", async (req: Request, res: Response) => {
  // Exotel posts form-encoded payloads for SMS / call status callbacks.
  const ct = req.header("content-type") ?? "";
  const isJson = ct.includes("application/json");
  const { json, raw } = isJson ? parseBody(req) : parseFormBody(req);
  const sigHeader = req.header("x-exotel-signature") ?? undefined;
  const sig = await verifyExotelSignature(raw, sigHeader);
  if (!sig.ok && sig.reason !== "missing_secret") {
    logger.warn({ reason: sig.reason }, "Exotel webhook signature rejected");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  if (sig.reason === "missing_secret") {
    logger.debug("Exotel webhook accepted without signature (no secret configured)");
  }

  // Heuristic: if we see a "CallSid", treat this as a call status; otherwise
  // treat it as an SMS status. Both shapes use the same field names across
  // Exotel APIs.
  const callSid = (json.CallSid as string) ?? (json.call_sid as string) ?? null;
  if (callSid) {
    const status = String(json.Status ?? json.status ?? "");
    const duration = Number((json.ConversationDuration as string) ?? json.duration ?? 0) || 0;
    const settings = await getCommsSettings();
    const tariffPerMin = Number(settings.comms_tariff_call_paise_per_min) || 0;
    const minutes = Math.max(1, Math.ceil(duration / 60));
    const cost = duration > 0 ? tariffPerMin * minutes : 0;

    const normalized =
      /complet|ended|hangup/i.test(status) ? "completed" :
      /busy|no-answer|fail/i.test(status) ? "failed" :
      /in-progress|answer/i.test(status) ? "in_progress" :
      status.toLowerCase() || "completed";

    const pool = getCommsPool();
    await pool.query(
      `UPDATE call_logs
         SET status = $1, duration_seconds = $2,
             cost_paise = CASE WHEN $3 > 0 THEN $3 ELSE cost_paise END,
             ended_at = CASE WHEN $1 IN ('completed','failed','disconnected') THEN now() ELSE ended_at END,
             updated_at = now()
       WHERE provider = 'exotel' AND provider_call_id = $4`,
      [normalized, duration, cost, callSid],
    ).catch((err) => logger.warn({ err }, "Failed to apply Exotel call status"));
  } else {
    const msgSid = (json.SmsSid as string) ?? (json.MessageSid as string) ?? (json.sid as string) ?? null;
    const status = String(json.Status ?? json.status ?? "");
    const errCode = json.ErrorCode != null ? String(json.ErrorCode) : null;
    const errMsg = (json.ErrorMessage as string) ?? null;
    await applyMessageStatus("exotel", msgSid, status, errCode, errMsg).catch((err) => {
      logger.warn({ err }, "Failed to apply Exotel SMS status");
    });
  }
  res.status(200).json({ ok: true });
});

/**
 * Exotel Passthru applet — masked call verification.
 *
 * Flow: User dials ExoPhone → Gather collects 8 digits (vehicle last 4 + PIN)
 * → Passthru hits this endpoint → we verify → return owner phone on success.
 *
 * Exotel sends form-encoded POST with `digits` from the preceding Gather applet.
 * We split: first 4 = vehicle last 4 digits, last 4 = PIN code.
 * On match: HTTP 200 + owner's phone number (for Connect applet).
 * On failure: HTTP 400 (Exotel follows the failure branch → plays error → hangs up).
 */
router.post("/webhooks/exotel/verify", async (req: Request, res: Response) => {
  const ct = req.header("content-type") ?? "";
  const isJson = ct.includes("application/json");
  const { json } = isJson ? parseBody(req) : parseFormBody(req);

  const callSid = String(json.CallSid ?? json.call_sid ?? "");
  const callerPhone = String(json.CallFrom ?? json.From ?? "");
  const digits = String(json.digits ?? "").replace(/\D/g, "");

  logger.info({ callSid, callerPhone, digitsLength: digits.length }, "Exotel Passthru verify");

  if (digits.length < 8) {
    logger.warn({ digits: digits.length }, "Passthru: insufficient digits");
    res.status(400).json({ error: "Please enter 8 digits: last 4 of vehicle number + 4-digit PIN." });
    return;
  }

  const vehicleLast4 = digits.slice(0, 4).toUpperCase();
  const pin = digits.slice(4, 8);

  const { data: matches, error } = await supabaseAdmin
    .from("qr_codes")
    .select("id, type, pin_code, is_active, allow_contact, emergency_contact, data")
    .eq("type", "vehicle")
    .eq("pin_code", pin)
    .eq("is_active", true);

  if (error) {
    logger.error({ err: error.message }, "Passthru: DB query failed");
    res.status(500).json({ error: "Internal error." });
    return;
  }

  const qr = (matches ?? []).find((row) => {
    const vn = String((row.data as Record<string, unknown>)?.vehicle_number ?? "");
    return vn.slice(-4).toUpperCase() === vehicleLast4;
  });

  if (!qr) {
    logger.info({ vehicleLast4, pin: "****" }, "Passthru: no matching QR found");
    res.status(400).json({ error: "Invalid vehicle number or PIN." });
    return;
  }

  if (!(qr.allow_contact ?? true)) {
    res.status(403).json({ error: "Owner has disabled contact for this tag." });
    return;
  }

  const d = (qr.data ?? {}) as Record<string, unknown>;
  const ownerPhone = qr.emergency_contact
    ?? (d.contact_phone as string)
    ?? (d.owner_phone as string)
    ?? (d.phone as string)
    ?? (d.emergency_contact_1 as string)
    ?? null;

  if (!ownerPhone) {
    logger.warn({ qrId: qr.id }, "Passthru: QR matched but no owner phone");
    res.status(400).json({ error: "Owner phone number not configured." });
    return;
  }

  // Log the call attempt
  try {
    const pool = getCommsPool();
    await pool.query(
      `INSERT INTO call_logs (provider, provider_call_id, qr_id, caller_phone, owner_phone, channel, status, created_at)
       VALUES ('exotel', $1, $2, $3, $4, 'ivr_passthru', 'initiated', now())`,
      [callSid, qr.id, callerPhone, ownerPhone],
    );
  } catch (err) {
    logger.warn({ err }, "Passthru: failed to log call (non-blocking)");
  }

  // Log contact request in Supabase
  try {
    await supabaseAdmin.from("contact_requests").insert({
      qr_id: qr.id,
      name: null,
      phone: callerPhone,
      intent: "call",
      message: `IVR masked call via ExoPhone (CallSid: ${callSid})`,
      status: "pending",
    });
  } catch (err) {
    logger.warn({ err }, "Passthru: failed to log contact request (non-blocking)");
  }

  logger.info({ qrId: qr.id, callSid }, "Passthru: verified, returning owner phone");
  res.status(200).json({ owner_phone: ownerPhone });
});

export default router;
