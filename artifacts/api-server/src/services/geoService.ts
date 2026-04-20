import { supabaseAdmin } from "../lib/supabaseAdmin.js";

/* ── IP2Location API key cache (read from settings table, fallback to env) ── */
let cachedIp2LocationKey: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

/* ── Last-known IP2Location key validity (updated whenever fetchFallback runs) ── */
export type Ip2LocationKeyStatus = "ok" | "invalid_key" | "unknown";
let lastIp2LocationKeyStatus: Ip2LocationKeyStatus = "unknown";
export function getIp2LocationKeyStatus(): Ip2LocationKeyStatus {
  return lastIp2LocationKeyStatus;
}

async function getIp2LocationKey(): Promise<string> {
  const now = Date.now();
  if (cachedIp2LocationKey !== null && now < cacheExpiresAt) {
    return cachedIp2LocationKey;
  }
  const previousKey = cachedIp2LocationKey;
  try {
    const { data } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "ip2location_api_key")
      .maybeSingle();
    const dbKey = (data as { value?: string } | null)?.value ?? "";
    cachedIp2LocationKey = dbKey || (process.env.IP2LOCATION_API_KEY ?? "");
  } catch {
    cachedIp2LocationKey = process.env.IP2LOCATION_API_KEY ?? "";
  }
  // Reset the validity status whenever the resolved key actually changes,
  // so a previously-rejected key doesn't keep showing "invalid" after the
  // admin saves a new one.
  if (previousKey !== null && previousKey !== cachedIp2LocationKey) {
    lastIp2LocationKeyStatus = "unknown";
  }
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedIp2LocationKey;
}

export interface GeoData {
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

const NULL_GEO: GeoData = {
  city: null, state: null, country: null, pincode: null,
  latitude: null, longitude: null, timezone: null,
};

async function fetchPrimary(ip: string): Promise<GeoData | null> {
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    if (!data.countryName) return null;
    return {
      city: (data.cityName as string) || null,
      state: (data.regionName as string) || null,
      country: (data.countryName as string) || null,
      pincode: (data.zipCode as string) || null,
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
      timezone: (data.timeZone as string) || null,
    };
  } catch {
    return null;
  }
}

async function fetchFallback(ip: string): Promise<GeoData | null> {
  try {
    const key = await getIp2LocationKey();
    const url = key
      ? `https://api.ip2location.io/?key=${key}&ip=${ip}`
      : `https://api.ip2location.io/?ip=${ip}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    // 401/403 from IP2Location indicates an invalid/revoked key
    if (key && (res.status === 401 || res.status === 403)) {
      lastIp2LocationKeyStatus = "invalid_key";
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    // IP2Location.io returns { error: { error_code, error_message } } on auth failures.
    // error_code 10000 = invalid API key.
    const errObj = data.error as { error_code?: number } | undefined;
    if (key && errObj?.error_code === 10000) {
      lastIp2LocationKeyStatus = "invalid_key";
      return null;
    }
    if (!data.country_name) return null;
    if (key) lastIp2LocationKeyStatus = "ok";
    return {
      city: (data.city_name as string) || null,
      state: (data.region_name as string) || null,
      country: (data.country_name as string) || null,
      pincode: (data.zip_code as string) || null,
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
      timezone: (data.time_zone as string) || null,
    };
  } catch {
    return null;
  }
}

export async function getGeoData(ip: string): Promise<GeoData> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return NULL_GEO;
  }

  const primary = await fetchPrimary(ip);
  if (primary) return primary;

  const fallback = await fetchFallback(ip);
  if (fallback) return fallback;

  return NULL_GEO;
}
