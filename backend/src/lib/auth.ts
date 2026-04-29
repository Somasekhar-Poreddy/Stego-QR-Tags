import type { Request, Response } from "express";

export interface VerifiedUser {
  userId: string;
  email: string | null;
}

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

/**
 * Resolve the caller's Supabase user from a Bearer token. Sends a 401/500
 * response and returns null when verification fails — handlers should early-
 * return on null.
 */
export async function verifyUserFromRequest(
  req: Request,
  res: Response,
): Promise<VerifiedUser | null> {
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
