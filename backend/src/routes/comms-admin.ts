import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getCommsPool } from "../lib/migrations.js";
import { getCommsSettings, invalidateCommsCache, flagOn } from "../services/commsCredentials.js";
import { probeZavuCredentials, isZavuConfigured } from "../services/zavuService.js";
import { probeExotelCredentials, isExotelConfigured } from "../services/exotelService.js";
import { getTodayCostPaise, getMonthCostPaise, monthlyBudgetState } from "../services/commsRouter.js";

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
    res.status(403).json({ error: "Only super admins can access this endpoint" });
    return null;
  }
  return userId;
}

// In-memory record of the last credential probe per provider, so the health
// endpoint can show "test status" without re-running the probe on every poll.
const lastTestStatus: Record<string, { ok: boolean; status: number; error: string | null; at: string } | null> = {
  zavu: null, exotel: null,
};
function getLastTestStatus(provider: "zavu" | "exotel") {
  return lastTestStatus[provider];
}

router.post("/admin/comms/test/zavu", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;
  invalidateCommsCache();
  const result = await probeZavuCredentials();
  lastTestStatus.zavu = { ...result, at: new Date().toISOString() };
  res.status(result.ok ? 200 : 400).json(result);
});

router.post("/admin/comms/test/exotel", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;
  invalidateCommsCache();
  const result = await probeExotelCredentials();
  lastTestStatus.exotel = { ...result, at: new Date().toISOString() };
  res.status(result.ok ? 200 : 400).json(result);
});

router.post("/admin/comms/cache/invalidate", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;
  invalidateCommsCache();
  res.status(200).json({ ok: true });
});

/* ─────────────────────── Health summary ─────────────────────── */

