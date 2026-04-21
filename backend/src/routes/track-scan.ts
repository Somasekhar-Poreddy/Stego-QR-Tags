import { Router, type Request, type Response } from "express";
import { encryptIP, decryptIP } from "../utils/encryption.js";
import { getMaskedIP, getHashedIP } from "../services/ipService.js";
import { getGeoData } from "../services/geoService.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { publicScanLimiter } from "../middlewares/rate-limit.js";

const router = Router();

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const lower = ua.toLowerCase();

  let device = "desktop";
  if (/mobile|android(?!.*tablet)|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    device = "mobile";
  } else if (/tablet|ipad/i.test(ua)) {
    device = "tablet";
  }

  let browser = "Other";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\/(?!.*chromium)/i.test(ua)) browser = "Chrome";
  else if (/safari\/(?!.*chrome)/i.test(ua)) browser = "Safari";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  let os = "Other";
  if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ipod")) os = "iOS";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";

  return { device, browser, os };
}

router.post("/track-scan", publicScanLimiter, async (req: Request, res: Response) => {
  const { qr_id, session_id, referrer, user_id } = req.body as {
    qr_id?: string;
    session_id?: string;
    referrer?: string;
    user_id?: string;
  };

  if (!qr_id) {
    res.status(400).json({ error: "qr_id is required" });
    return;
  }

  const rawIp = (req.headers["x-forwarded-for"] as string | undefined) ?? req.socket.remoteAddress ?? "";
  const ip = rawIp.split(",")[0].trim();

  const ua = req.headers["user-agent"] ?? "";
  const { device, browser, os } = parseUserAgent(ua);

  let masked_ip: string;
  let hashed_ip: string;
  let encrypted_ip: string | null;

  try {
    masked_ip = getMaskedIP(ip);
    hashed_ip = getHashedIP(ip);
    encrypted_ip = ip ? encryptIP(ip) : null;
  } catch {
    masked_ip = "unknown";
    hashed_ip = "";
    encrypted_ip = null;
  }

  const [geo] = await Promise.all([
    getGeoData(ip),
  ]);

  const row = {
    qr_id,
    user_id: user_id ?? null,
    masked_ip,
    hashed_ip,
    encrypted_ip,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    pincode: geo.pincode,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    device,
    browser,
    os,
    referrer: referrer ?? null,
    session_id: session_id ?? null,
    intent: null,
    is_request_made: false,
  };

  try {
    const { data: saved, error: dbError } = await supabaseAdmin
      .from("qr_scans")
      .insert(row)
      .select("id")
      .single();

    if (dbError || !saved) {
      res.status(500).json({ error: dbError?.message ?? "Failed to save scan" });
      return;
    }

    res.status(200).json({ id: (saved as { id: string }).id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

router.put("/track-scan/:id/intent", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { intent, is_request_made } = req.body as {
    intent?: string | null;
    is_request_made?: boolean;
  };

  if (!id) {
    res.status(400).json({ error: "Scan ID is required" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (intent !== undefined) updates.intent = intent ?? null;
  if (is_request_made === true) updates.is_request_made = true;

  try {
    const { error: dbError } = await supabaseAdmin
      .from("qr_scans")
      .update(updates)
      .eq("id", id);

    if (dbError) {
      res.status(500).json({ error: dbError.message ?? "Failed to update scan" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

router.post("/admin/decrypt-ip", async (req: Request, res: Response) => {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Server configuration missing" });
    return;
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  // Validate the caller's JWT via Auth REST — raw fetch is correct here since
  // we're verifying an arbitrary user token, not using the service-role session.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  const userData = await userRes.json() as { id?: string };
  const adminId = userData.id;
  if (!adminId) {
    res.status(401).json({ error: "Could not identify admin" });
    return;
  }

  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",").map((id) => id.trim()).filter(Boolean);

  let adminRole = allowedIds.includes(adminId) ? "super_admin" : null;
  if (!adminRole) {
    const { data: adminRow } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", adminId)
      .maybeSingle();
    adminRole = (adminRow as { role?: string } | null)?.role ?? null;
  }

  if (!adminRole || adminRole !== "super_admin") {
    res.status(403).json({ error: "Only super admins can view full IPs" });
    return;
  }

  const { encrypted_ip, qr_id, scan_id } = req.body as {
    encrypted_ip?: string;
    qr_id?: string;
    scan_id?: string;
  };

  if (!encrypted_ip) {
    res.status(400).json({ error: "encrypted_ip is required" });
    return;
  }

  let plain_ip: string;
  try {
    plain_ip = decryptIP(encrypted_ip);
  } catch {
    res.status(400).json({ error: "Failed to decrypt IP — invalid format or wrong key" });
    return;
  }

  // Fire-and-forget audit log via supabaseAdmin SDK
  void (async () => {
    try {
      await supabaseAdmin
        .from("admin_ip_access_logs")
        .insert({
          admin_id: adminId,
          qr_id: qr_id ?? null,
          scan_id: scan_id ?? null,
        });
    } catch {
      // Intentionally silent — audit logging failure must not break the response
    }
  })();

  res.status(200).json({ ip: plain_ip });
});

export default router;
