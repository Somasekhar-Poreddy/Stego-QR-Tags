import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return null;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    return userId;
  }

  const dbCheck = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${userId}&select=id&limit=1`,
    {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    },
  );
  const dbData = await dbCheck.json() as unknown[];
  if (Array.isArray(dbData) && dbData.length > 0) {
    return userId;
  }

  res.status(403).json({ error: "You do not have admin access" });
  return null;
}

router.post("/admin/create-user", async (req: Request, res: Response) => {
  const callerId = await requireAdmin(req, res);
  if (!callerId) return;

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

  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
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
      res.status(dbRes.status).json({ error: "Auth user created but failed to save admin record", details: dbData });
      return;
    }

    res.status(201).json(Array.isArray(dbData) ? dbData[0] : dbData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
});

export default router;
