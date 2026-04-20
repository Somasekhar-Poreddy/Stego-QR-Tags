import { Router, type IRouter, type Request, type Response } from "express";
import { getCommsPool } from "../lib/migrations.js";
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
  if (!sig.ok) {
    logger.warn({ reason: sig.reason }, "Exotel webhook signature rejected");
    const status = sig.reason === "missing_secret" ? 503 : 401;
    res.status(status).json({
      error: sig.reason === "missing_secret"
        ? "Webhook secret is not configured. Set exotel_webhook_secret in admin settings."
        : "Invalid signature",
    });
    return;
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

export default router;
