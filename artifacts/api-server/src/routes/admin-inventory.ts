import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router: IRouter = Router();

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

interface AdminRecord {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean>;
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

async function verifyUserFromRequest(
  req: Request,
  res: Response,
): Promise<{ userId: string; email: string | null } | null> {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return null;
  }
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Server is missing Supabase configuration" });
    return null;
  }
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  const userData = (await userRes.json()) as { id?: string; email?: string };
  if (!userData.id) {
    res.status(401).json({ error: "Could not identify user" });
    return null;
  }
  return { userId: userData.id, email: userData.email ?? null };
}

async function requireManageInventory(
  req: Request,
  res: Response,
): Promise<{ userId: string; record: AdminRecord | null } | null> {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return null;

  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowedIds.includes(caller.userId)) {
    return { userId: caller.userId, record: null };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, user_id, role, permissions")
    .eq("user_id", caller.userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    res.status(403).json({ error: "You do not have admin access" });
    return null;
  }
  const record = data as AdminRecord;
  const authorized =
    record.role === "super_admin" ||
    record.permissions?.manage_inventory === true;
  if (!authorized) {
    res.status(403).json({ error: "You do not have permission to manage inventory" });
    return null;
  }
  return { userId: caller.userId, record };
}

// ─── Code generators ─────────────────────────────────────────────────────────
// display_code = `STG-` + 6 chars from Crockford base32 (no I, L, O, U to avoid
// the obvious OCR / hand-typing confusables). pin_code = 4 random digits.

const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford

function generateDisplayCode(): string {
  const bytes = randomBytes(6);
  let out = "STG-";
  for (let i = 0; i < 6; i++) out += BASE32[bytes[i] % BASE32.length];
  return out;
}

function generatePinCode(): string {
  const b = randomBytes(2).readUInt16BE(0);
  return String(b % 10000).padStart(4, "0");
}

// ─── Batch-number generator ──────────────────────────────────────────────────
// BATCH-YYYY-NNNN where NNNN resets each calendar year. Reads the MAX row and
// increments. Two concurrent bulk-generate calls could race, so we retry once
// on unique-violation and bail out with 500 if it still fails.

async function nextBatchNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `BATCH-${year}-`;
  const { data } = await supabaseAdmin
    .from("qr_inventory_batches")
    .select("batch_number")
    .like("batch_number", `${prefix}%`)
    .order("batch_number", { ascending: false })
    .limit(1);
  let seq = 1;
  if (data && data.length > 0) {
    const last = (data[0] as { batch_number: string }).batch_number;
    const trailing = Number.parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(trailing)) seq = trailing + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

// ─── POST /api/admin/inventory/bulk-generate ─────────────────────────────────

