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
     → Passthru #0 (greeting) → GET  /webhooks/exotel/greeting
       ├─ "callback"  → Connect (owner calling back a stranger)
       └─ "stranger"  → normal IVR below
     → Gather #1 (vehicle)  → GET  /webhooks/exotel/gather/vehicle
     → Passthru #1 (store)  → GET  /webhooks/exotel/store-vehicle
     → Gather #2 (PIN)      → GET  /webhooks/exotel/gather/pin
     → Passthru #2 (verify) → GET  /webhooks/exotel/verify
     → Connect (dynamic)    → GET  /webhooks/exotel/connect
   ═══════════════════════════════════════════════════ */

// In-memory caches. Entries expire after 5 minutes.
const pendingVehicle = new Map<string, { vehicleLast4: string; callerPhone: string; expiresAt: number }>();
const verifiedCalls = new Map<string, { ownerPhone: string; qrId: string; isCallback?: boolean; expiresAt: number }>();
const attemptCount = new Map<string, { count: number; expiresAt: number }>();
function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of pendingVehicle) { if (v.expiresAt < now) pendingVehicle.delete(k); }
  for (const [k, v] of verifiedCalls) { if (v.expiresAt < now) verifiedCalls.delete(k); }
  for (const [k, v] of attemptCount) { if (v.expiresAt < now) attemptCount.delete(k); }
}

/**
 * Passthru #0 — Greeting / Owner callback detection.
 *
 * When the caller's phone matches a registered QR owner AND there is a
 * recent contact_request (< callback_window_minutes, default 60 min),
 * skip the IVR and connect the owner directly to the stranger.
 *
 * Returns 200 OK → Exotel routes to Connect (owner callback).
 * Returns 404    → Exotel routes to Greeting → Flow B (normal stranger IVR).
 */
