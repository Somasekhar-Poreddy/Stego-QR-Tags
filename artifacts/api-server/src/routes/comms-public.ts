import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import {
  sendMessageSmart,
  placeMaskedCall,
  schedulePendingDisconnect,
  consumeRateBucket,
} from "../services/commsRouter.js";
import { getCommsSettings, isFlagOn, flagOn } from "../services/commsCredentials.js";
import { isValidIndianMobile, normalizePhone, hashPhone } from "../services/phoneHash.js";

const router: IRouter = Router();

const OTP_PURPOSE_SCAN = "scan_contact";

function getClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]!.trim();
  return req.ip ?? null;
}

/* ─────────────────────────── OTP ─────────────────────────── */

router.post("/otp/request", async (req: Request, res: Response) => {
  const { phone, qr_id } = (req.body ?? {}) as { phone?: string; qr_id?: string };
  const normalized = normalizePhone(phone);
  if (!isValidIndianMobile(normalized)) {
    res.status(400).json({ error: "Please enter a valid Indian mobile number." });
    return;
  }

  const settings = await getCommsSettings();
  const limit = Number(settings.comms_max_otp_per_phone_per_hour) || 5;
  const bucket = await consumeRateBucket({ key: `otp:${hashPhone(normalized)}`, limit });
  if (!bucket.allowed) {
    res.status(429).json({
      error: "Too many verification requests for this number. Please try again in a little while.",
    });
    return;
  }

  const result = await requestOtp({
    phone: normalized,
    qrId: qr_id ?? null,
    purpose: OTP_PURPOSE_SCAN,
    ip: getClientIp(req),
  });
  if (!result.ok) {
    res.status(502).json({
      error: result.errorMessage ?? "Could not send verification code right now.",
    });
    return;
  }
  res.status(200).json({
    ok: true,
    channel: result.channelUsed,
    expires_in_seconds: 600,
    ...(result.devCode ? { dev_code: result.devCode } : {}),
  });
});

router.post("/otp/verify", async (req: Request, res: Response) => {
  const { phone, code, qr_id } = (req.body ?? {}) as { phone?: string; code?: string; qr_id?: string };
  const normalized = normalizePhone(phone);
  if (!isValidIndianMobile(normalized) || !code || !/^\d{4,8}$/.test(String(code))) {
    res.status(400).json({ error: "Invalid phone or code." });
    return;
  }
  const result = await verifyOtp({
    phone: normalized,
    code: String(code),
    purpose: OTP_PURPOSE_SCAN,
    qrId: qr_id ?? null,
  });
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      ok: "OK",
      no_code: "No code requested. Please request a new one.",
      expired: "This code has expired. Please request a new one.",
      too_many_attempts: "Too many incorrect attempts. Please request a new code.",
      mismatch: "Incorrect code. Please try again.",
    };
    res.status(400).json({ error: messages[result.reason], reason: result.reason });
    return;
  }
  res.status(200).json({ ok: true });
});

/* ─────────────────────── Contact dispatch ─────────────────────── */

interface QrRow {
  id: string;
  type: string | null;
  pin_code: string | null;
  is_active: boolean | null;
  allow_contact: boolean | null;
  strict_mode: boolean | null;
  emergency_contact: string | null;
  data: Record<string, unknown> | null;
}

async function loadQr(qrId: string): Promise<QrRow | null> {
  const { data, error } = await supabaseAdmin
    .from("qr_codes")
    .select("id, type, pin_code, is_active, allow_contact, strict_mode, emergency_contact, data")
    .eq("id", qrId)
    .maybeSingle();
  if (error) {
    logger.warn({ err: error.message }, "qr_codes lookup failed");
    return null;
  }
  return (data as QrRow | null) ?? null;
}