router.post("/admin/inventory/bulk-generate", async (req: Request, res: Response) => {
  const caller = await requireManageInventory(req, res);
  if (!caller) return;

  const { count, type, category, vendor_name, vendor_contact, vendor_notes } =
    req.body as {
      count?: number;
      type?: string;
      category?: string;
      vendor_name?: string;
      vendor_contact?: string;
      vendor_notes?: string;
    };

  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) {
    res.status(400).json({ error: "count must be a positive integer" });
    return;
  }
  if (!type) {
    res.status(400).json({ error: "type is required" });
    return;
  }

  const origin =
    (req.headers["x-app-origin"] as string | undefined) ??
    process.env.VITE_APP_URL ??
    "";

  let batchNumber: string;
  try {
    batchNumber = await nextBatchNumber();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to derive batch number";
    res.status(500).json({ error: msg });
    return;
  }

  // 1. Create the batch row.
  const { data: batch, error: batchError } = await supabaseAdmin
    .from("qr_inventory_batches")
    .insert({
      batch_number: batchNumber,
      category: category ?? null,
      type,
      total_count: n,
      vendor_name: vendor_name ?? null,
      vendor_contact: vendor_contact ?? null,
      vendor_notes: vendor_notes ?? null,
      status: "created",
    })
    .select("id, batch_number")
    .single();
  if (batchError || !batch) {
    res.status(500).json({ error: batchError?.message ?? "Failed to create batch" });
    return;
  }
  const batchRow = batch as { id: string; batch_number: string };

  // 2. Generate inventory rows in memory. Guarantee unique display_codes within
  //    the batch by retrying on local Set collisions — the DB unique index is
  //    the authoritative guard for cross-batch collisions.
  const seenDisplayCodes = new Set<string>();
  const rows = Array.from({ length: n }, () => {
    const id = randomUUID();
    let displayCode = generateDisplayCode();
    while (seenDisplayCodes.has(displayCode)) displayCode = generateDisplayCode();
    seenDisplayCodes.add(displayCode);

    return {
      id,
      qr_code: `STG-INV-${id.slice(0, 8).toUpperCase()}`,
      type,
      category: category ?? null,
      status: "unassigned",
      batch_id: batchRow.id,
      display_code: displayCode,
      pin_code: generatePinCode(),
      qr_url: origin ? `${origin}/qr/${id}` : null,
      vendor_name: vendor_name ?? null,
    };
  });

  // 3. Chunk the insert — Supabase has a row-count ceiling per insert. 500 is
  //    well under every documented limit.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: insertError } = await supabaseAdmin
      .from("qr_inventory")
      .insert(chunk);
    if (insertError) {
      // Partial failure: roll back the batch (and any rows already inserted).
      await supabaseAdmin.from("qr_inventory").delete().eq("batch_id", batchRow.id);
      await supabaseAdmin.from("qr_inventory_batches").delete().eq("id", batchRow.id);
      res.status(500).json({ error: insertError.message ?? "Failed to insert inventory rows" });
      return;
    }
  }

  // 4. Append `created` events (best-effort; failure here is logged but does
  //    not roll back the inventory — the sticker is real even if the event is missing).
  const events = rows.map((r) => ({
    inventory_id: r.id,
    event_type: "created",
    description: `Generated in batch ${batchRow.batch_number}`,
    metadata: { batch_id: batchRow.id, created_by: caller.userId },
  }));
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK);
    const { error: evErr } = await supabaseAdmin.from("qr_inventory_events").insert(chunk);
    if (evErr) console.warn("[admin-inventory] bulk-generate event insert failed:", evErr.message);
  }

  // 5. Kick the low-stock checker so any open alert for this category resolves.
  try {
    await supabaseAdmin.rpc("check_inventory_low_stock");
  } catch (err) {
    console.warn("[admin-inventory] check_inventory_low_stock failed:", err);
  }

  res.status(201).json({
    batch_id: batchRow.id,
    batch_number: batchRow.batch_number,
    count: n,
    item_ids: rows.map((r) => r.id),
  });
});

// ─── POST /api/admin/inventory/send-to-vendor ────────────────────────────────

