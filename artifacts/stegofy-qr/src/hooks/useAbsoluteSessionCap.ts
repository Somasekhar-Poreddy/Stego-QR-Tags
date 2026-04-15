import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "stegofy_admin_login_at";
const CHECK_INTERVAL_MS = 60 * 1000; // re-check every minute
const DEFAULT_CAP_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Stamps the time the admin started their current session and force-signs
 * them out once `capMs` has elapsed regardless of activity. This is the
 * "even-active sessions can't live forever" guarantee that idle-timeout
 * alone doesn't give you — it bounds the worst-case age of any admin
 * session, which limits the blast radius of a stolen browser session.
 *
 * Implementation notes:
 * - The login timestamp is stored in localStorage and re-used across page
 *   reloads in the same session.
 * - If no timestamp is found (first run after this hook ships, or the
 *   admin signed in before we started tracking), we stamp it lazily on
 *   mount so existing sessions get a 12-hour grace period rather than
 *   being booted immediately.
 * - The supabase auth listener resets the stamp on SIGNED_IN so a fresh
 *   login always gets the full window.
 */
export function useAbsoluteSessionCap(opts: {
  capMs?: number;
  enabled?: boolean;
  onExpired: () => void;
}) {
  const { capMs = DEFAULT_CAP_MS, enabled = true, onExpired } = opts;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    function readLoginAt(): number {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    }

    function stamp(now = Date.now()) {
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // ignore — quota / privacy mode
      }
    }

    function clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }

    // Lazy stamp: if no record exists, pretend the session just started so
    // existing logins get a fresh 12h rather than an instant boot.
    if (!readLoginAt()) stamp();

    const tick = () => {
      if (cancelled) return;
      const loginAt = readLoginAt();
      if (!loginAt) return;
      if (Date.now() - loginAt >= capMs) {
        clear();
        onExpired();
      }
    };

    // Auth-listener side: keep the stamp in sync with login/logout events.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") stamp();
      if (event === "SIGNED_OUT") clear();
    });

    tick(); // immediate
    const interval = setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [capMs, enabled, onExpired]);
}
