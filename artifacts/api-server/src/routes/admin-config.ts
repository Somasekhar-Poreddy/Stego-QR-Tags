import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getIp2LocationKeyStatus } from "../services/geoService.js";

const router: IRouter = Router();

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

async function requireSuperAdmin(
  req: Request,
  res: Response,
): Promise<string | null> {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return null;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Server configuration missing" });
    return null;
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: serviceRoleKey,
    },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  const userData = (await userRes.json()) as { id?: string };
  const userId = userData.id;
  if (!userId) {
    res.status(401).json({ error: "Could not identify user" });
    return null;
  }

  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowedIds.includes(userId)) return userId;

  const { data: adminRow } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (adminRow as { role?: string } | null)?.role ?? null;
  if (role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can access this endpoint" });
    return null;
  }

  return userId;
}

router.get("/admin/config-status", async (req: Request, res: Response) => {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  let dbIp2LocationKey = "";
  try {
    const { data } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "ip2location_api_key")
      .maybeSingle();
    dbIp2LocationKey = ((data as { value?: string } | null)?.value ?? "").trim();
  } catch {
    dbIp2LocationKey = "";
  }
  const envIp2LocationKey = (process.env.IP2LOCATION_API_KEY ?? "").trim();

  const ip2locationKeySet = Boolean(dbIp2LocationKey || envIp2LocationKey);
  const ip2locationKeyStatus = ip2locationKeySet ? getIp2LocationKeyStatus() : "unknown";

  res.status(200).json({
    ip_encryption_key_set: Boolean((process.env.IP_ENCRYPTION_KEY ?? "").trim()),
    resend_api_key_set: Boolean((process.env.RESEND_API_KEY ?? "").trim()),
    ip2location_api_key_set: ip2locationKeySet,
    ip2location_api_key_status: ip2locationKeyStatus,
  });
});

export default router;
