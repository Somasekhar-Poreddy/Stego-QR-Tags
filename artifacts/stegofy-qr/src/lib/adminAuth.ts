import { supabase } from "@/lib/supabase";

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

const AUTH_ERROR_CODES = new Set(["PGRST301", "401", "403"]);
const AUTH_ERROR_MESSAGES = [
  "jwt expired",
  "invalid jwt",
  "jwt invalid",
  "not authenticated",
  "invalid token",
  "token is expired",
  "user not authenticated",
  "missing authorization",
];

function isSupabaseAuthError(error: { message?: string; code?: string }): boolean {
  if (error.code && AUTH_ERROR_CODES.has(error.code)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return AUTH_ERROR_MESSAGES.some((m) => msg.includes(m));
}

export function throwAsAuthError(error: { message?: string; code?: string }): never {
  if (isSupabaseAuthError(error)) {
    throw new AuthExpiredError(error.message);
  }
  throw new Error(error.message ?? "An unexpected error occurred.");
}

export async function ensureFreshSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      throw new AuthExpiredError();
    }
    return;
  }

  const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
  if (secsUntilExpiry < 60) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw new AuthExpiredError(error.message);
    }
  }
}

/**
 * Quick check before issuing a Supabase query. Returns true if a session
 * exists, false if it doesn't (without throwing). Use this to short-circuit
 * fetches that would otherwise hit RLS and silently return [].
 *
 * Unlike `ensureFreshSession`, this does NOT throw — it's safe to call from
 * code paths that prefer to keep previous state visible rather than redirect
 * to the login screen on a transient gap.
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
    if (secsUntilExpiry > 30) return true;
    // Token is about to expire — try a refresh; if it works, we're alive.
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    return !error && !!refreshed.session;
  } catch {
    return false;
  }
}