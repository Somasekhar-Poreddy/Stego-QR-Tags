import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router: IRouter = Router();

const VALID_ROLES = ["super_admin", "ops_manager", "support", "marketing", "viewer"];

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

interface AdminRecord {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean>;
}

async function getCallerAdminRecord(userId: string): Promise<AdminRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, user_id, role, permissions")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as AdminRecord;
}

async function requireManageTeam(req: Request, res: Response): Promise<{ userId: string; record: AdminRecord | null } | null> {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return null;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Server is missing Supabase configuration" });
    return null;
  }

  // Validate the caller's JWT via Auth REST — no SDK shortcut for verifying an
  // arbitrary user token server-side; raw fetch is the correct approach here.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": serviceRoleKey,
    },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  const userData = await userRes.json() as { id?: string };
  const userId = userData.id;
  if (!userId) {
    res.status(401).json({ error: "Could not identify user" });
    return null;
  }

  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowedIds.includes(userId)) {
    return { userId, record: null };
  }

  const record = await getCallerAdminRecord(userId);
  if (!record) {
    res.status(403).json({ error: "You do not have admin access" });
    return null;
  }

  const isAuthorized =
    record.role === "super_admin" ||
    record.permissions?.manage_team === true;

  if (!isAuthorized) {
    res.status(403).json({ error: "You do not have permission to manage team members" });
    return null;
  }

  return { userId, record };
}

router.post("/admin/create-user", async (req: Request, res: Response) => {
  const caller = await requireManageTeam(req, res);
  if (!caller) return;

  const { email, password, name, role, permissions } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    permissions?: Record<string, boolean>;
  };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  if (role === "super_admin") {
    const callerRole = caller.record?.role;
    const callerIsAllowlisted = !caller.record;
    if (!callerIsAllowlisted && callerRole !== "super_admin") {
      res.status(403).json({ error: "Only super admins can create super admin accounts" });
      return;
    }
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // Auth Admin user creation — must remain raw fetch (Admin REST API)
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    const authData = await authRes.json() as { id?: string; msg?: string; error?: string };

    if (!authRes.ok) {
      const msg = authData.msg ?? authData.error ?? "Failed to create auth user";
      res.status(authRes.status).json({ error: msg });
      return;
    }

    const userId = authData.id;
    if (!userId) {
      res.status(500).json({ error: "Auth user created but no ID returned" });
      return;
    }

    // Insert admin_users row via supabaseAdmin SDK
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("admin_users")
      .insert({ user_id: userId, email, name, role, permissions })
      .select()
      .single();

    if (dbError || !dbData) {
      // Roll back auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      }).catch(() => {});
      res.status(500).json({ error: "Failed to save admin record; auth user has been cleaned up", details: dbError?.message });
      return;
    }

    res.status(201).json(dbData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

router.delete("/admin/delete-user", async (req: Request, res: Response) => {
  const caller = await requireManageTeam(req, res);
  if (!caller) return;

  const { adminUsersId } = req.body as { adminUsersId?: string };
  if (!adminUsersId) {
    res.status(400).json({ error: "adminUsersId is required" });
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // 1. Look up the admin_users row to get the Supabase Auth user_id
    const { data: row, error: rowError } = await supabaseAdmin
      .from("admin_users")
      .select("id, user_id")
      .eq("id", adminUsersId)
      .maybeSingle();

    if (rowError) {
      res.status(500).json({ error: "Failed to look up admin user record" });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Admin user record not found" });
      return;
    }

    const { user_id } = row as { id: string; user_id: string | null };

    // 2. Delete the Supabase Auth account if one exists (ignore 404 — already gone)
    if (user_id) {
      const authDelRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      });
      if (!authDelRes.ok && authDelRes.status !== 404) {
        const body = await authDelRes.json().catch(() => ({})) as { msg?: string };
        res.status(500).json({ error: body.msg ?? "Failed to delete Supabase Auth user" });
        return;
      }
    }

    // 3. Delete the admin_users row via supabaseAdmin SDK
    const { error: delError } = await supabaseAdmin
      .from("admin_users")
      .delete()
      .eq("id", adminUsersId);

    if (delError) {
      res.status(500).json({ error: "Auth user deleted but failed to remove admin record" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   Delete an END-USER (regular app user, not a team admin).
   ---------------------------------------------------------------------------
   Uses the service role to delete the auth.users row. FK constraints with
   ON DELETE CASCADE (cart_items, user_activity_logs) will clean up
   automatically; rows with ON DELETE SET NULL (orders, qr_scans) will be
   anonymised rather than removed.
   ----------------------------------------------------------------------- */
router.post("/admin/delete-end-user", async (req: Request, res: Response) => {
  const caller = await requireManageTeam(req, res);
  if (!caller) return;

  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Safety: refuse to delete a user who is themselves an admin via
  // admin_users, to prevent accidental super_admin self-deletion from the
  // Users screen. Admin accounts should be managed via /admin/delete-user.
  const { data: adminRow } = await supabaseAdmin
    .from("admin_users")
    .select("id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminRow) {
    res.status(400).json({
      error:
        "This account is also an admin team member. Use the Team screen to remove their admin access first.",
    });
    return;
  }

  try {
    // 1. Delete app-level rows whose FKs reference user_profiles directly.
    //    These tables don't cascade from auth.users, so we clean them first.
    //    We intentionally proceed on individual non-fatal errors — the goal
    //    is to leave the account fully removed, not half-deleted.
    const cleanup = async (table: string, col: string) => {
      const { error } = await supabaseAdmin.from(table).delete().eq(col, userId);
      if (error) console.warn(`[delete-end-user] ${table}.${col} cleanup error:`, error.message);
    };
    await cleanup("contact_requests", "user_id");
    await cleanup("qr_codes", "user_id");
    await cleanup("user_profiles", "id");

    // 2. Delete the auth.users row via the Supabase Auth Admin REST API.
    //    Supabase cascades to cart_items (ON DELETE CASCADE), anonymises
    //    orders (ON DELETE SET NULL), etc.
    const authDelRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    });
    if (!authDelRes.ok && authDelRes.status !== 404) {
      const body = (await authDelRes.json().catch(() => ({}))) as { msg?: string };
      res.status(500).json({
        error: body.msg ?? `Failed to delete auth user (HTTP ${authDelRes.status})`,
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

export default router;
