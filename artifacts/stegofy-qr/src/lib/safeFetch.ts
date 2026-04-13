import { supabase } from "@/lib/supabase";

/**
 * A lightweight fetch wrapper for user-facing Supabase queries.
 *
 * Behaviour:
 * 1. Checks that a valid session exists before running the query.
 *    If there is no session, returns `previous` unchanged and logs a warning
 *    (the AuthContext onAuthStateChange handler will redirect to login).
 * 2. Executes the supplied async query function.
 * 3. If the query returns data with at least one row → returns that data.
 * 4. If the query returns an empty array → returns `previous` so the UI
 *    never flashes blank on a transient empty response (network blip, slow
 *    connection, brief auth token gap).
 * 5. If the query throws → logs the error, returns `previous` unchanged so
 *    the UI remains in its last known good state.
 *
 * Usage:
 *   const fresh = await safeFetch(() => myQuery(), currentState);
 *   setData(fresh);
 *
 * @param queryFn  Async function that resolves to T[].
 * @param previous Current state value to fall back to on error / empty result.
 * @param label    Optional label used in console.error output for easier debugging.
 */
export async function safeFetch<T>(
  queryFn: () => Promise<T[]>,
  previous: T[],
  label = "safeFetch",
): Promise<T[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn(`[${label}] No active session — skipping fetch.`);
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
