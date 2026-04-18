import { supabaseAdmin } from "../lib/supabaseAdmin.js";

/* ── IP2Location API key cache (read from settings table, fallback to env) ── */
let cachedIp2LocationKey: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

async function getIp2LocationKey(): Promise<string> {
  const now = Date.now();
  if (cachedIp2LocationKey !== null && now < cacheExpiresAt) {
    return cachedIp2LocationKey;
  }
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
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    if (!data.country_name) return null;
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
