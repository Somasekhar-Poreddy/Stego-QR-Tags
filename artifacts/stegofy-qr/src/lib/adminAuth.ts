import { supabase } from "@/lib/supabase";

/**
 * Custom DOM event name dispatched whenever an AuthExpiredError is created.
 * AdminRouter listens to this event and navigates to /admin/login?reason=expired.
 * This allows async loading paths in any screen to trigger the redirect without
 * needing to import or check for AuthExpiredError directly.
 */
export const AUTH_EXPIRED_EVENT = "stegofy:auth-expired" as const;

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthExpiredError";
    // Dispatch a global DOM event so AdminRouter can handle navigation
    // even when the error originates deep in an async loading path.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
  }
}

/**
 * Supabase error codes and messages that indicate an authentication failure.
 * These appear when the JWT is expired/invalid or the user is not authenticated.
 */
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

/**
 * Converts a Supabase query error into either an AuthExpiredError (if the error
 * is authentication-related) or a plain Error (for any other failure).
 *
 * Use this in service functions instead of `throw new Error(error.message)` so
 * that auth failures propagate with the correct type and automatically dispatch
 * the global auth-expired event.
 */
export function throwAsAuthError(error: { message?: string; code?: string }): never {
  if (isSupabaseAuthError(error)) {
    throw new AuthExpiredError(error.message);
  }
  throw new Error(error.message ?? "An unexpected error occurred.");
}

/**
 * Ensures the current Supabase session has a fresh JWT.
 *
 * - Reads the cached session from localStorage (instant, no network).
 * - If no session exists, throws AuthExpiredError.
 * - If the access token expires within the next 60 seconds, triggers a network
 *   refresh call to get a new JWT.
 * - If the refresh fails (network error, revoked token, etc.), throws
 *   AuthExpiredError so the caller can redirect the user to login.
 */
export async function ensureFreshSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new AuthExpiredError();
  }

  const expiresAt = session.expires_at ?? 0;
  const nowSecs = Math.floor(Date.now() / 1000);
  const secsUntilExpiry = expiresAt - nowSecs;

  if (secsUntilExpiry < 60) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw new AuthExpiredError(error.message);
    }
  }
}
