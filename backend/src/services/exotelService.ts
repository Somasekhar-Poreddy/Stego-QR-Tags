import crypto from "node:crypto";
import { logger } from "../lib/logger.js";
import { getCommsSettings } from "./commsCredentials.js";

const WEBHOOK_BASE = (process.env.RENDER_EXTERNAL_URL ?? process.env.VITE_APP_URL ?? "").replace(/\/+$/, "");

export interface ExotelSendResult {
  ok: boolean;
  providerMessageId: string | null;
  status: "queued" | "sent" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  raw?: unknown;
}

export interface ExotelCallResult {
  ok: boolean;
  providerCallId: string | null;
  status: "initiated" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  raw?: unknown;
}

function getBaseUrl(subdomain: string): string {
  // Exotel API is regional; the subdomain typically encodes that
  // (e.g. "api.in.exotel.com" or "api.exotel.com").
  if (!subdomain) return "https://api.exotel.com";
  const trimmed = subdomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${trimmed}`;
}

function authHeader(apiKey: string, apiToken: string): string {
  return "Basic " + Buffer.from(`${apiKey}:${apiToken}`).toString("base64");
}

export async function isExotelConfigured(): Promise<boolean> {
  const s = await getCommsSettings();
  return Boolean(s.exotel_api_key && s.exotel_api_token && s.exotel_sid);
}

export async function sendSmsViaExotel(args: { to: string; body: string }): Promise<ExotelSendResult> {
  const s = await getCommsSettings();
  if (!s.exotel_api_key || !s.exotel_api_token || !s.exotel_sid || !s.exotel_caller_id) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "EXOTEL_NOT_CONFIGURED",
      errorMessage: "Exotel credentials or sender id missing.",
    };
  }

  const base = getBaseUrl(s.exotel_subdomain);
  const url = `${base}/v1/Accounts/${encodeURIComponent(s.exotel_sid)}/Sms/send.json`;

  const form = new URLSearchParams();
  form.set("From", s.exotel_caller_id);
  form.set("To", args.to);
  form.set("Body", args.body);
  if (WEBHOOK_BASE) form.set("StatusCallback", `${WEBHOOK_BASE}/api/webhooks/exotel/status`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(s.exotel_api_key, s.exotel_api_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        providerMessageId: null,
        status: "failed",
        errorCode: `HTTP_${res.status}`,
        errorMessage: typeof json.error === "string" ? json.error : `Exotel HTTP ${res.status}`,
        raw: json,
      };
    }
    const sms = (json.SMSMessage as { Sid?: string } | undefined) ?? null;
    return {
      ok: true,
      providerMessageId: sms?.Sid ?? null,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      raw: json,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Exotel error";
    logger.warn({ err: message }, "Exotel SMS send failed");
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "EXOTEL_NETWORK",
      errorMessage: message,
    };
  }
}

/** WhatsApp via Exotel (used as fallback when Zavu fails). */
export async function sendWhatsAppViaExotel(args: { to: string; body: string }): Promise<ExotelSendResult> {
  const s = await getCommsSettings();
  if (!s.exotel_api_key || !s.exotel_api_token || !s.exotel_sid) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "EXOTEL_NOT_CONFIGURED",
      errorMessage: "Exotel credentials missing.",
    };
  }
  const base = getBaseUrl(s.exotel_subdomain);
  const url = `${base}/v2/accounts/${encodeURIComponent(s.exotel_sid)}/messages`;
  const body = {
    channel: "whatsapp",
    from: s.exotel_caller_id,
    to: args.to,
    content: { type: "text", text: args.body },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(s.exotel_api_key, s.exotel_api_token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        providerMessageId: null,
        status: "failed",
        errorCode: `HTTP_${res.status}`,
        errorMessage: `Exotel WhatsApp HTTP ${res.status}`,
        raw: json,
      };
    }
    const id = (json.id as string) ?? (json.message_id as string) ?? null;
    return {
      ok: true,
      providerMessageId: id,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      raw: json,
    };
  } catch (err) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "EXOTEL_NETWORK",
      errorMessage: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Connect a masked call between two parties using Exotel "Connect" API.
 * Number masking is provided by the platform.
 */
export async function connectCallViaExotel(args: {
  fromPhone: string; // requester
  toPhone: string;   // owner
  /** Hard duration cap in seconds (Exotel TimeLimit). Defaults to 60. */
  maxDurationSec?: number;
}): Promise<ExotelCallResult> {
  const s = await getCommsSettings();
  if (!s.exotel_api_key || !s.exotel_api_token || !s.exotel_sid || !s.exotel_caller_id) {
    return {
      ok: false,
      providerCallId: null,
      status: "failed",
      errorCode: "EXOTEL_NOT_CONFIGURED",
      errorMessage: "Exotel credentials or caller id missing.",
    };
  }
  const base = getBaseUrl(s.exotel_subdomain);
  const url = `${base}/v1/Accounts/${encodeURIComponent(s.exotel_sid)}/Calls/connect.json`;

  const form = new URLSearchParams();
  form.set("From", args.fromPhone);
  form.set("To", args.toPhone);
  form.set("CallerId", s.exotel_caller_id);
  form.set("CallType", "trans");
  form.set("TimeLimit", String(Math.max(15, Math.min(args.maxDurationSec ?? 60, 600))));
  form.set("Record", "false");
  if (WEBHOOK_BASE) form.set("StatusCallback", `${WEBHOOK_BASE}/api/webhooks/exotel/status`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(s.exotel_api_key, s.exotel_api_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        providerCallId: null,
        status: "failed",
        errorCode: `HTTP_${res.status}`,
        errorMessage: typeof json.error === "string" ? json.error : `Exotel HTTP ${res.status}`,
        raw: json,
      };
    }
    const call = (json.Call as { Sid?: string } | undefined) ?? null;
    return {
      ok: true,
      providerCallId: call?.Sid ?? null,
      status: "initiated",
      errorCode: null,
      errorMessage: null,
      raw: json,
    };
  } catch (err) {
    return {
      ok: false,
      providerCallId: null,
      status: "failed",
      errorCode: "EXOTEL_NETWORK",
      errorMessage: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/** Disconnect a live Exotel call. Used by scheduled disconnect / restart-flush. */
export async function disconnectExotelCall(callSid: string): Promise<{ ok: boolean; error: string | null }> {
  const s = await getCommsSettings();
  if (!s.exotel_api_key || !s.exotel_api_token || !s.exotel_sid) {
    return { ok: false, error: "Exotel credentials missing." };
  }
  const base = getBaseUrl(s.exotel_subdomain);
  const url = `${base}/v1/Accounts/${encodeURIComponent(s.exotel_sid)}/Calls/${encodeURIComponent(callSid)}.json`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: authHeader(s.exotel_api_key, s.exotel_api_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "completed" }).toString(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export async function probeExotelCredentials(): Promise<{ ok: boolean; status: number; error: string | null }> {
  const s = await getCommsSettings();
  if (!s.exotel_api_key || !s.exotel_api_token || !s.exotel_sid) {
    return { ok: false, status: 0, error: "Missing credentials." };
  }
  const base = getBaseUrl(s.exotel_subdomain);
  const url = `${base}/v1/Accounts/${encodeURIComponent(s.exotel_sid)}.json`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: authHeader(s.exotel_api_key, s.exotel_api_token) },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return { ok: true, status: res.status, error: null };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "Exotel rejected the credentials." };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error." };
  }
}

export async function verifyExotelSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<{ ok: boolean; reason: "ok" | "missing_secret" | "missing_header" | "mismatch" }> {
  const s = await getCommsSettings();
  const secret = (s.exotel_webhook_secret ?? "").trim();
  // Fail closed: refuse to process webhooks while no secret is configured.
  // Otherwise anyone could POST forged status events and corrupt logs.
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_header" };
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "").trim().toLowerCase();
  try {
    const ok = provided.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    return { ok, reason: ok ? "ok" : "mismatch" };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}
