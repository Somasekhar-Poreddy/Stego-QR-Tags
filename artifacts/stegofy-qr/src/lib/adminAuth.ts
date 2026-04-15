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

/**
 * Returns true if this is a Supabase multi-tab lock contention error. These
 * fire when two tabs both try to refresh the auth token at the same moment;
 * one tab's lock gets "stolen" by the other. It's transient and safe to
 * retry — the other tab will have successfully refreshed the token by then.
 */
function isLockContentionError(error: { message?: string } | unknown): boolean {
  const msg = (error as { message?: string })?.message?.toLowerCase?.() ?? "";
  return msg.includes("lock") && (msg.includes("stole") || msg.includes("released"));
}

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

/**
 * Verifies the Supabase session is usable. Does NOT manually call
 * refreshSession — Supabase's autoRefreshToken already handles renewal, and
 * calling refreshSession ourselves from multiple call-sites creates lock
 * contention between tabs ("Lock ... was released because another request
 * stole it"). Instead we just check the session's current expiry and give
 * the background refresher a moment to catch up if needed.
 *
 * Throws AuthExpiredError when there really is no usable session.
 */
export async function ensureFreshSession(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
      // Still valid — nothing to do. autoRefreshToken will rotate it before
      // expiry without our help.
      if (secsUntilExpiry > 10) return;
    }

    // Either no session in memory, or it's seconds from expiry. Give the
    // background refresher (or a sibling tab) a brief window to complete.
    await new Promise((r) => setTimeout(r, 400));
    const { data: { session: retried } } = await supabase.auth.getSession();
    if (retried) return;

    // Still no session — attempt one explicit refresh, tolerating lock
    // contention as transient (a sibling tab is refreshing right now).
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) return;
      if (error && isLockContentionError(error)) {
        // Wait a beat and trust the sibling tab's refresh.
        await new Promise((r) => setTimeout(r, 500));
        const { data: { session: after } } = await supabase.auth.getSession();
        if (after) return;
      }
    } catch (e) {
      if (isLockContentionError(e)) {
        await new Promise((r) => setTimeout(r, 500));
        const { data: { session: after } } = await supabase.auth.getSession();
        if (after) return;
      } else {
        throw e;
      }
    }

    throw new AuthExpiredError();
  } catch (e) {
    // Swallow transient lock errors — they're cross-tab coordination noise.
    if (isLockContentionError(e)) return;
    if (e instanceof AuthExpiredError) throw e;
    // Unknown errors: don't block the query, let it run. If it really is
    // an auth problem the query itself will surface it.
    console.warn("[ensureFreshSession] non-auth error, proceeding:", e);
  }
}

/**
 * Quick check before issuing a Supabase query. Returns true if a session
 * exists, false if it doesn't (without throwing). Tolerant of multi-tab
 * lock contention — treats that as "session is fine, try the query."
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
    // Not close to expiry — we're fine.
    if (secsUntilExpiry > 30) return true;
    // Close to expiry: let autoRefreshToken handle it; just confirm we still
    // have *a* session after a brief moment.
    await new Promise((r) => setTimeout(r, 300));
    const { data: { session: after } } = await supabase.auth.getSession();
    return !!after;
  } catch (e) {
    // Treat lock-contention as "session exists" because it does — we just
    // can't refresh right now because another tab is doing it.
    if (isLockContentionError(e)) return true;
    return false;
  }
}