router.get("/webhooks/exotel/greeting", async (req: Request, res: Response) => {
  const json = req.query as Record<string, string>;
  const callSid = String(json.CallSid ?? json.call_sid ?? "");
  const callerPhone = String(json.CallFrom ?? json.From ?? "");

  if (!callerPhone) {
    res.status(404).send("stranger");
    return;
  }

  try {
    const { normalizePhone, isValidIndianMobile } = await import("../services/phoneHash.js");
    const normalized = normalizePhone(callerPhone);

    if (!isValidIndianMobile(normalized)) {
      res.status(404).send("stranger");
      return;
    }

    const { data: allQrs } = await supabaseAdmin
      .from("qr_codes")
      .select("id, user_id, emergency_contact, data")
      .eq("is_active", true);

    const ownerQrIds = (allQrs ?? [])
      .filter((qr) => {
        const d = (qr.data ?? {}) as Record<string, unknown>;
        const phones = [
          d.primary_phone, d.owner_phone, d.parent_phone,
          d.emergency_contact, d.contact_number, d.contact_phone,
          d.phone, qr.emergency_contact, d.emergency_contact_1,
        ].filter(Boolean).map((p) => normalizePhone(String(p)));
        return phones.includes(normalized);
      })
      .map((qr) => qr.id as string);

    if (ownerQrIds.length === 0) {
      res.status(404).send("stranger");
      return;
    }

    // Check for recent contact request within callback window
    const settings = await getCommsSettings();
    const windowMin = Number((settings as Record<string, string>).callback_window_minutes) || 60;
    const cutoff = new Date(Date.now() - windowMin * 60_000).toISOString();

    const { data: recent } = await supabaseAdmin
      .from("contact_requests")
      .select("id, qr_id, requester_phone, created_at")
      .in("qr_id", ownerQrIds)
      .in("intent", ["call", "emergency", "contact"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recent?.requester_phone) {
      logger.info({ callerPhone: "***owner***", ownerQrIds }, "Greeting: owner detected but no recent contact request");
      res.status(404).send("no-recent-request");
      return;
    }

    // Rate-limit callbacks: max 3 per owner per hour
    cleanExpired();
    const cbKey = `cb:${normalized}`;
    const cbAttempts = attemptCount.get(cbKey) ?? { count: 0, expiresAt: Date.now() + 60 * 60_000 };
    cbAttempts.count++;
    attemptCount.set(cbKey, cbAttempts);

    if (cbAttempts.count > 3) {
      logger.warn({ callerPhone: "***owner***" }, "Greeting: callback rate limit exceeded");
      res.status(404).send("rate-limited");
      return;
    }

    const strangerPhone = recent.requester_phone as string;

    if (!isValidIndianMobile(normalizePhone(strangerPhone))) {
      logger.warn({ qrId: recent.qr_id }, "Greeting: stranger phone invalid for callback");
      res.status(404).send("invalid-stranger-phone");
      return;
    }

    // Cache for Connect applet — stranger becomes the destination
    verifiedCalls.set(callSid, {
      ownerPhone: strangerPhone,
      qrId: recent.qr_id as string,
      isCallback: true,
      expiresAt: Date.now() + 5 * 60_000,
    });

    // Log callback call attempt (non-blocking)
    try {
      const pool = getCommsPool();
      const { hashPhone } = await import("../services/phoneHash.js");
      const callerHash = hashPhone(callerPhone);
      const calleeHash = hashPhone(strangerPhone);
      await pool.query(
        `INSERT INTO call_logs (provider, provider_call_id, qr_id, caller_phone_hash, callee_phone_hash, status, created_at)
         VALUES ('exotel', $1, $2, $3, $4, 'initiated', now())`,
        [callSid, recent.qr_id, callerHash, calleeHash],
      );
    } catch (err) {
      logger.warn({ err }, "Greeting: failed to log callback call (non-blocking)");
    }

    logger.info({ callSid, qrId: recent.qr_id }, "Greeting: owner callback — skipping IVR");
    res.status(200).send("callback");
  } catch (err) {
    logger.error({ err }, "Greeting: error during owner detection");
    res.status(404).send("error");
  }
});

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
 * Returns JSON for SwitchCase + Connect applet routing.
 *
 * Response shape:
 *   { "select": "verified", "destination": "+91XXXXXXXXXX" }  -> SwitchCase routes to Connect; Connect dials destination
 *   { "select": "retry" }                                      -> SwitchCase loops back to Gather
 *   { "select": "max_attempts" }                               -> SwitchCase hangs up
 */
router.get("/webhooks/exotel/verify", async (req: Request, res: Response) => {
  const json = req.query as Record<string, string>;
  const callSid = String(json.CallSid ?? json.call_sid ?? "");
  const callerPhone = String(json.CallFrom ?? json.From ?? "");
  const rawDigits = String(json.digits ?? "").replace(/"/g, "").trim();
  const pin = rawDigits.replace(/\D/g, "").slice(0, 4);

  // Track attempts per CallSid
  cleanExpired();
  const attempts = attemptCount.get(callSid) ?? { count: 0, expiresAt: Date.now() + 5 * 60_000 };
  attempts.count++;
  attemptCount.set(callSid, attempts);

  const stored = pendingVehicle.get(callSid);
  if (!stored) {
    logger.warn({ callSid, attempt: attempts.count }, "Verify: no stored vehicle digits");
    res.status(200).json({ select: attempts.count >= 3 ? "max_attempts" : "retry" });
    return;
  }

  const vehicleLast4 = stored.vehicleLast4;
  pendingVehicle.delete(callSid);

  logger.info({ callSid, vehicleLast4, pin: "****", attempt: attempts.count }, "Verify: checking");

  if (pin.length < 4) {
    logger.warn({ pinLength: pin.length, attempt: attempts.count }, "Verify: insufficient PIN");
    res.status(200).json({ select: attempts.count >= 3 ? "max_attempts" : "retry" });
    return;
  }

  const { data: matches, error } = await supabaseAdmin
    .from("qr_codes")
    .select("id, type, pin_code, is_active, allow_contact, emergency_contact, data")
    .eq("is_active", true);

  if (error) {
    logger.error({ err: error.message }, "Verify: DB query failed");
    res.status(200).json({ select: "retry" });
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
    logger.info({ vehicleLast4, pin: "****", attempt: attempts.count }, "Verify: no match");
    res.status(200).json({ select: attempts.count >= 3 ? "max_attempts" : "retry" });
    return;
  }

  if (!(qr.allow_contact ?? true)) {
    res.status(200).json({ select: "max_attempts" });
    return;
  }

  const d = (qr.data ?? {}) as Record<string, unknown>;
  // Owner-phone resolution must mirror the frontend's canonical contact-key
  // priority (see CreateQRScreen.tsx + ClaimQRScreen.tsx): vehicle uses
  // `primary_phone`, pet uses `owner_phone`, child uses `parent_phone`, etc.
  // The `qr.emergency_contact` column is a SEPARATE "manage emergency
  // contact" field — only fall back to it last.
  const ownerPhone = (d.primary_phone as string)
    ?? (d.owner_phone as string)
    ?? (d.parent_phone as string)
    ?? (d.emergency_contact as string)
    ?? (d.contact_number as string)
    ?? (d.contact_phone as string)
    ?? (d.phone as string)
    ?? qr.emergency_contact
    ?? (d.emergency_contact_1 as string)
    ?? null;

  if (!ownerPhone) {
    logger.warn({ qrId: qr.id }, "Verify: no owner phone configured");
    res.status(200).json({ select: "max_attempts" });
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

  // Normalize owner phone for Exotel dial (E.164 format)
  const normalized = ownerPhone.startsWith("+") ? ownerPhone : `+91${ownerPhone.replace(/^0+/, "")}`;

  // Cache for Connect applet (fallback if Exotel calls /connect URL)
  verifiedCalls.set(callSid, { ownerPhone, qrId: qr.id, expiresAt: Date.now() + 5 * 60_000 });
  attemptCount.delete(callSid);

  logger.info({ qrId: qr.id, callSid, ownerPhone: "***" }, "Verify: success");
  // Return both `select` (for SwitchCase routing) and `destination` (for Connect applet to dial)
  res.status(200).json({ select: "verified", destination: normalized });
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

  const isCallback = cached.isCallback ?? false;
  logger.info({ callSid, qrId: cached.qrId, isCallback }, "Connect: returning destination phone");

  res.status(200).json({
    destination: {
      numbers: [normalized],
    },
    max_conversation_duration: maxDuration,
    record: false,
    start_call_playback: {
      playback_to: "callee",
      type: "text",
      value: isCallback
        ? "The vehicle owner is calling you back. Connecting now."
        : "Someone is trying to reach you through your Stegofy QR tag. Connecting now.",
    },
  });
});

export default router;
