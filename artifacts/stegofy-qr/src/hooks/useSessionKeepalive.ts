import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { AUTH_EXPIRED_EVENT } from "@/lib/adminAuth";

const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Keeps the Supabase admin session alive across three failure vectors:
 *
 * 1. `onAuthStateChange` subscription — handles these events:
 *    - SIGNED_OUT: fires when either the user signs out manually OR when the
 *      refresh token itself is expired (Supabase's equivalent of TOKEN_EXPIRED
 *      in other auth systems). Redirects to /admin/login?reason=expired.
 *    - TOKEN_REFRESHED: fires after a successful proactive refresh; marks
 *      session as ok and clears the reconnecting banner.
 *    - SIGNED_IN: same as TOKEN_REFRESHED for session restoration purposes.
 *
 * 2. `visibilitychange` listener — when the user returns to the browser tab
 *    after being away, browsers may have throttled the autoRefreshToken
 *    setInterval and the JWT may already be expired. This listener proactively
 *    calls refreshSession() the moment the tab becomes visible again.
 *
 * 3. Periodic keepalive — every 10 minutes, checks if the token expires within
 *    the next 2 minutes and refreshes it proactively. Acts as a safety net for
 *    very long sessions where the visibility-change handler wasn't triggered.
 *
 * Returns:
 *   sessionOk    — false while a refresh is in-flight or after failure
 *   reconnecting — true only while a visibility-change refresh is in-flight
 */
export function useSessionKeepalive(): {
  sessionOk: boolean;
  reconnecting: boolean;
} {
  const [sessionOk, setSessionOk]       = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [, navigate]                   = useLocation();
  const navigateRef                     = useRef(navigate);
  navigateRef.current                   = navigate;

  useEffect(() => {
    function goToLogin() {
      // Dispatch global auth-expired event so any in-flight service calls
      // know the session is gone, then navigate to the login page.
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      navigateRef.current("/admin/login?reason=expired");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // SIGNED_OUT covers both manual sign-out and refresh-token expiry
      // (Supabase's equivalent of a TOKEN_EXPIRED event in other systems).
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

      // Only refresh if the token is actually close to expiry.
      // Do NOT refresh unconditionally — it triggers unnecessary re-renders.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { goToLogin(); return; }

      const secsUntilExpiry = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);

      // Only show reconnecting banner and refresh if token expires within 3 minutes
      if (secsUntilExpiry < 180) {
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
      // If token has more than 3 minutes left, do nothing — session is fine
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
