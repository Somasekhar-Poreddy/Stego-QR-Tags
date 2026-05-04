import crypto from "node:crypto";
import { getCommsPool } from "../lib/migrations.js";
import { hashPhone } from "./phoneHash.js";
import { getCommsSettings } from "./commsCredentials.js";
import { sendWhatsAppSmart, sendSmsSmart } from "./commsRouter.js";
import { consumeRateBucket } from "./rateLimitDb.js";

const OTP_TTL_SECONDS = 600;        // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  // 6-digit numeric, no leading-zero ambiguity for the user.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export interface OtpRequestResult {
  ok: boolean;
  channelUsed: "whatsapp" | "sms" | null;
  errorCode: string | null;
  errorMessage: string | null;
  // For dev only — never returned to clients in prod.
  devCode?: string;
}

export async function requestOtp(opts: {
  phone: string;          // already-normalized E.164
  qrId?: string | null;
  purpose: string;        // e.g. "scan_contact"
  ip?: string | null;
  channelOverride?: "whatsapp" | "sms" | null;
}): Promise<OtpRequestResult> {
  const pool = getCommsPool();
  const settings = await getCommsSettings();
  const phoneHash = hashPhone(opts.phone);

  // Spec: throttle OTP resends to 1 every 60 seconds per phone. Persisted
  // in the same Postgres-backed bucket table the rest of the comms
  // platform uses, so the limit survives restarts and replicas.
  const resend = await consumeRateBucket({
    key: `otp_resend:${phoneHash}`,
    limit: 1,
    windowSeconds: 60,
  });
  if (!resend.allowed) {
    const waitSec = Math.max(1, Math.ceil((resend.resetAt.getTime() - Date.now()) / 1000));
    return {
      ok: false,
      channelUsed: null,
      errorCode: "OTP_RESEND_COOLDOWN",
      errorMessage: `Please wait ${waitSec}s before requesting a new code.`,
    };
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expires = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  // Compose a tiny, template-friendly message. If a Zavu template id is
  // configured we use the template-with-variables shape; otherwise we fall
  // back to a plain text body (works for Exotel + WhatsApp session messages).
  const templateId = settings.zavu_otp_template_id?.trim();
  const body = `Your StegoTags verification code is ${code}. It expires in 10 minutes.`;
  const template = templateId ? { id: templateId, variables: { "1": code } } : undefined;

  const channelPref = (opts.channelOverride ?? settings.comms_otp_channel ?? "whatsapp_first").toLowerCase();

  let result;
  let channelUsed: "whatsapp" | "sms" | null = null;
  if (channelPref === "sms") {
    result = await sendSmsSmart({ to: opts.phone, body, qrId: opts.qrId ?? null });
    channelUsed = result.ok ? "sms" : null;
  } else if (channelPref === "whatsapp") {
    result = await sendWhatsAppSmart({ to: opts.phone, body, template, qrId: opts.qrId ?? null });
    channelUsed = result.ok ? "whatsapp" : null;
  } else {
    // whatsapp_first
    result = await sendWhatsAppSmart({ to: opts.phone, body, template, qrId: opts.qrId ?? null });
    if (result.ok) {
      channelUsed = "whatsapp";
    } else {
      result = await sendSmsSmart({ to: opts.phone, body, qrId: opts.qrId ?? null });
      channelUsed = result.ok ? "sms" : null;
    }
  }

  if (!result.ok || !channelUsed) {
    return {
      ok: false,
      channelUsed: null,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage ?? "Could not send verification code.",
    };
  }

  // Persist OTP only after at least one provider accepted the message.
  await pool.query(
    `INSERT INTO otp_codes (phone_hash, code_hash, qr_id, purpose, channel, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [phoneHash, codeHash, opts.qrId ?? null, opts.purpose, channelUsed, expires, opts.ip ?? null],
  );

  const out: OtpRequestResult = {
    ok: true,
    channelUsed,
    errorCode: null,
    errorMessage: null,
  };
  // Surface the code in dev to make local testing painless. Never in prod.
  if (process.env.NODE_ENV !== "production") out.devCode = code;
  return out;
}

export interface OtpVerifyResult {
  ok: boolean;
  reason: "ok" | "no_code" | "expired" | "too_many_attempts" | "mismatch";
}

export async function verifyOtp(opts: {
  phone: string;
  code: string;
  purpose: string;
  qrId?: string | null;
}): Promise<OtpVerifyResult> {
  const pool = getCommsPool();
  const phoneHash = hashPhone(opts.phone);
  const expectedHash = hashCode(opts.code.trim());

  // Get the most recent unconsumed code for this phone+purpose.
  const { rows } = await pool.query<{
    id: string;
    code_hash: string;
    expires_at: string;
    attempts: number;
  }>(
    `SELECT id, code_hash, expires_at, attempts FROM otp_codes
     WHERE phone_hash = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [phoneHash, opts.purpose],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "no_code" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }
  if (row.code_hash !== expectedHash) {
    await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return { ok: false, reason: "mismatch" };
  }
  await pool.query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [row.id]);
  return { ok: true, reason: "ok" };
}
