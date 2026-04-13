import { supabase } from "@/lib/supabase";

export class AuthExpiredError extends Error {
  constructor() {
    super("Session expired. Please sign in again.");
    this.name = "AuthExpiredError";
  }
}

/**
 * Ensures the current Supabase session has a fresh JWT.
 *
 * - Reads the cached session from localStorage (instant, no network).
 * - If no session exists, throws AuthExpiredError.
 * - If the access token expires within the next 60 seconds, triggers
 *   a network refresh call to get a new JWT.
 * - If the refresh fails (network error, revoked token, etc.), throws
 *   AuthExpiredError so the caller can redirect the user to login.
 *
 * Call this as the very first line of any admin service function that
 * reads protected data, so auth failures surface immediately rather
 * than silently returning empty arrays.
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
      throw new AuthExpiredError();
    }
  }
}
