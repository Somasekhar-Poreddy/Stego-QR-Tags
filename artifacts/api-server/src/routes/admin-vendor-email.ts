import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendVendorEmail, isEmailConfigured } from "../services/emailService.js";

const router: IRouter = Router();

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

async function requireSuperAdmin(req: Request, res: Response): Promise<string | null> {
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
    headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
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
    .split(",").map((id) => id.trim()).filter(Boolean);
  if (allowedIds.includes(userId)) return userId;

  const { data: adminRow } = await supabaseAdmin
    .from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  const role = (adminRow as { role?: string } | null)?.role ?? null;
  if (role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can send vendor emails" });
    return null;
  }
  return userId;
}

router.get("/admin/email-status", async (req: Request, res: Response) => {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;
  res.status(200).json({ configured: isEmailConfigured() });
});

router.post("/admin/send-vendor-email", async (req: Request, res: Response) => {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  const { batchId, to, subject, html, attachPdf, pdfBase64, pdfFilename } = req.body as {
    batchId?: string;
    to?: string;
    subject?: string;
    html?: string;
    attachPdf?: boolean;
    pdfBase64?: string;
    pdfFilename?: string;
  };

  if (!to?.trim() || !subject?.trim() || !html?.trim()) {
    res.status(400).json({ error: "to, subject, and html are required" });
    return;
  }
  if (!batchId) {
    res.status(400).json({ error: "batchId is required" });
    return;
  }

  try {
    await sendVendorEmail({
      to: to.trim(),
      subject: subject.trim(),
      html,
      pdfBase64: attachPdf && pdfBase64 ? pdfBase64 : undefined,
      pdfFilename: attachPdf && pdfFilename ? pdfFilename : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    res.status(500).json({ error: message });
    return;
  }

  // Record event on each inventory item in the batch
  try {
    const { data: items } = await supabaseAdmin
      .from("qr_inventory")
      .select("id")
      .eq("batch_id", batchId);

    if (items && items.length > 0) {
      await supabaseAdmin.from("qr_inventory_events").insert(
        (items as Array<{ id: string }>).map((item) => ({
          inventory_id: item.id,
          event_type: "sent_to_vendor",
          description: `Email sent to ${to.trim()}`,
          metadata: { batch_id: batchId, email_subject: subject },
        })),
      );
    }

    // Update batch status to sent_to_vendor if not already
    await supabaseAdmin
      .from("qr_inventory_batches")
      .update({ status: "sent_to_vendor", sent_at: new Date().toISOString() })
      .eq("id", batchId)
      .neq("status", "sent_to_vendor");
  } catch {
    // Non-fatal: email was already sent; log failure is acceptable
  }

  res.status(200).json({ success: true });
});

export default router;