router.get("/admin/comms/health", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;

  const settings = await getCommsSettings();
  const [zavuConfigured, exotelConfigured] = await Promise.all([
    isZavuConfigured(), isExotelConfigured(),
  ]);

  // Optional ?userId=<uuid> scopes the recent feed to QRs owned by that user.
  // Provider-health and cost numbers stay global — those are platform metrics.
  const userIdFilter = typeof req.query.userId === "string" && req.query.userId
    ? String(req.query.userId)
    : null;
  let qrIdFilter: string[] | null = null;
  if (userIdFilter) {
    const { data: qrs } = await supabaseAdmin
      .from("qr_codes").select("id").eq("user_id", userIdFilter);
    qrIdFilter = ((qrs ?? []) as Array<{ id: string }>).map((q) => q.id);
    if (qrIdFilter.length === 0) qrIdFilter = ["00000000-0000-0000-0000-000000000000"];
  }

  // Recent failure rate by provider over last 24h.
  const pool = getCommsPool();
  const { rows: provRows } = await pool.query<{
    provider: string; total: string; failed: string;
  }>(
    `SELECT provider,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
       FROM message_logs
      WHERE created_at > now() - interval '24 hours'
      GROUP BY provider`,
  );
  const providerHealth: Record<string, { total: number; failed: number; failureRate: number }> = {};
  for (const r of provRows) {
    const total = Number(r.total) || 0;
    const failed = Number(r.failed) || 0;
    providerHealth[r.provider] = {
      total, failed,
      failureRate: total === 0 ? 0 : failed / total,
    };
  }

  const [todayCostPaise, monthCostPaise, budgetState] = await Promise.all([
    getTodayCostPaise(), getMonthCostPaise(), monthlyBudgetState(),
  ]);

  // Recent log feed — the last 50 message + call attempts, interleaved by
  // creation time. Used by the Communications screen so admins can spot
  // anomalies without paging through analytics.
  const recentMsgsRes = qrIdFilter
    ? await pool.query<{
        id: string; kind: "message"; channel: string; provider: string;
        status: string; error_code: string | null; cost_paise: number;
        fallback_from: string | null; created_at: string;
      }>(
        `SELECT id, 'message'::text AS kind, channel, provider, status,
                error_code, cost_paise, fallback_from, created_at
           FROM message_logs WHERE qr_id = ANY($1::uuid[])
          ORDER BY created_at DESC LIMIT 50`,
        [qrIdFilter],
      )
    : await pool.query<{
        id: string; kind: "message"; channel: string; provider: string;
        status: string; error_code: string | null; cost_paise: number;
        fallback_from: string | null; created_at: string;
      }>(
        `SELECT id, 'message'::text AS kind, channel, provider, status,
                error_code, cost_paise, fallback_from, created_at
           FROM message_logs ORDER BY created_at DESC LIMIT 50`,
      );
  const recentMsgs = recentMsgsRes.rows;
  const recentCallsRes = qrIdFilter
    ? await pool.query<{
        id: string; kind: "call"; provider: string; status: string;
        error_code: string | null; cost_paise: number; duration_seconds: number | null;
        created_at: string;
      }>(
        `SELECT id, 'call'::text AS kind, provider, status,
                error_code, cost_paise, duration_seconds, created_at
           FROM call_logs WHERE qr_id = ANY($1::uuid[])
          ORDER BY created_at DESC LIMIT 50`,
        [qrIdFilter],
      )
    : await pool.query<{
        id: string; kind: "call"; provider: string; status: string;
        error_code: string | null; cost_paise: number; duration_seconds: number | null;
        created_at: string;
      }>(
        `SELECT id, 'call'::text AS kind, provider, status,
                error_code, cost_paise, duration_seconds, created_at
           FROM call_logs ORDER BY created_at DESC LIMIT 50`,
      );
  const recentCalls = recentCallsRes.rows;
  const recent = [...recentMsgs, ...recentCalls]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 50);
  const capInr = Number(settings.comms_cost_cap_inr_per_day) || 0;
  const warnInr = Number(settings.comms_cost_warn_threshold_inr_per_day) || 0;
  const monthlyBudgetPaise = Number(settings.monthly_budget_paise) || 0;

  res.status(200).json({
    zavu_configured: zavuConfigured,
    exotel_configured: exotelConfigured,
    masked_call_enabled: flagOn(settings, "masked_call_enabled", "feature_calls_enabled"),
    whatsapp_enabled: flagOn(settings, "whatsapp_enabled", "feature_whatsapp_enabled"),
    sms_enabled: flagOn(settings, "sms_enabled", "feature_messages_enabled"),
    // Legacy aliases — kept so the existing dashboard keeps working.
    calls_enabled: flagOn(settings, "masked_call_enabled", "feature_calls_enabled"),
    messages_enabled: flagOn(settings, "sms_enabled", "feature_messages_enabled"),
    routing: {
      whatsapp: settings.comms_routing_whatsapp ?? "zavu_first",
      sms: settings.comms_routing_sms ?? "exotel",
      call: settings.comms_routing_call ?? "exotel",
      otp_channel: settings.comms_otp_channel ?? "whatsapp_first",
    },
    cost: {
      today_paise: todayCostPaise,
      today_inr: Math.round(todayCostPaise / 100 * 100) / 100,
      cap_inr: capInr,
      warn_inr: warnInr,
      over_cap: capInr > 0 && todayCostPaise >= capInr * 100,
      over_warn: warnInr > 0 && todayCostPaise >= warnInr * 100,
      month_paise: monthCostPaise,
      month_inr: Math.round(monthCostPaise / 100 * 100) / 100,
      monthly_budget_paise: monthlyBudgetPaise,
      monthly_budget_inr: Math.round(monthlyBudgetPaise / 100 * 100) / 100,
      over_budget: budgetState !== "ok",
      over_budget_behavior: settings.over_budget_behavior ?? "calls_only",
    },
    provider_24h: providerHealth,
    last_provider_health: providerHealth,
    zavu_test_status: getLastTestStatus("zavu"),
    exotel_test_status: getLastTestStatus("exotel"),
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      channel: (r as { channel?: string }).channel ?? "call",
      provider: r.provider,
      status: r.status,
      error_code: r.error_code,
      cost_paise: r.cost_paise,
      fallback_from: (r as { fallback_from?: string | null }).fallback_from ?? null,
      duration_seconds: (r as { duration_seconds?: number | null }).duration_seconds ?? null,
      created_at: r.created_at,
    })),
  });
});

/* ─────────────────────── Analytics ─────────────────────── */

router.get("/admin/comms/analytics", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;

  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const pool = getCommsPool();

  const [{ rows: msgDaily }, { rows: callDaily }, { rows: msgByProvider }, { rows: msgByStatus }, { rows: callByStatus }] = await Promise.all([
    pool.query<{ day: string; sent: string; delivered: string; failed: string; cost_paise: string; }>(
      `SELECT date_trunc('day', created_at)::date AS day,
              COUNT(*)::text AS sent,
              COUNT(*) FILTER (WHERE status = 'delivered')::text AS delivered,
              COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
              COALESCE(SUM(cost_paise),0)::text AS cost_paise
         FROM message_logs
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1 ASC`,
      [days],
    ),
    pool.query<{ day: string; total: string; completed: string; failed: string; cost_paise: string; }>(
      `SELECT date_trunc('day', created_at)::date AS day,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
              COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
              COALESCE(SUM(cost_paise),0)::text AS cost_paise
         FROM call_logs
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1 ASC`,
      [days],
    ),
    pool.query<{ provider: string; total: string; failed: string; fallback_used: string; cost_paise: string; }>(
      `SELECT provider,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
              COUNT(*) FILTER (WHERE fallback_from IS NOT NULL)::text AS fallback_used,
              COALESCE(SUM(cost_paise),0)::text AS cost_paise
         FROM message_logs
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY provider`,
      [days],
    ),
    pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
         FROM message_logs
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY status`,
      [days],
    ),
    pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
         FROM call_logs
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY status`,
      [days],
    ),
  ]);

  res.status(200).json({
    range_days: days,
    messages_daily: msgDaily.map((r) => ({
      day: r.day, sent: Number(r.sent), delivered: Number(r.delivered),
      failed: Number(r.failed), cost_paise: Number(r.cost_paise),
    })),
    calls_daily: callDaily.map((r) => ({
      day: r.day, total: Number(r.total), completed: Number(r.completed),
      failed: Number(r.failed), cost_paise: Number(r.cost_paise),
    })),
    messages_by_provider: msgByProvider.map((r) => ({
      provider: r.provider, total: Number(r.total), failed: Number(r.failed),
      fallback_used: Number(r.fallback_used), cost_paise: Number(r.cost_paise),
    })),
    messages_by_status: msgByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    calls_by_status: callByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
  });
});

