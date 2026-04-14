import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";

/**
 * Data-fetching hook with stability guarantees.
 * - Auth guard: skips fetch when user is not logged in.
 * - Stale-result prevention: per-effect `cancelled` flag, set in cleanup.
 * - Previous-data retention: `prevData` ref keeps last good result visible
 *   during transient empty responses or errors (no blank-flash).
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

  useEffect(() => {
    // Per-effect flag — closure ensures each run tracks its own cancelled state
    // independently, so results from superseded or unmounted runs are discarded.
    let cancelled = false;

    if (!isLoggedIn) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    stableFn()
      .then((result) => {
        if (cancelled) return;

        if (Array.isArray(result) && result.length > 0) {
          prevData.current = result;
          setData(result);
        } else if (prevData.current.length > 0) {
          setData(prevData.current);
        } else {
          setData(result ?? []);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Fetch failed";
        setData(prevData.current.length > 0 ? prevData.current : null);
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // stableFn is already stabilised via useCallback above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, stableFn]);

  return { data, loading, error };
}
