import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Keeps the Supabase admin session alive across three failure vectors:
 *
 * 1. `onAuthStateChange` subscription — detects SIGNED_OUT events emitted
 *    by Supabase and immediately redirects to the login page with
 *    `?reason=expired` so the user sees an explanation.
 *    On TOKEN_REFRESHED, increments `refreshKey` so AdminRouter can signal
 *    screens to reload data after a successful session restore.
 *
 * 2. `visibilitychange` listener — when the user returns to the browser tab
 *    after being away, browsers may have throttled the autoRefreshToken
 *    interval and the JWT may already be expired. This listener proactively
 *    refreshes the session the moment the tab becomes visible again.
 *
 * 3. Periodic keepalive — every 10 minutes while the admin panel is open,
 *    checks if the token expires within the next 2 minutes and refreshes it.
 *
 * Returns:
 *   sessionOk    — false while a refresh is in-flight or after failure
 *   reconnecting — true only while a visibility-change refresh is in-flight
 *   refreshKey   — counter that increments after each successful TOKEN_REFRESHED;
 *                  AdminRouter keys the <Switch> on this so screens remount
 *                  and re-fetch data automatically after reconnect
 */
export function useSessionKeepalive(): {
  sessionOk: boolean;
  reconnecting: boolean;
  refreshKey: number;
} {
  const [sessionOk, setSessionOk]       = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [refreshKey, setRefreshKey]     = useState(0);
  const [, navigate]                   = useLocation();
  const navigateRef                     = useRef(navigate);
  navigateRef.current                   = navigate;

  useEffect(() => {
    function goToLogin() {
      navigateRef.current("/admin/login?reason=expired");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSessionOk(false);
        goToLogin();
      } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        setSessionOk(true);
        setReconnecting(false);
        setRefreshKey((k) => k + 1);
      }
    });

    async function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      setReconnecting(true);
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        setSessionOk(false);
        setReconnecting(false);
        goToLogin();
      } else {
        setSessionOk(true);
        setReconnecting(false);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        goToLogin();
        return;
      }

      const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
      if (secsUntilExpiry < 120) {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          setSessionOk(false);
          goToLogin();
        }
      }
    }, KEEPALIVE_INTERVAL_MS);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return { sessionOk, reconnecting, refreshKey };
}
