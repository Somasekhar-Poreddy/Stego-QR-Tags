import { hasActiveSession } from "@/lib/adminAuth";

/**
 * A lightweight fetch wrapper for user-facing Supabase queries.
 *
 * Behaviour:
 * 1. Checks that a valid (and not-about-to-expire) session exists before
 *    running the query — proactively refreshes if the token is within the
 *    expiry window. If no session can be obtained, returns `previous`
 *    unchanged (AuthContext will handle the redirect to login).
 * 2. Executes the supplied async query function.
 * 3. If the query returns data with at least one row → returns that data.
 * 4. If the query returns an empty array → returns `previous` so the UI
 *    never flashes blank on a transient empty response (network blip, slow
 *    connection, brief auth token gap, RLS silent-empty during JWT rotation).
 * 5. If the query throws → logs the error, returns `previous` unchanged so
 *    the UI remains in its last known good state.
 *
 * Usage:
 *   const fresh = await safeFetch(() => myQuery(), currentState);
 *   setData(fresh);
 */
export async function safeFetch<T>(
  queryFn: () => Promise<T[]>,
  previous: T[],
  label = "safeFetch",
): Promise<T[]> {
  try {
    // Proactive: refresh the JWT if it's about to expire. This closes the
    // window where an in-flight query would hit RLS with auth.uid()=null.
    const alive = await hasActiveSession();
    if (!alive) {
      console.warn(`[${label}] No active session — keeping previous data.`);
      return previous;
    }

    const result = await queryFn();

    if (Array.isArray(result) && result.length > 0) {
      return result;
    }

    // Genuinely empty (0 rows) — honour it only when previous was also empty,
    // so an empty server response does not wipe out data the user already saw.
    if (previous.length === 0) {
      return result ?? [];
    }

    return previous;
  } catch (err) {
    console.error(`[${label}] Fetch failed:`, err);
    return previous;
  }
}
