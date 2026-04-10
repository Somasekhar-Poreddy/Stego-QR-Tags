import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

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

async function getCallerAdminRecord(
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<AdminRecord | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${userId}&select=id,user_id,role,permissions&limit=1`,
    {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    },
  );
  if (!res.ok) return null;
  const data = await res.json() as AdminRecord[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
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

  const record = await getCallerAdminRecord(userId, supabaseUrl, serviceRoleKey);
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

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/admin_users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ user_id: userId, email, name, role, permissions }),
    });

    const dbData = await dbRes.json();
    if (!dbRes.ok) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      }).catch(() => {});
      res.status(dbRes.status).json({ error: "Failed to save admin record; auth user has been cleaned up", details: dbData });
      return;
    }

    res.status(201).json(Array.isArray(dbData) ? dbData[0] : dbData);
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
    const rowRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?id=eq.${adminUsersId}&select=id,user_id&limit=1`,
      {
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      },
    );

    if (!rowRes.ok) {
      res.status(500).json({ error: "Failed to look up admin user record" });
      return;
    }

    const rows = await rowRes.json() as { id: string; user_id: string | null }[];
    if (!rows.length) {
      res.status(404).json({ error: "Admin user record not found" });
      return;
    }

    const { user_id } = rows[0];

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

    // 3. Delete the admin_users row
    const dbDelRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?id=eq.${adminUsersId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      },
    );

    if (!dbDelRes.ok) {
      res.status(500).json({ error: "Auth user deleted but failed to remove admin record" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

export default router;
