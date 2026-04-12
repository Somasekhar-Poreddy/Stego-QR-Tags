import { Router, type Request, type Response } from "express";
import { encryptIP, decryptIP } from "../utils/encryption.js";
import { getMaskedIP, getHashedIP } from "../services/ipService.js";
import { getGeoData } from "../services/geoService.js";

const router = Router();

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function makeHeaders(serviceKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey,
    "Prefer": "return=representation",
  };
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

router.post("/track-scan", async (req: Request, res: Response) => {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Server configuration missing" });
    return;
  }

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

  const geo = await getGeoData(ip);

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
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/qr_scans`, {
      method: "POST",
      headers: makeHeaders(serviceKey),
      body: JSON.stringify(row),
    });

    if (!dbRes.ok) {
      const body = await dbRes.json().catch(() => ({})) as { message?: string };
      res.status(500).json({ error: body.message ?? "Failed to save scan" });
      return;
    }

    const saved = await dbRes.json() as { id: string }[];
    res.status(200).json({ id: Array.isArray(saved) ? saved[0]?.id : (saved as unknown as { id: string }).id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

router.put("/track-scan/:id/intent", async (req: Request, res: Response) => {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Server configuration missing" });
    return;
  }

  const { id } = req.params;
  const { intent } = req.body as {
    intent?: string | null;
  };

  if (!id) {
    res.status(400).json({ error: "Scan ID is required" });
    return;
  }

  const updates: Record<string, unknown> = {
    is_request_made: true,
  };
  if (intent !== undefined) updates.intent = intent ?? null;

  try {
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/qr_scans?id=eq.${id}`,
      {
        method: "PATCH",
        headers: makeHeaders(serviceKey),
        body: JSON.stringify(updates),
      },
    );

    if (!dbRes.ok) {
      res.status(500).json({ error: "Failed to update scan" });
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

  const adminRow = !allowedIds.includes(adminId)
    ? await (async () => {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${adminId}&select=role&limit=1`,
          { headers: { "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey } },
        );
        if (!r.ok) return null;
        const d = await r.json() as { role: string }[];
        return d[0] ?? null;
      })()
    : { role: "super_admin" };

  if (!adminRow || adminRow.role !== "super_admin") {
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

  fetch(`${supabaseUrl}/rest/v1/admin_ip_access_logs`, {
    method: "POST",
    headers: makeHeaders(serviceKey),
    body: JSON.stringify({
      admin_id: adminId,
      qr_id: qr_id ?? null,
      scan_id: scan_id ?? null,
    }),
  }).catch(() => {});

  res.status(200).json({ ip: plain_ip });
});

export default router;
