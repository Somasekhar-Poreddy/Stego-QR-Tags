import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/admin/create-user", async (req, res) => {
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Server is missing Supabase configuration" });
    return;
  }

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

    const authData = await authRes.json() as { id?: string; email?: string; error?: string; msg?: string };

    if (!authRes.ok) {
      const msg = (authData as { msg?: string; error?: string }).msg
        ?? (authData as { msg?: string; error?: string }).error
        ?? "Failed to create auth user";
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
