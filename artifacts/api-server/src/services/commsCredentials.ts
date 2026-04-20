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
  "zavu_account_id",
  "zavu_phone_number_id",
  "zavu_otp_template_name",
  "zavu_otp_template_lang",
  "zavu_webhook_secret",
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
  // Feature flags
  "feature_otp_required",
  "feature_calls_enabled",
  "feature_messages_enabled",
  "feature_whatsapp_enabled",
] as const;

export type CommsSettingKey = (typeof COMMS_SETTING_KEYS)[number];

const DEFAULTS: Record<string, string> = {
  zavu_otp_template_lang: "en",
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
  feature_calls_enabled: "true",
  feature_messages_enabled: "true",
  feature_whatsapp_enabled: "true",
};

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
