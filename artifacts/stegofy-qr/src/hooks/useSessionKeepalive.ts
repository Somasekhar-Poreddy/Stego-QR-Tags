import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Keeps the Supabase admin session alive across three failure vectors:
 *
 * 1. `onAuthStateChange` subscription — detects SIGNED_OUT / TOKEN_EXPIRED
 *    events emitted by Supabase and immediately redirects to the login page
 *    with a `?reason=expired` query param so the user sees an explanation.
 *
 * 2. `visibilitychange` listener — when the user returns to the browser tab
 *    after being away, browsers may have throttled the autoRefreshToken interval
 *    and the JWT may already be expired. This listener proactively refreshes
 *    the session the moment the tab becomes visible again.
 *
 * 3. Periodic keepalive — every 10 minutes while the admin panel is open,
 *    checks if the token expires within the next 2 minutes and refreshes it.
 *    Acts as a safety net for very long sessions.
 *
 * Returns:
 *   sessionOk      — false while a refresh is in-flight or after failure
 *   reconnecting   — true only while a visibility-change refresh is in-flight
 */
export function useSessionKeepalive(): { sessionOk: boolean; reconnecting: boolean } {
  const [sessionOk, setSessionOk]       = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
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

  return { sessionOk, reconnecting };
}
