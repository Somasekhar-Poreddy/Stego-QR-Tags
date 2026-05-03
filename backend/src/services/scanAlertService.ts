import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { getCommsSettings } from "./commsCredentials.js";
import { sendWhatsAppSmart } from "./commsRouter.js";
import { consumeRateBucket } from "./rateLimitDb.js";

export async function maybeSendScanAlert(opts: {
  qrId: string;
  city: string | null;
  timestamp: Date;
}): Promise<void> {
  const { data: qr } = await supabaseAdmin
    .from("qr_codes")
    .select("id, type, data, whatsapp_enabled, emergency_contact, user_id")
    .eq("id", opts.qrId)
    .single();
  if (!qr || !qr.whatsapp_enabled) return;

  const ownerPhone = pickOwnerPhone(qr);
  if (!ownerPhone) return;

  const settings = await getCommsSettings();
  const cooldown = Number(settings.scan_alert_cooldown_sec) || 300;
  const hourlyMax = Number(settings.scan_alert_max_per_qr_per_hour) || 5;

  const cooldownBucket = await consumeRateBucket({
    key: `scan_alert_cd:${opts.qrId}`,
    limit: 1,
    windowSeconds: cooldown,
  });
  if (!cooldownBucket.allowed) return;

  const hourlyBucket = await consumeRateBucket({
    key: `scan_alert_hr:${opts.qrId}`,
    limit: hourlyMax,
    windowSeconds: 3600,
  });
  if (!hourlyBucket.allowed) return;

  const templateId = settings.zavu_scan_alert_template_id?.trim();
  if (!templateId) return;

  const qrName = getQrLabel(qr);
  const timeStr = opts.timestamp.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const location = opts.city || "Unknown location";

  const result = await sendWhatsAppSmart({
    to: ownerPhone,
    body: `Your StegoTags QR "${qrName}" was scanned at ${timeStr} from ${location}.`,
    template: { id: templateId, variables: { "1": qrName, "2": timeStr, "3": location } },
    qrId: opts.qrId,
  });

  if (!result.ok) {
    logger.warn({ qrId: opts.qrId, error: result.errorCode }, "Scan alert delivery failed");
  }
}

function pickOwnerPhone(qr: { emergency_contact?: string | null; data?: Record<string, unknown> | null }): string | null {
  if (qr.emergency_contact) return qr.emergency_contact;
  const d = (qr.data ?? {}) as Record<string, unknown>;
  for (const k of ["contact_phone", "owner_phone", "phone", "emergency_contact_1"]) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function getQrLabel(qr: { type?: string | null; data?: Record<string, unknown> | null }): string {
  const d = (qr.data ?? {}) as Record<string, unknown>;
  const name = d.name ?? d.vehicle_number ?? d.registration_number;
  if (typeof name === "string" && name.trim()) return name.trim();
  return qr.type ?? "tag";
}
