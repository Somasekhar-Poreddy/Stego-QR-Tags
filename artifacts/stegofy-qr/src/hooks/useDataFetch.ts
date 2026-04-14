import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";

/**
 * React hook for data-fetching with built-in stability guarantees (FIX 5).
 *
 * Behaviour:
 * 1. isLoggedIn guard — if the user is not authenticated the fetch is skipped
 *    immediately; data stays at its previous value and error is set.
 * 2. prevData ref — stores the last successful non-empty result so the UI
 *    never flashes blank on a transient empty or error response.
 * 3. cancelled flag — set to true in useEffect cleanup so in-flight results
 *    from unmounted components are silently discarded (no stale state updates).
 * 4. Empty-result guard — if the server returns [] AND prevData has real rows,
 *    the update is skipped (logged as a warning) to prevent blank-flash.
 * 5. Error recovery — on catch the hook restores data to prevData.current so
 *    existing content stays visible while the error message is surfaced.
 *
 * @param apiFn  Async function that must resolve to T[].
 * @param deps   Dependency array (same as useEffect deps) that re-triggers apiFn.
 */
export function useDataFetch<T>(
  apiFn: () => Promise<T[]>,
  deps: React.DependencyList = [],
) {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevData = useRef<T[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFn = useCallback(apiFn, deps);

  // cancelled is a ref so cleanup always writes to the same object reference,
  // even across React strict-mode double-invocations.
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    if (!isLoggedIn) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    stableFn()
      .then((result) => {
        if (cancelled.current) return;

        if (Array.isArray(result) && result.length > 0) {
          prevData.current = result;
          setData(result);
        } else if (prevData.current.length > 0) {
          // Server returned empty but we have previous data — skip the update
          // to avoid a blank-flash from a transient auth gap or network blip.
          console.warn(
            "[useDataFetch] Empty result from server; keeping previous data to avoid blank-flash.",
          );
          setData(prevData.current);
        } else {
          // Genuinely no data (new user / empty state)
          setData(result ?? []);
        }
      })
      .catch((err: unknown) => {
        if (cancelled.current) return;
        const msg = err instanceof Error ? err.message : "Fetch failed";
        console.error("[useDataFetch] Error:", msg);
        // Restore previous data so the screen doesn't go blank on error
        setData(prevData.current.length > 0 ? prevData.current : null);
        setError(msg);
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });

    return () => {
      cancelled.current = true;
    };
  // stableFn is already stabilised via useCallback above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, stableFn]);

  return { data, loading, error };
}
