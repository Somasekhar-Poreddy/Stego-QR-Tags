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

/* ═══════════════════════════════════════════════════
   EXOTEL IVR FLOW — Masked Calling via AppBazaar

   Flow: User dials ExoPhone
     → Greeting                          (configured in Exotel)
     → Gather #1 (vehicle)  → GET  /webhooks/exotel/gather/vehicle
     → Passthru #1 (store)  → GET  /webhooks/exotel/store-vehicle
     → Gather #2 (PIN)      → GET  /webhooks/exotel/gather/pin
     → Passthru #2 (verify) → GET  /webhooks/exotel/verify
     → Connect (dynamic)    → GET  /webhooks/exotel/connect
   ═══════════════════════════════════════════════════ */

// In-memory caches. Entries expire after 5 minutes.
const pendingVehicle = new Map<string, { vehicleLast4: string; callerPhone: string; expiresAt: number }>();
const verifiedCalls = new Map<string, { ownerPhone: string; qrId: string; expiresAt: number }>();
function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of pendingVehicle) { if (v.expiresAt < now) pendingVehicle.delete(k); }
  for (const [k, v] of verifiedCalls) { if (v.expiresAt < now) verifiedCalls.delete(k); }
}

/**
 * Gather #1 — Vehicle number (last 4 digits).
 */
router.get("/webhooks/exotel/gather/vehicle", (_req: Request, res: Response) => {
  res.status(200).json({
    gather_prompt: {
      text: "Please enter the last 4 digits of the vehicle registration number, and then press hash.",
    },
    max_input_digits: 4,
    finish_on_key: "#",
    input_timeout: 10,
    repeat_menu: 3,
    repeat_gather_prompt: {
      text: "We did not receive your input. Please enter the last 4 digits of the vehicle registration number, and press hash.",
    },
  });
});

/**
 * Passthru #1 — Store vehicle last 4 digits (keyed by CallSid).
 * Returns 200 so the flow proceeds to Gather #2.
 */
