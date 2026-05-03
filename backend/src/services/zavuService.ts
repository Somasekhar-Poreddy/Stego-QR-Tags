import crypto from "node:crypto";
import Zavudev, { APIError } from "@zavudev/sdk";
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
  to: string;
  body?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  senderId?: string;
}

let cachedClient: { key: string; client: Zavudev } | null = null;

async function getClient(): Promise<Zavudev | null> {
  const s = await getCommsSettings();
  if (!s.zavu_api_key) return null;
  if (cachedClient?.key === s.zavu_api_key) return cachedClient.client;
  const client = new Zavudev({ apiKey: s.zavu_api_key });
  cachedClient = { key: s.zavu_api_key, client };
  return client;
}

export async function isZavuConfigured(): Promise<boolean> {
  const s = await getCommsSettings();
  return Boolean(s.zavu_api_key && s.zavu_sender_id);
}

export async function sendWhatsAppViaZavu(args: SendArgs): Promise<ZavuSendResult> {
  const client = await getClient();
  const s = await getCommsSettings();
  if (!client || !s.zavu_sender_id) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorCode: "ZAVU_NOT_CONFIGURED",
      errorMessage: "Zavu API key or sender ID is missing.",
    };
  }

  const senderId = args.senderId ?? s.zavu_sender_id;

  try {
    const response = args.templateId
      ? await client.messages.send({
          to: args.to,
          channel: "whatsapp",
          messageType: "template",
          content: {
            templateId: args.templateId,
            templateVariables: args.templateVariables ?? {},
          },
          "Zavu-Sender": senderId,
        })
      : await client.messages.send({
          to: args.to,
          channel: "whatsapp",
          text: args.body ?? "",
          "Zavu-Sender": senderId,
        });

    return {
      ok: true,
      providerMessageId: response.message.id,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      raw: response,
    };
  } catch (err) {
    if (err instanceof APIError) {
      return {
        ok: false,
        providerMessageId: null,
        status: "failed",
        errorCode: String(err.status),
        errorMessage: err.message,
        raw: err,
      };
    }
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

export async function probeZavuCredentials(): Promise<{ ok: boolean; status: number; error: string | null }> {
  const client = await getClient();
  if (!client) return { ok: false, status: 0, error: "Missing API key." };
  try {
    await client.senders.list({ limit: 1 });
    return { ok: true, status: 200, error: null };
  } catch (err) {
    if (err instanceof APIError) return { ok: false, status: err.status ?? 0, error: err.message };
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error." };
  }
}

/**
 * Verify Zavu webhook signature.
 * Header format: X-Zavu-Signature: t=<unix_ts>,v1=<hex_hmac>
 * Signed payload: `${timestamp}.${rawBody}`
 * Timestamp older than 5 minutes is rejected (replay protection).
 */
export async function verifyZavuSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<{ ok: boolean; reason: "ok" | "missing_secret" | "missing_header" | "stale" | "mismatch" }> {
  const s = await getCommsSettings();
  const secret = (s.zavu_webhook_secret ?? "").trim();
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_header" };

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const vPart = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !vPart) return { ok: false, reason: "missing_header" };

  const timestamp = parseInt(tPart.slice(2), 10);
  const provided = vPart.slice(3).toLowerCase();
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "missing_header" };

  if (Math.floor(Date.now() / 1000) - timestamp > 300) return { ok: false, reason: "stale" };

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  try {
    const ok = provided.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    return { ok, reason: ok ? "ok" : "mismatch" };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}