/* ─────────────────────── Dashboard metrics (scalar summary) ─────────────────────── */

/**
 * Scalar dashboard widgets over a rolling window (default 30 days):
 *   - total_messages
 *   - whatsapp_success_rate  (delivered or queued / attempted, 0..1)
 *   - fallback_rate          (messages where fallback_from IS NOT NULL / total, 0..1)
 *   - total_calls
 *   - minutes_used           (SUM(duration_seconds) / 60, rounded)
 *   - cost_paise             (message_logs + call_logs cost_paise, over the same window)
 *
 * Separate from `/admin/comms/analytics` which returns chart-friendly time-series.
 */
router.get("/admin/comms/dashboard-metrics", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const pool = getCommsPool();

  const [{ rows: msgRows }, { rows: callRows }] = await Promise.all([
    pool.query<{
      total: string;
      whatsapp_attempts: string;
      whatsapp_success: string;
      fallback_used: string;
      cost_paise: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE channel = 'whatsapp')::text AS whatsapp_attempts,
         COUNT(*) FILTER (WHERE channel = 'whatsapp' AND status IN ('queued','sent','delivered'))::text AS whatsapp_success,
         COUNT(*) FILTER (WHERE fallback_from IS NOT NULL)::text AS fallback_used,
         COALESCE(SUM(cost_paise),0)::text AS cost_paise
         FROM message_logs
        WHERE created_at > now() - ($1 || ' days')::interval`,
      [days],
    ),
    pool.query<{
      total: string;
      duration_seconds: string;
      cost_paise: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COALESCE(SUM(duration_seconds),0)::text AS duration_seconds,
         COALESCE(SUM(cost_paise),0)::text AS cost_paise
         FROM call_logs
        WHERE created_at > now() - ($1 || ' days')::interval`,
      [days],
    ),
  ]);

  const m = msgRows[0];
  const c = callRows[0];
  const totalMessages = Number(m?.total ?? 0);
  const whatsappAttempts = Number(m?.whatsapp_attempts ?? 0);
  const whatsappSuccess = Number(m?.whatsapp_success ?? 0);
  const fallbackUsed = Number(m?.fallback_used ?? 0);
  const msgCostPaise = Number(m?.cost_paise ?? 0);
  const totalCalls = Number(c?.total ?? 0);
  const durationSeconds = Number(c?.duration_seconds ?? 0);
  const callCostPaise = Number(c?.cost_paise ?? 0);

  res.status(200).json({
    range_days: days,
    total_messages: totalMessages,
    whatsapp_success_rate: whatsappAttempts > 0 ? whatsappSuccess / whatsappAttempts : null,
    fallback_rate: totalMessages > 0 ? fallbackUsed / totalMessages : 0,
    total_calls: totalCalls,
    minutes_used: Math.round(durationSeconds / 60),
    cost_paise: msgCostPaise + callCostPaise,
  });
});

/* ─────────────────────── Per contact-request trail ─────────────────────── */

router.get("/admin/comms/contact-request/:id", async (req: Request, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return;
  const id = String(req.params.id ?? "");
  if (!id) {
    res.status(400).json({ error: "Missing id." });
    return;
  }
  const pool = getCommsPool();
  const [{ rows: msgs }, { rows: calls }] = await Promise.all([
    pool.query(
      `SELECT id, channel, provider, provider_message_id, status,
              error_code, error_message, cost_paise, fallback_from,
              created_at, updated_at
         FROM message_logs WHERE contact_request_id = $1
         ORDER BY created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT id, provider, provider_call_id, status, duration_seconds, cost_paise,
              error_code, error_message, started_at, ended_at, created_at, updated_at
         FROM call_logs WHERE contact_request_id = $1
         ORDER BY created_at DESC`,
      [id],
    ),
  ]);
  res.status(200).json({ messages: msgs, calls });
});

export default router;
