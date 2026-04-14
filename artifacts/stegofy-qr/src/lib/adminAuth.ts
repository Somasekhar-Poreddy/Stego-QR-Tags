import { supabase } from "@/lib/supabase";

export const AUTH_EXPIRED_EVENT = "stegofy:auth-expired" as const;

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthExpiredError";
    // ✅ REMOVED: window.dispatchEvent from constructor
    // Navigation is handled ONLY by useSessionKeepalive's SIGNED_OUT handler
    // Firing it here caused every caught error to trigger a login redirect
  }
}

const AUTH_ERROR_CODES = new Set(["PGRST301", "401", "403"]);
const AUTH_ERROR_MESSAGES = [
  "jwt expired", "invalid jwt", "jwt invalid",
  "not authenticated", "invalid token", "token is expired",
  "user not authenticated", "missing authorization",
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
  const { data: { session } } = await supabase.auth.getSession();

  // ✅ If no session, try refreshing ONCE before giving up
  if (!session) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      // Only NOW dispatch — we confirmed the session is truly gone
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
      throw new AuthExpiredError();
    }
    return; // refresh worked, carry on
  }

  const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
  if (secsUntilExpiry < 60) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
      throw new AuthExpiredError(error.message);
    }
  }
}