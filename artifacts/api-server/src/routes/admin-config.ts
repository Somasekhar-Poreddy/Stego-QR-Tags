import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getIp2LocationKeyStatus } from "../services/geoService.js";
import { getFromEmail, isCustomFromDomain, sendVendorEmail, isEmailConfigured } from "../services/emailService.js";
import { isZavuConfigured } from "../services/zavuService.js";
import { isExotelConfigured } from "../services/exotelService.js";
import { getMonthCostPaise, monthlyBudgetState } from "../services/commsRouter.js";
import { getCommsSettings } from "../services/commsCredentials.js";

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

router.post("/admin/send-test-email", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const callerId = await requireSuperAdmin(req, res);
  if (!callerId) return;

  if (!isEmailConfigured()) {
    res.status(400).json({ error: "RESEND_API_KEY is not configured." });
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Could not look up admin email" });
    return;
  }
  const userData = (await userRes.json()) as { email?: string };
  const adminEmail = userData.email?.trim();
  if (!adminEmail) {
    res.status(400).json({ error: "No email address found on your admin account" });
    return;
  }

  const fromEmail = getFromEmail();
  const sentAt = new Date().toISOString();
  const html = `
    <p>Hi,</p>
    <p>This is a test email from your Stegofy admin dashboard, sent to confirm
    that the configured sending address is working correctly.</p>
    <p>
      <strong>Sending address:</strong> <code>${fromEmail}</code><br />
      <strong>Sent at:</strong> ${sentAt}
    </p>
    <p>If you received this message, domain verification and Resend delivery
    are working as expected.</p>
  `;

  try {
    await sendVendorEmail({
      to: adminEmail,
      subject: "Stegofy: test email from Settings",
      html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send test email";
    res.status(500).json({ error: message });
    return;
  }

  res.status(200).json({ success: true, sent_to: adminEmail, from: fromEmail });
});

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

  // Comms platform config snapshot — used by the dashboard to surface
  // misconfiguration warnings ("Zavu not configured", "over monthly budget"…)
  // without forcing every screen to call the heavier /admin/comms/health.
  let zavuConfigured = false;
  let exotelConfigured = false;
  let monthSpendPaise = 0;
  let monthlyBudgetPaise = 0;
  let overBudgetBehavior = "calls_only";
  let overBudget = false;
  try {
    const [zc, ec, ms, bs, settings] = await Promise.all([
      isZavuConfigured(),
      isExotelConfigured(),
      getMonthCostPaise(),
      monthlyBudgetState(),
      getCommsSettings(),
    ]);
    zavuConfigured = zc;
    exotelConfigured = ec;
    monthSpendPaise = ms;
    monthlyBudgetPaise = Number(settings.monthly_budget_paise) || 0;
    overBudgetBehavior = settings.over_budget_behavior ?? "calls_only";
    overBudget = bs !== "ok";
  } catch {
    // Comms DB may be down independently of the API. Degrade gracefully —
    // the dashboard treats missing fields as "unknown" rather than failing.
  }

  res.status(200).json({
    ip_encryption_key_set: Boolean((process.env.IP_ENCRYPTION_KEY ?? "").trim()),
    resend_api_key_set: Boolean((process.env.RESEND_API_KEY ?? "").trim()),
    resend_from_email: getFromEmail(),
    resend_custom_domain: isCustomFromDomain(),
    ip2location_api_key_set: ip2locationKeySet,
    ip2location_api_key_status: ip2locationKeyStatus,
    zavu_configured: zavuConfigured,
    exotel_configured: exotelConfigured,
    current_month_spend_paise: monthSpendPaise,
    monthly_budget_paise: monthlyBudgetPaise,
    over_budget: overBudget,
    over_budget_behavior: overBudgetBehavior,
  });
});

export default router;
