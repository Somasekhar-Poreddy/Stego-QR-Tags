import crypto from "node:crypto";
import { logger } from "../lib/logger.js";
import { getCommsSettings } from "./commsCredentials.js";

export interface ZavuSendResult {
  ok: boolean;
  providerMessageId: string | null;
  status: "queued" | "sent" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  raw?: unknown;
}

interface SendArgs {
  to: string;             // E.164
  body?: string;          // plain text fallback
  templateName?: string;  // approved template name (preferred for utility/auth)
  templateLang?: string;  // e.g. "en"
  templateParams?: string[];
}

const DEFAULT_BASE_URL = "https://api.zavu.in/v1";

function getBaseUrl(): string {
  return (process.env.ZAVU_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

export async function isZavuConfigured(): Promise<boolean> {
  const s = await getCommsSettings();
  return Boolean(s.zavu_api_key && s.zavu_account_id && s.zavu_phone_number_id);
}

export async function sendWhatsAppViaZavu(args: SendArgs): Promise<ZavuSendResult> {
  const s = await getCommsSettings();
  if (!s.zavu_api_key || !s.zavu_account_id || !s.zavu_phone_number_id) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "ZAVU_NOT_CONFIGURED",
      errorMessage: "Zavu credentials are missing.",
    };
  }

  const url = `${getBaseUrl()}/accounts/${encodeURIComponent(s.zavu_account_id)}/messages`;

  const payload: Record<string, unknown> = {
    phone_number_id: s.zavu_phone_number_id,
    to: args.to,
  };

  if (args.templateName) {
    payload.type = "template";
    payload.template = {
      name: args.templateName,
      language: { code: args.templateLang ?? s.zavu_otp_template_lang ?? "en" },
      components: args.templateParams && args.templateParams.length > 0
        ? [{
            type: "body",
            parameters: args.templateParams.map((text) => ({ type: "text", text })),
          }]
        : [],
    };
  } else {
    payload.type = "text";
    payload.text = { body: args.body ?? "" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.zavu_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const err = json.error as { code?: string; message?: string } | undefined;
      return {
        ok: false,
        providerMessageId: null,
        status: "failed",
        errorCode: err?.code ?? `HTTP_${res.status}`,
        errorMessage: err?.message ?? `Zavu HTTP ${res.status}`,
        raw: json,
      };
    }
    const msgId = (json.message_id as string)
      ?? ((json.messages as Array<{ id?: string }> | undefined)?.[0]?.id ?? null);
    return {
      ok: true,
      providerMessageId: msgId ?? null,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      raw: json,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Zavu error";
    logger.warn({ err: message }, "Zavu send failed");
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "ZAVU_NETWORK",
      errorMessage: message,
    };
  }
}

/**
 * Lightweight credential probe used by the admin "Test connection" button.
 * Issues a tiny GET that requires only auth — never sends a message.
 */
export async function probeZavuCredentials(): Promise<{ ok: boolean; status: number; error: string | null }> {
  const s = await getCommsSettings();
  if (!s.zavu_api_key || !s.zavu_account_id) {
    return { ok: false, status: 0, error: "Missing API key or account id." };
  }
  const url = `${getBaseUrl()}/accounts/${encodeURIComponent(s.zavu_account_id)}/phone-numbers`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${s.zavu_api_key}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return { ok: true, status: res.status, error: null };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "Zavu rejected the credentials." };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error." };
  }
}

/**
 * Verify a Zavu webhook signature. Zavu (and most modern webhook providers)
 * sign payloads with HMAC-SHA256 of the raw body using the shared secret.
 * We accept either an X-Zavu-Signature or X-Hub-Signature-256 header.
 *
 * If no secret is configured, we accept the webhook but return `unsigned`,
 * which the caller can log.
 */
export async function verifyZavuSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<{ ok: boolean; reason: "ok" | "missing_secret" | "missing_header" | "mismatch" }> {
  const s = await getCommsSettings();
  const secret = (s.zavu_webhook_secret ?? "").trim();
  // Fail closed: refuse to process webhooks while no secret is configured.
  // Otherwise anyone could POST forged status events and corrupt message logs.
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_header" };
  const provided = signatureHeader.replace(/^sha256=/, "").trim().toLowerCase();
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const ok = provided.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    return { ok, reason: ok ? "ok" : "mismatch" };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}