router.get("/webhooks/exotel/store-vehicle", (req: Request, res: Response) => {
  const json = req.query as Record<string, string>;
  const callSid = String(json.CallSid ?? json.call_sid ?? "");
  const callerPhone = String(json.CallFrom ?? json.From ?? "");
  const rawDigits = String(json.digits ?? "").replace(/"/g, "").trim();
  const digits = rawDigits.replace(/\D/g, "");

  logger.info({ callSid, callerPhone, digits }, "Store vehicle: received");

  if (digits.length < 4) {
    logger.warn({ digits }, "Store vehicle: insufficient digits");
    res.status(400).json({ error: "Please enter 4 digits." });
    return;
  }

  cleanExpired();
  pendingVehicle.set(callSid, {
    vehicleLast4: digits.slice(0, 4).toUpperCase(),
    callerPhone,
    expiresAt: Date.now() + 5 * 60_000,
  });

  logger.info({ callSid, vehicleLast4: digits.slice(0, 4) }, "Store vehicle: cached");
  res.status(200).json({ ok: true });
});

/**
 * Gather #2 — PIN code (4 digits).
 */
router.get("/webhooks/exotel/gather/pin", (_req: Request, res: Response) => {
  res.status(200).json({
    gather_prompt: {
      text: "Now please enter the 4 digit PIN code printed on the sticker, and then press hash.",
    },
    max_input_digits: 4,
    finish_on_key: "#",
    input_timeout: 10,
    repeat_menu: 3,
    repeat_gather_prompt: {
      text: "We did not receive your input. Please enter the 4 digit PIN code from the sticker, and press hash.",
    },
  });
});

/**
 * Passthru #2 — Verify vehicle + PIN against database.
 * Reads stored vehicle digits from cache + PIN from this request's digits param.
 */
router.get("/webhooks/exotel/verify", async (req: Request, res: Response) => {
  const json = req.query as Record<string, string>;
  const callSid = String(json.CallSid ?? json.call_sid ?? "");
  const callerPhone = String(json.CallFrom ?? json.From ?? "");
  const rawDigits = String(json.digits ?? "").replace(/"/g, "").trim();
  const pin = rawDigits.replace(/\D/g, "").slice(0, 4);

  const stored = pendingVehicle.get(callSid);
  if (!stored) {
    logger.warn({ callSid }, "Verify: no stored vehicle digits for this CallSid");
    res.status(400).json({ error: "Session expired. Please try again." });
    return;
  }

  const vehicleLast4 = stored.vehicleLast4;
  pendingVehicle.delete(callSid);

  logger.info({ callSid, vehicleLast4, pin: "****", callerPhone }, "Verify: checking vehicle + PIN");

  if (pin.length < 4) {
    logger.warn({ pinLength: pin.length }, "Verify: insufficient PIN digits");
    res.status(400).json({ error: "Please enter a 4-digit PIN." });
    return;
  }

  const { data: matches, error } = await supabaseAdmin
    .from("qr_codes")
    .select("id, type, pin_code, is_active, allow_contact, emergency_contact, data")
    .eq("is_active", true);

  if (error) {
    logger.error({ err: error.message }, "Verify: DB query failed");
    res.status(500).json({ error: "Internal error." });
    return;
  }

  const qr = (matches ?? []).find((row) => {
    const d = (row.data ?? {}) as Record<string, unknown>;
    const vn = String(d.vehicle_number ?? "");
    const vnMatch = vn.length >= 4 && vn.slice(-4).toUpperCase() === vehicleLast4;
    const pinMatch = row.pin_code === pin;
    return vnMatch && pinMatch;
  });

  if (!qr) {
    logger.info({ vehicleLast4, pin: "****" }, "Verify: no matching QR found");
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
    logger.warn({ qrId: qr.id }, "Verify: QR matched but no owner phone");
    res.status(400).json({ error: "Owner phone number not configured." });
    return;
  }

  // Log the call attempt (non-blocking)
  try {
    const pool = getCommsPool();
    const { hashPhone } = await import("../services/phoneHash.js");
    const callerHash = hashPhone(callerPhone || stored.callerPhone);
    const calleeHash = hashPhone(ownerPhone);
    await pool.query(
      `INSERT INTO call_logs (provider, provider_call_id, qr_id, caller_phone_hash, callee_phone_hash, status, created_at)
       VALUES ('exotel', $1, $2, $3, $4, 'initiated', now())`,
      [callSid, qr.id, callerHash, calleeHash],
    );
  } catch (err) {
    logger.warn({ err }, "Verify: failed to log call (non-blocking)");
  }

  // Log contact request (non-blocking)
  try {
    await supabaseAdmin.from("contact_requests").insert({
      qr_id: qr.id,
      name: null,
      phone: callerPhone || stored.callerPhone,
      intent: "call",
      message: `IVR masked call via ExoPhone (CallSid: ${callSid})`,
      status: "pending",
    });
  } catch (err) {
    logger.warn({ err }, "Verify: failed to log contact request (non-blocking)");
  }

  cleanExpired();
  verifiedCalls.set(callSid, { ownerPhone, qrId: qr.id, expiresAt: Date.now() + 5 * 60_000 });

  logger.info({ qrId: qr.id, callSid }, "Verify: success, cached owner phone for Connect");
  res.status(200).json({ ok: true });
});

/**
 * Connect applet — Dynamic URL.
 * Returns the owner phone number for Exotel to dial.
 */
router.get("/webhooks/exotel/connect", async (req: Request, res: Response) => {
  const callSid = String(req.query.CallSid ?? req.query.call_sid ?? "");

  if (!callSid) {
    logger.warn("Connect: no CallSid");
    res.status(400).json({ error: "Missing CallSid" });
    return;
  }

  const cached = verifiedCalls.get(callSid);
  if (!cached) {
    logger.warn({ callSid }, "Connect: no verified call found");
    res.status(400).json({ error: "Call not verified" });
    return;
  }

  const ownerPhone = cached.ownerPhone;
  const normalized = ownerPhone.startsWith("+") ? ownerPhone : `+91${ownerPhone.replace(/^0+/, "")}`;

  const settings = await getCommsSettings();
  const maxDuration = Number(settings.call_max_duration_sec) || 60;

  verifiedCalls.delete(callSid);

  logger.info({ callSid, qrId: cached.qrId }, "Connect: returning owner phone");

  res.status(200).json({
    destination: {
      numbers: [normalized],
    },
    max_conversation_duration: maxDuration,
    record: false,
    start_call_playback: {
      playback_to: "callee",
      type: "text",
      value: "Someone is trying to reach you through your Stegofy QR tag. Connecting now.",
    },
  });
});

export default router;
