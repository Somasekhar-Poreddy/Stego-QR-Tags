import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

// Check the session every 30s — well below the ~60min token lifetime, so we
// always have a chance to refresh before expiry without flooding the network.
const KEEPALIVE_INTERVAL_MS = 30 * 1000;
// Refresh when fewer than 2 minutes remain.
const REFRESH_THRESHOLD_SECS = 120;

export function useSessionKeepalive(): {
  sessionOk: boolean;
  reconnecting: boolean;
} {
  const [sessionOk, setSessionOk] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    let cancelled = false;

    function goToLogin() {
      navigateRef.current("/admin/login?reason=expired");
    }

    // Only listen for hard SIGNED_OUT — Supabase fires TOKEN_REFRESHED and
    // SIGNED_IN on every tab focus, and flipping `reconnecting` on those
    // would render the "Reconnecting session…" banner spuriously.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSessionOk(false);
      } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        setSessionOk(true);
        setReconnecting(false);
      }
    });

    async function checkAndRefresh() {
      if (cancelled) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
        if (secsLeft >= REFRESH_THRESHOLD_SECS) return;

        setReconnecting(true);
        let error: { message?: string } | null = null;
        try {
          const result = await supabase.auth.refreshSession();
          error = result.error;
        } catch (e) {
          error = e as { message?: string };
        }
        if (cancelled) return;

        // Multi-tab lock contention: another tab is refreshing right now.
        // That's fine — we don't need to redirect to login. Just back off
        // for this tick and trust the other tab's refresh to succeed.
        const msg = (error?.message ?? "").toLowerCase();
        const isLockContention =
          msg.includes("lock") && (msg.includes("stole") || msg.includes("released"));
        if (error && isLockContention) {
          setReconnecting(false);
          return;
        }

        if (error) {
          setSessionOk(false);
          setReconnecting(false);
          goToLogin();
        } else {
          setSessionOk(true);
          setReconnecting(false);
        }
      } catch {
        // Swallow transient errors — we'll try again next tick.
      }
    }

    // Run an immediate check so we don't have to wait 30s after mount.
    void checkAndRefresh();
    const interval = setInterval(checkAndRefresh, KEEPALIVE_INTERVAL_MS);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { sessionOk, reconnecting };
}