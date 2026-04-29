import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getCommsPool } from "../lib/migrations.js";
import { verifyUserFromRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface CallRow {
  id: string;
  qr_id: string | null;
  caller_phone: string | null;
  callee_phone: string | null;
  status: string;
  duration_seconds: number | null;
  cost_paise: number | null;
  vehicle_last4: string | null;
  recording_url: string | null;
  provider: string;
  provider_call_id: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  qr_id: string | null;
  recipient_phone: string | null;
  channel: string;
  provider: string;
  status: string;
  template: string | null;
  payload_summary: string | null;
  cost_paise: number | null;
  error_code: string | null;
  error_message: string | null;
  fallback_from: string | null;
  created_at: string;
}

type ActivityItem =
  | (CallRow & { kind: "call"; qr_name: string | null })
  | (MessageRow & { kind: "message"; qr_name: string | null });

const CALL_COLUMNS = `id, qr_id, caller_phone, callee_phone, status, duration_seconds,
  cost_paise, vehicle_last4, recording_url, provider, provider_call_id,
  error_code, error_message, started_at, ended_at, created_at`;

const MESSAGE_COLUMNS = `id, qr_id, recipient_phone, channel, provider, status, template,
  payload_summary, cost_paise, error_code, error_message, fallback_from, created_at`;

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

async function fetchActivityForQrIds(
  qrIds: string[],
  qrNameById: Map<string, string>,
  limit: number,
): Promise<ActivityItem[]> {
  if (qrIds.length === 0) return [];
  const pool = getCommsPool();
  const [{ rows: calls }, { rows: msgs }] = await Promise.all([
    pool.query<CallRow>(
      `SELECT ${CALL_COLUMNS} FROM call_logs
       WHERE qr_id = ANY($1::uuid[])
       ORDER BY created_at DESC LIMIT $2`,
      [qrIds, limit],
    ),
    pool.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS} FROM message_logs
       WHERE qr_id = ANY($1::uuid[])
       ORDER BY created_at DESC LIMIT $2`,
      [qrIds, limit],
    ),
  ]);
  const merged: ActivityItem[] = [
    ...calls.map((c): ActivityItem => ({
      ...c, kind: "call",
      qr_name: c.qr_id ? qrNameById.get(c.qr_id) ?? null : null,
    })),
    ...msgs.map((m): ActivityItem => ({
      ...m, kind: "message",
      qr_name: m.qr_id ? qrNameById.get(m.qr_id) ?? null : null,
    })),
  ];
  merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return merged.slice(0, limit);
}

async function loadOwnedQrs(
  userId: string,
): Promise<{ ids: string[]; nameById: Map<string, string> }> {
  const { data, error } = await supabaseAdmin
    .from("qr_codes")
    .select("id, name")
    .eq("user_id", userId);
  if (error) {
    logger.warn({ err: error.message, userId }, "activity: failed to load user qr_codes");
    return { ids: [], nameById: new Map() };
  }
  const rows = (data ?? []) as Array<{ id: string; name: string | null }>;
  return {
    ids: rows.map((r) => r.id),
    nameById: new Map(rows.map((r) => [r.id, r.name ?? ""])),
  };
}

/* ─────────────────────── Owner-scoped ─────────────────────── */

/**
 * GET /api/me/activity?limit=50
 * Returns a unified call + message feed for every QR owned by the caller.
 */
router.get("/me/activity", async (req: Request, res: Response) => {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return;
  const limit = clampLimit(req.query.limit, 50, 200);
  try {
    const { ids, nameById } = await loadOwnedQrs(caller.userId);
    const items = await fetchActivityForQrIds(ids, nameById, limit);
    res.status(200).json({ items });
  } catch (err) {
    logger.error({ err, userId: caller.userId }, "activity: /me/activity failed");
    res.status(500).json({ error: "Failed to load activity" });
  }
});

/**
 * GET /api/me/qr/:qrId/activity?limit=50
 * Same shape, scoped to a single QR. Verifies caller owns the QR.
 */
router.get("/me/qr/:qrId/activity", async (req: Request, res: Response) => {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return;
  const limit = clampLimit(req.query.limit, 50, 200);
  const qrId = String(req.params.qrId ?? "");
  if (!qrId) {
    res.status(400).json({ error: "qrId required" });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("qr_codes")
      .select("id, name, user_id")
      .eq("id", qrId)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data || (data as { user_id?: string }).user_id !== caller.userId) {
      res.status(404).json({ error: "QR not found" });
      return;
    }
    const row = data as { id: string; name: string | null };
    const items = await fetchActivityForQrIds(
      [row.id],
      new Map([[row.id, row.name ?? ""]]),
      limit,
    );
    res.status(200).json({ items });
  } catch (err) {
    logger.error({ err, qrId }, "activity: /me/qr/:qrId/activity failed");
    res.status(500).json({ error: "Failed to load activity" });
  }
});

/* ─────────────────────── Admin (super_admin) ─────────────────────── */

async function isSuperAdmin(userId: string): Promise<boolean> {
  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (allowedIds.includes(userId)) return true;
  const { data } = await supabaseAdmin
    .from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  return ((data as { role?: string } | null)?.role ?? null) === "super_admin";
}

/**
 * GET /api/admin/users/:userId/activity?limit=100
 * Super-admin: drill into every call + message attached to QRs the user owns.
 */
router.get("/admin/users/:userId/activity", async (req: Request, res: Response) => {
  const caller = await verifyUserFromRequest(req, res);
  if (!caller) return;
  if (!(await isSuperAdmin(caller.userId))) {
    res.status(403).json({ error: "Only super admins can view user activity" });
    return;
  }
  const limit = clampLimit(req.query.limit, 100, 500);
  const userId = String(req.params.userId ?? "");
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  try {
    const { ids, nameById } = await loadOwnedQrs(userId);
    const items = await fetchActivityForQrIds(ids, nameById, limit);
    res.status(200).json({ items, qr_count: ids.length });
  } catch (err) {
    logger.error({ err, userId }, "activity: admin user-activity failed");
    res.status(500).json({ error: "Failed to load activity" });
  }
});

export default router;