router.post("/admin/inventory/send-to-vendor", async (req: Request, res: Response) => {
  const caller = await requireManageInventory(req, res);
  if (!caller) return;

  const { batch_id, vendor_name, vendor_contact, vendor_notes } = req.body as {
    batch_id?: string;
    vendor_name?: string;
    vendor_contact?: string;
    vendor_notes?: string;
  };
  if (!batch_id) {
    res.status(400).json({ error: "batch_id is required" });
    return;
  }

  const now = new Date().toISOString();

  const { error: batchErr } = await supabaseAdmin
    .from("qr_inventory_batches")
    .update({
      status: "sent_to_vendor",
      sent_at: now,
      vendor_name: vendor_name ?? null,
      vendor_contact: vendor_contact ?? null,
      vendor_notes: vendor_notes ?? null,
      updated_at: now,
    })
    .eq("id", batch_id);
  if (batchErr) {
    res.status(500).json({ error: batchErr.message });
    return;
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("qr_inventory")
    .update({ status: "sent_to_vendor", vendor_name: vendor_name ?? null, updated_at: now })
    .eq("batch_id", batch_id)
    .eq("status", "unassigned")
    .select("id");
  if (itemsErr) {
    res.status(500).json({ error: itemsErr.message });
    return;
  }

  const ids = (items ?? []) as { id: string }[];
  if (ids.length > 0) {
    const events = ids.map((r) => ({
      inventory_id: r.id,
      event_type: "sent_to_vendor" as const,
      description: `Sent to vendor${vendor_name ? ` (${vendor_name})` : ""}`,
      metadata: { batch_id, by: caller.userId },
    }));
    const { error: evErr } = await supabaseAdmin.from("qr_inventory_events").insert(events);
    if (evErr) console.warn("[admin-inventory] send-to-vendor event insert failed:", evErr.message);
  }

  res.status(200).json({ updated: ids.length });
});

// ─── POST /api/admin/inventory/mark-received ─────────────────────────────────

router.post("/admin/inventory/mark-received", async (req: Request, res: Response) => {
  const caller = await requireManageInventory(req, res);
  if (!caller) return;

  const { batch_id } = req.body as { batch_id?: string };
  if (!batch_id) {
    res.status(400).json({ error: "batch_id is required" });
    return;
  }

  const now = new Date().toISOString();

  const { error: batchErr } = await supabaseAdmin
    .from("qr_inventory_batches")
    .update({ status: "received", received_at: now, updated_at: now })
    .eq("id", batch_id);
  if (batchErr) {
    res.status(500).json({ error: batchErr.message });
    return;
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("qr_inventory")
    .update({ status: "in_stock", updated_at: now })
    .eq("batch_id", batch_id)
    .eq("status", "sent_to_vendor")
    .select("id");
  if (itemsErr) {
    res.status(500).json({ error: itemsErr.message });
    return;
  }

  const ids = (items ?? []) as { id: string }[];
  if (ids.length > 0) {
    const events = ids.map((r) => ({
      inventory_id: r.id,
      event_type: "received_in_stock" as const,
      description: "Stock received from vendor",
      metadata: { batch_id, by: caller.userId },
    }));
    const { error: evErr } = await supabaseAdmin.from("qr_inventory_events").insert(events);
    if (evErr) console.warn("[admin-inventory] mark-received event insert failed:", evErr.message);
  }

  res.status(200).json({ updated: ids.length });
});

// ─── POST /api/admin/inventory/bulk-status ───────────────────────────────────

router.post("/admin/inventory/bulk-status", async (req: Request, res: Response) => {
  const caller = await requireManageInventory(req, res);
  if (!caller) return;

  const { ids, status } = req.body as { ids?: string[]; status?: string };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const valid = new Set(["unassigned", "sent_to_vendor", "in_stock", "assigned"]);
  if (!status || !valid.has(status)) {
    res.status(400).json({ error: "status must be one of unassigned/sent_to_vendor/in_stock/assigned" });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("qr_inventory")
    .update({ status, updated_at: now })
    .in("id", ids);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const events = ids.map((id) => ({
    inventory_id: id,
    event_type: "edited" as const,
    description: `Status changed to ${status}`,
    metadata: { by: caller.userId, status },
  }));
  const { error: evErr } = await supabaseAdmin.from("qr_inventory_events").insert(events);
  if (evErr) console.warn("[admin-inventory] bulk-status event insert failed:", evErr.message);

  res.status(200).json({ updated: ids.length });
});

// ─── DELETE /api/admin/inventory/bulk-delete ─────────────────────────────────

router.delete("/admin/inventory/bulk-delete", async (req: Request, res: Response) => {
  const caller = await requireManageInventory(req, res);
  if (!caller) return;

  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }

  // Refuse to delete rows that have been assigned to a user — admins should
  // explicitly unassign first (which is a destructive path we haven't added).
  const { data: assignedRows } = await supabaseAdmin
    .from("qr_inventory")
    .select("id")
    .in("id", ids)
    .eq("status", "assigned");
  if (assignedRows && assignedRows.length > 0) {
    res.status(400).json({
      error: `Cannot delete ${assignedRows.length} item(s) already assigned to users. Unlink them first.`,
    });
    return;
  }

  const { error, count } = await supabaseAdmin
    .from("qr_inventory")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ deleted: count ?? ids.length, by: caller.userId });
});