function pickOwnerPhone(qr: QrRow): string | null {
  // Prefer explicit emergency_contact, then the structured `data.contact_phone`,
  // then any other common phone keys (mirrors how the public profile renders).
  if (qr.emergency_contact) return qr.emergency_contact;
  const d = qr.data ?? {};
  const candidates = [
    d.contact_phone,
    d.owner_phone,
    d.phone,
    d.emergency_contact_1,
    d.emergency_contact_2,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

interface SharedContactBody {
  qr_id?: string;          // NB: also sent in URL; accepted in body for symmetry
  phone?: string;          // requester phone
  pin?: string;
  vehicle_last4?: string;
  intent?: string;
  message?: string;
}

async function validateRequester(req: Request, res: Response): Promise<{
  qr: QrRow;
  qrId: string;
  phone: string;
  intent: string | null;
  message: string | null;
} | null> {
  const qrId = String(req.params.qrId ?? "");
  if (!qrId) {
    res.status(400).json({ error: "Missing qr_id." });
    return null;
  }
  const body = (req.body ?? {}) as SharedContactBody;
  const phone = normalizePhone(body.phone);
  if (!isValidIndianMobile(phone)) {
    res.status(400).json({ error: "Please enter a valid mobile number." });
    return null;
  }

  const settings = await getCommsSettings();
  if (isFlagOn(settings.feature_otp_required ?? "true")) {
    // Verify a *consumed* OTP exists in the last 15 minutes for this phone.
    // The frontend calls /otp/verify first; here we just confirm the consumption.
    const phHash = hashPhone(phone);
    const { rows } = await (await import("../lib/migrations.js")).getCommsPool().query<{ id: string }>(
      `SELECT id FROM otp_codes
        WHERE phone_hash = $1 AND purpose = $2 AND consumed_at IS NOT NULL
          AND consumed_at > now() - interval '15 minutes'
        ORDER BY consumed_at DESC LIMIT 1`,
      [phHash, OTP_PURPOSE_SCAN],
    );
    if (rows.length === 0) {
      res.status(401).json({ error: "Please verify your phone number first.", code: "OTP_REQUIRED" });
      return null;
    }
  }

  const qr = await loadQr(qrId);
  if (!qr || !qr.is_active) {
    res.status(404).json({ error: "QR not found or inactive." });
    return null;
  }
  if (!qr.allow_contact) {
    res.status(403).json({ error: "Owner has disabled contact requests for this tag." });
    return null;
  }
  // Strict mode = the owner only wants to be reached for genuine emergencies.
  // Any non-emergency contact attempt over this endpoint is refused and the
  // visitor is steered toward the emergency flow on the frontend.
  if (qr.strict_mode && body.intent !== "emergency") {
    res.status(403).json({
      error: "This tag only accepts emergency contact. Please use the Emergency option.",
      code: "STRICT_MODE",
    });
    return null;
  }

  // Pin check
  if (qr.pin_code && body.pin !== qr.pin_code) {
    res.status(401).json({ error: "Incorrect PIN. Please check the PIN printed on the tag." });
    return null;
  }
  // Vehicle last4 check
  if (qr.type === "vehicle") {
    const expected = String((qr.data?.vehicle_number as string | undefined) ?? "").slice(-4).toUpperCase();
    const provided = String(body.vehicle_last4 ?? "").toUpperCase();
    if (expected && provided !== expected) {
      res.status(401).json({ error: "Vehicle number last 4 digits don't match." });
      return null;
    }
  }

  return {
    qr,
    qrId,
    phone,
    intent: body.intent ?? null,
    message: body.message ?? null,
  };
}

async function insertContactRequest(args: {
  qrId: string;
  phone: string;
  intent: string | null;
  message: string | null;
  actionType: "contact" | "message";
  ip: string | null;
  providerMetadata: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("contact_requests")
    .insert({
      qr_id: args.qrId,
      intent: args.intent,
      message: args.message,
      action_type: args.actionType,
      requester_phone: args.phone,
      ip_address: args.ip,
      status: "pending",
      provider_metadata: args.providerMetadata,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn({ err: error.message }, "contact_requests insert failed");
    return null;
  }
  return ((data as { id?: string } | null)?.id) ?? null;
}

/* POST /api/qr/:qrId/contact/call — masked call */
router.post("/qr/:qrId/contact/call", async (req: Request, res: Response) => {
  const ctx = await validateRequester(req, res);
  if (!ctx) return;

  const settings = await getCommsSettings();
  if (!flagOn(settings, "masked_call_enabled", "feature_calls_enabled")) {
    res.status(503).json({ error: "Masked calls are temporarily unavailable. Please try messaging instead." });
    return;
  }
  const ownerPhone = pickOwnerPhone(ctx.qr);
  if (!ownerPhone) {
    res.status(409).json({ error: "Owner has not configured a contact number." });
    return;
  }

  // Per-phone rate limit
  const callLimit = Number(settings.comms_max_call_per_phone_per_hour) || 10;
  const bucket = await consumeRateBucket({ key: `call:${hashPhone(ctx.phone)}`, limit: callLimit });
  if (!bucket.allowed) {
    res.status(429).json({ error: "Too many call attempts. Please try again later." });
    return;
  }

  const contactRequestId = await insertContactRequest({
    qrId: ctx.qrId,
    phone: ctx.phone,
    intent: ctx.intent,
    message: ctx.message,
    actionType: "contact",
    ip: getClientIp(req),
    providerMetadata: { channel: "call" },
  });

  const result = await placeMaskedCall({
    callerPhone: ctx.phone,
    calleePhone: ownerPhone,
    contactRequestId,
    qrId: ctx.qrId,
  });

  if (!result.ok) {
    res.status(502).json({
      error: "Could not place the call right now. Please try messaging instead.",
      code: result.errorCode,
    });
    return;
  }

  // Link the call_logs row back to the contact_request so the admin trail
  // endpoint can show full delivery history (provider, fallback, cost, etc.)
  // without scanning by phone number.
  if (contactRequestId && result.callLogId) {
    await supabaseAdmin
      .from("contact_requests")
      .update({ provider_metadata: { channel: "call", callLogId: result.callLogId, providerCallId: result.providerCallId } })
      .eq("id", contactRequestId)
      .then(() => null, () => null);
  }

  // Defense-in-depth disconnect: schedule a hangup ~10s after Exotel's
  // own TimeLimit so transient delays don't let calls run past the cap.
  if (result.providerCallId) {
    await schedulePendingDisconnect({
      provider: "exotel",
      providerCallId: result.providerCallId,
      delaySeconds: result.maxDurationSec + 10,
    }).catch(() => null);
  }

  res.status(200).json({
    ok: true,
    state: "calling",
    contact_request_id: contactRequestId,
  });
});

/* POST /api/qr/:qrId/contact/message — WhatsApp/SMS message */
router.post("/qr/:qrId/contact/message", async (req: Request, res: Response) => {
  const ctx = await validateRequester(req, res);
  if (!ctx) return;
  const settings = await getCommsSettings();
  if (!flagOn(settings, "sms_enabled", "feature_messages_enabled")
      && !flagOn(settings, "whatsapp_enabled", "feature_whatsapp_enabled")) {
    res.status(503).json({ error: "Messaging is temporarily unavailable. Please try a masked call instead." });
    return;
  }
  const ownerPhone = pickOwnerPhone(ctx.qr);
  if (!ownerPhone) {
    res.status(409).json({ error: "Owner has not configured a contact number." });
    return;
  }

  const msgLimit = Number(settings.comms_max_messages_per_phone_per_hour) || 20;
  const bucket = await consumeRateBucket({ key: `msg:${hashPhone(ctx.phone)}`, limit: msgLimit });
  if (!bucket.allowed) {
    res.status(429).json({ error: "Too many message attempts. Please try again later." });
    return;
  }

  const intentLabel = ctx.intent ?? "wants to contact you";
  const customerMsg = ctx.message?.trim();
  const body =
    `Stegofy alert: someone scanned your QR (${ctx.qr.type ?? "tag"}). ` +
    `Reason: ${intentLabel}.` +
    (customerMsg ? ` Message: "${customerMsg}".` : "") +
    ` Reply to this number or open Stegofy to respond.`;

  const contactRequestId = await insertContactRequest({
    qrId: ctx.qrId,
    phone: ctx.phone,
    intent: ctx.intent,
    message: ctx.message,
    actionType: "message",
    ip: getClientIp(req),
    providerMetadata: { channel: "message" },
  });

  const result = await sendMessageSmart({
    to: ownerPhone,
    body,
    contactRequestId,
    qrId: ctx.qrId,
  });

  if (!result.ok) {
    res.status(502).json({
      error: "Could not deliver your message right now. Owner has been notified through the dashboard.",
      code: result.errorCode,
    });
    return;
  }

  if (contactRequestId && result.logId) {
    await supabaseAdmin
      .from("contact_requests")
      .update({ provider_metadata: {
        channel: "message",
        messageLogId: result.logId,
        provider: result.provider,
        channelUsed: result.channelUsed,
      } })
      .eq("id", contactRequestId)
      .then(() => null, () => null);
  }

  res.status(200).json({
    ok: true,
    state: "notified",
    channel: result.channelUsed,
    provider: result.provider,
    contact_request_id: contactRequestId,
  });
});

export default router;
