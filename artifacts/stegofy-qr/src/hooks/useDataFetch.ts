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
 * 3. Per-run sequence isolation — each effect invocation captures a unique
 *    sequence number (`seq`). State setters are guarded by `runSeq.current !== seq`
 *    so that stale results from superseded or unmounted runs are silently discarded.
 *    The cleanup increments `runSeq` to invalidate the current run; the next run
 *    increments again before capturing its own `seq`, ensuring each run has a
 *    unique token that no other run can accidentally match.
 * 4. Empty-result guard — if the server returns [] AND prevData has real rows,
 *    the update is skipped to prevent blank-flash from transient auth gaps.
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

  // Monotonically increasing counter. Each run increments it and captures its
  // own value as `seq`. Callbacks guard on `runSeq.current !== seq` to
  // guarantee per-run isolation — even when multiple runs overlap in-flight.
  const runSeq = useRef(0);

  useEffect(() => {
    // This run's unique token. Incrementing before capturing ensures that
    // concurrent or rapid-fire runs each get a different seq.
    const seq = ++runSeq.current;

    if (!isLoggedIn) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    stableFn()
      .then((result) => {
        // Discard result if a newer run has started or the component unmounted
        if (runSeq.current !== seq) return;

        if (Array.isArray(result) && result.length > 0) {
          prevData.current = result;
          setData(result);
        } else if (prevData.current.length > 0) {
          // Server returned empty but we have previous data — keep it to avoid
          // a blank-flash from a transient auth gap or network blip.
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
        if (runSeq.current !== seq) return;
        const msg = err instanceof Error ? err.message : "Fetch failed";
        console.error("[useDataFetch] Error:", msg);
        // Restore previous data so the screen doesn't go blank on error
        setData(prevData.current.length > 0 ? prevData.current : null);
        setError(msg);
      })
      .finally(() => {
        if (runSeq.current === seq) setLoading(false);
      });

    return () => {
      // Increment to invalidate this run. The next run will increment again
      // before capturing its own seq, so it will always get a unique token.
      runSeq.current++;
    };
  // stableFn is already stabilised via useCallback above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, stableFn]);

  return { data, loading, error };
}