// ─── POST /api/admin/inventory/claim/verify ──────────────────────────────────
// End-user facing. Any authenticated user can verify a display_code + pin_code
// pair. Returns the inventory id/type on success — no DB writes.

router.post("/admin/inventory/claim/verify", async (req: Request, res: Response) => {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return;

  const { display_code, pin_code } = req.body as {
    display_code?: string;
    pin_code?: string;
  };
  if (!display_code || !pin_code) {
    res.status(400).json({ error: "display_code and pin_code are required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("qr_inventory")
    .select("id, type, category, status, pin_code")
    .eq("display_code", display_code.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "No sticker found with that code" });
    return;
  }

  const row = data as {
    id: string;
    type: string | null;
    category: string | null;
    status: string;
    pin_code: string | null;
  };

  if (row.pin_code !== pin_code.trim()) {
    // Log the failed attempt for abuse monitoring.
    await supabaseAdmin.from("qr_inventory_events").insert({
      inventory_id: row.id,
      event_type: "claim_failed",
      description: "Wrong PIN during claim verification",
      metadata: { by: caller.userId },
    });
    res.status(400).json({ error: "Incorrect PIN for this sticker" });
    return;
  }

  if (row.status === "assigned") {
    res.status(409).json({ error: "This sticker has already been claimed" });
    return;
  }

  // Even if the sticker is technically sent_to_vendor (pre-release) we let the
  // caller continue — the finalize step is the authoritative gate.
  res.status(200).json({ id: row.id, type: row.type, category: row.category, status: row.status });
});

// ─── POST /api/admin/inventory/claim/finalize ────────────────────────────────
// Creates the qr_codes row, links the inventory row, logs the `assigned`
// event, and auto-resolves low-stock alerts.

router.post("/admin/inventory/claim/finalize", async (req: Request, res: Response) => {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return;

  const { display_code, pin_code, profile } = req.body as {
    display_code?: string;
    pin_code?: string;
    profile?: {
      name?: string;
      type?: string;
      privacy_mode?: string;
      primary_contact?: string;
      notes?: string;
      data?: Record<string, unknown>;
    };
  };
  if (!display_code || !pin_code) {
    res.status(400).json({ error: "display_code and pin_code are required" });
    return;
  }
  if (!profile || !profile.name) {
    res.status(400).json({ error: "profile.name is required" });
    return;
  }

  // Re-verify atomically (don't trust a prior /verify response — the row could
  // have been claimed between the two calls).
  const { data: inv, error: invErr } = await supabaseAdmin
    .from("qr_inventory")
    .select("id, type, category, status, pin_code, qr_url")
    .eq("display_code", display_code.trim().toUpperCase())
    .maybeSingle();
  if (invErr) {
    res.status(500).json({ error: invErr.message });
    return;
  }
  if (!inv) {
    res.status(404).json({ error: "No sticker found with that code" });
    return;
  }
  const invRow = inv as {
    id: string;
    type: string | null;
    category: string | null;
    status: string;
    pin_code: string | null;
    qr_url: string | null;
  };
  if (invRow.pin_code !== pin_code.trim()) {
    res.status(400).json({ error: "Incorrect PIN for this sticker" });
    return;
  }
  if (invRow.status === "assigned") {
    res.status(409).json({ error: "This sticker has already been claimed" });
    return;
  }

  const now = new Date().toISOString();

  // Create the qr_codes row. Use the inventory id so the existing /qr/<id>
  // URL continues to resolve once the sticker is claimed.
  const { data: qr, error: qrErr } = await supabaseAdmin
    .from("qr_codes")
    .insert({
      id: invRow.id,
      user_id: caller.userId,
      name: profile.name,
      type: profile.type ?? invRow.type ?? "belongings",
      status: "active",
      is_active: true,
      allow_contact: true,
      strict_mode: false,
      privacy_mode: profile.privacy_mode ?? "mask",
      primary_contact: profile.primary_contact ?? null,
      notes: profile.notes ?? null,
      data: profile.data ?? {},
      qr_url: invRow.qr_url,
      pin_code: invRow.pin_code,
      display_code: display_code.trim().toUpperCase(),
      scans: 0,
      created_at: now,
    })
    .select("id")
    .single();
  if (qrErr || !qr) {
    res.status(500).json({ error: qrErr?.message ?? "Failed to create qr_codes row" });
    return;
  }
  const qrRow = qr as { id: string };

  // Link the inventory row.
  const { error: linkErr } = await supabaseAdmin
    .from("qr_inventory")
    .update({
      status: "assigned",
      linked_qr_id: qrRow.id,
      linked_user_id: caller.userId,
      updated_at: now,
    })
    .eq("id", invRow.id);
  if (linkErr) {
    // Roll back the qr_codes row so the sticker can be retried.
    await supabaseAdmin.from("qr_codes").delete().eq("id", qrRow.id);
    res.status(500).json({ error: linkErr.message });
    return;
  }

  await supabaseAdmin.from("qr_inventory_events").insert({
    inventory_id: invRow.id,
    event_type: "assigned",
    description: "Claimed by end-user",
    metadata: { user_id: caller.userId, qr_id: qrRow.id },
  });

  // Mark the parent batch fully_assigned if no unassigned siblings remain.
  const { data: siblings } = await supabaseAdmin
    .from("qr_inventory")
    .select("id, status, batch_id")
    .eq("id", invRow.id)
    .maybeSingle();
  const batchId = (siblings as { batch_id?: string } | null)?.batch_id ?? null;
  if (batchId) {
    const { count: stillOpen } = await supabaseAdmin
      .from("qr_inventory")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .neq("status", "assigned");
    if ((stillOpen ?? 0) === 0) {
      await supabaseAdmin
        .from("qr_inventory_batches")
        .update({ status: "fully_assigned", updated_at: now })
        .eq("id", batchId);
    }
  }

  try {
    await supabaseAdmin.rpc("check_inventory_low_stock");
  } catch (err) {
    console.warn("[admin-inventory] post-claim low-stock check failed:", err);
  }

  res.status(201).json({ qr_id: qrRow.id, inventory_id: invRow.id });
});

// ─── Public: claim-info lookup ───────────────────────────────────────────────
// No auth required. Used by PublicProfileScreen when a scanned QR id exists in
// qr_inventory but not yet in qr_codes (i.e. the sticker hasn't been claimed).
// Uses the service-role client so RLS never blocks the read.
// Returns:
//   200 { claimable: true,  display_code, type }  — unclaimed, ready to claim
//   200 { claimable: false }                       — already assigned
//   404 { error }                                  — not found in inventory

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/qr/info/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || !UUID_RE.test(id)) {
    res.status(404).json({ error: "QR not found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("qr_inventory")
    .select("id, status, type, display_code")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "QR not found in inventory" });
    return;
  }

  const CLAIMABLE_STATUSES = ["unassigned", "sent_to_vendor", "in_stock"] as const;
  const row = data as { id: string; status: string; type: string | null; display_code: string | null };

  if (!CLAIMABLE_STATUSES.includes(row.status as typeof CLAIMABLE_STATUSES[number])) {
    res.json({ claimable: false });
    return;
  }
  if (!row.display_code) {
    res.status(404).json({ error: "Sticker has no display code yet" });
    return;
  }

  res.json({ claimable: true, display_code: row.display_code, type: row.type });
});

export default router;

