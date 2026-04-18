import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendVendorEmail, isEmailConfigured } from "../services/emailService.js";
import { generateBatchPdfBase64 } from "../utils/stickerPdfGenerator.js";

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

  const { batchId, to, subject, html, attachPdf } = req.body as {
    batchId?: string;
    to?: string;
    subject?: string;
    html?: string;
    attachPdf?: boolean;
  };

  if (!to?.trim() || !subject?.trim() || !html?.trim()) {
    res.status(400).json({ error: "to, subject, and html are required" });
    return;
  }
  if (!batchId) {
    res.status(400).json({ error: "batchId is required" });
    return;
  }

  // Fetch batch and items (needed for PDF and metadata)
  const { data: batchData, error: batchErr } = await supabaseAdmin
    .from("qr_inventory_batches")
    .select("batch_number")
    .eq("id", batchId)
    .maybeSingle();
  if (batchErr || !batchData) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  const { data: itemsData, error: itemsErr } = await supabaseAdmin
    .from("qr_inventory")
    .select("id, type, qr_code, qr_url, display_code, pin_code")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (itemsErr) {
    res.status(500).json({ error: "Failed to fetch batch items" });
    return;
  }
  const items = (itemsData ?? []) as Array<{
    id: string;
    type?: string | null;
    qr_code?: string | null;
    qr_url?: string | null;
    display_code?: string | null;
    pin_code?: string | null;
  }>;

  // Generate PDF server-side if requested
  let pdfBase64: string | undefined;
  let pdfFilename: string | undefined;
  if (attachPdf && items.length > 0) {
    try {
      pdfBase64 = await generateBatchPdfBase64(items);
      const batchNum = (batchData as { batch_number?: string }).batch_number ?? batchId;
      pdfFilename = `${batchNum}-stickers.pdf`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF generation failed";
      res.status(500).json({ error: msg });
      return;
    }
  }

  // Send email
  try {
    await sendVendorEmail({
      to: to.trim(),
      subject: subject.trim(),
      html,
      pdfBase64,
      pdfFilename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    res.status(500).json({ error: message });
    return;
  }

  // Record email_sent event per item and update batch status — only after successful send
  try {
    if (items.length > 0) {
      await supabaseAdmin.from("qr_inventory_events").insert(
        items.map((item) => ({
          inventory_id: item.id,
          event_type: "email_sent",
          description: `Vendor email sent to ${to.trim()}`,
          metadata: { batch_id: batchId, email_subject: subject.trim() },
        })),
      );
    }

    await supabaseAdmin
      .from("qr_inventory_batches")
      .update({ status: "sent_to_vendor", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", batchId);
  } catch {
    // Non-fatal: email was already sent successfully
  }

  res.status(200).json({ success: true });
});

export default router;
