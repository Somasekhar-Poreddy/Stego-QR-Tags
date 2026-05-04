import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  values: Record<string, string>;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<Record<string, string>> | null = null;

/**
 * All settings keys consumed by the comms platform.
 * Keep this list authoritative — the cache fetch is keyed on it.
 */
export const COMMS_SETTING_KEYS = [
  // Zavu (WhatsApp primary)
  "zavu_api_key",
  "zavu_sender_id",
  "zavu_webhook_secret",
  "zavu_otp_template_id",
  "zavu_vehicle_report_template_id",
  "zavu_scan_alert_template_id",
  "scan_alert_cooldown_sec",
  "scan_alert_max_per_qr_per_hour",
  // Exotel (SMS, masked-call, WhatsApp fallback)
  "exotel_api_key",
  "exotel_api_token",
  "exotel_sid",
  "exotel_subdomain",
  "exotel_caller_id",
  "exotel_webhook_secret",
  // Routing
  "comms_routing_whatsapp",
  "comms_routing_sms",
  "comms_routing_call",
  "comms_otp_channel",
  // Cost & rate
  "comms_cost_cap_inr_per_day",
  "comms_cost_warn_threshold_inr_per_day",
  "comms_tariff_whatsapp_paise",
  "comms_tariff_sms_paise",
  "comms_tariff_call_paise_per_min",
  "comms_max_otp_per_phone_per_hour",
  "comms_max_call_per_phone_per_hour",
  "comms_max_messages_per_phone_per_hour",
  // Feature flags — canonical spec keys are the unprefixed forms
  // (`masked_call_enabled`, `whatsapp_enabled`, `sms_enabled`); the
  // `feature_*_enabled` keys are accepted as legacy aliases for backward
  // compatibility with the older admin UI.
  "feature_otp_required",
  "masked_call_enabled",
  "whatsapp_enabled",
  "sms_enabled",
  "feature_calls_enabled",
  "feature_messages_enabled",
  "feature_whatsapp_enabled",
  // Communication Settings (spec § Admin → Settings)
  "wa_delivery_timeout_sec",
  "comms_retry_attempts",
  "call_max_duration_sec",
  "call_cooldown_sec",
  "calls_per_qr_per_hour",
  "call_recording_enabled",
  // Cost control — monthly budget in paise + over-budget behavior
  "monthly_budget_paise",
  "over_budget_behavior",
] as const;

export type CommsSettingKey = (typeof COMMS_SETTING_KEYS)[number];

const DEFAULTS: Record<string, string> = {
  scan_alert_cooldown_sec: "300",
  scan_alert_max_per_qr_per_hour: "5",
  comms_routing_whatsapp: "zavu_first",
  comms_routing_sms: "exotel",
  comms_routing_call: "exotel",
  comms_otp_channel: "whatsapp_first",
  comms_cost_cap_inr_per_day: "500",
  comms_cost_warn_threshold_inr_per_day: "350",
  comms_tariff_whatsapp_paise: "75",
  comms_tariff_sms_paise: "20",
  comms_tariff_call_paise_per_min: "150",
  comms_max_otp_per_phone_per_hour: "5",
  comms_max_call_per_phone_per_hour: "10",
  comms_max_messages_per_phone_per_hour: "20",
  feature_otp_required: "true",
  masked_call_enabled: "true",
  whatsapp_enabled: "true",
  sms_enabled: "true",
  feature_calls_enabled: "true",
  feature_messages_enabled: "true",
  feature_whatsapp_enabled: "true",
  wa_delivery_timeout_sec: "10",
  comms_retry_attempts: "1",
  call_max_duration_sec: "60",
  call_cooldown_sec: "60",
  call_recording_enabled: "false",
  calls_per_qr_per_hour: "2",
  monthly_budget_paise: "0",
  over_budget_behavior: "calls_only",
};

/**
 * Read a feature flag honoring the canonical key first and falling back to
 * any legacy aliases. Returns true when *all* configured keys are on so that
 * disabling either the canonical or legacy key actually disables the feature.
 */
export function flagOn(
  settings: Record<string, string>,
  ...keys: string[]
): boolean {
  let any = false;
  for (const k of keys) {
    const v = settings[k];
    if (v == null) continue;
    any = true;
    if (!isFlagOn(v)) return false;
  }
  // If no key is set at all, default to "on" (matches earlier behavior).
  return any || true;
}

async function fetchAll(): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .in("key", COMMS_SETTING_KEYS as unknown as string[]);
  if (error) {
    // Fail soft — return defaults so credentials simply read as empty.
    return { ...DEFAULTS };
  }
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
    if (row.value != null && row.value !== "") map[row.key] = row.value;
  }
  return map;
}

export async function getCommsSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) return cache.values;
  if (inFlight) return inFlight;
  inFlight = fetchAll()
    .then((values) => {
      cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
      return values;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export async function getCommsSetting(key: CommsSettingKey | string): Promise<string> {
  const all = await getCommsSettings();
  return all[key] ?? "";
}

export function invalidateCommsCache(): void {
  cache = null;
}

export function isFlagOn(value: string): boolean {
  return value === "true" || value === "1" || value.toLowerCase() === "on";
}
