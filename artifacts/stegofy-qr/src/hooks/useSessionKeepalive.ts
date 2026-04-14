import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;

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
    function goToLogin() {
      navigateRef.current("/admin/login?reason=expired");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSessionOk(false);
        goToLogin();
      } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        setSessionOk(true);
        setReconnecting(false);
      }
    });

    // Keep only periodic background refresh
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);

      if (secsLeft < 120) {
        setReconnecting(true);
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          setSessionOk(false);
          goToLogin();
        } else {
          setSessionOk(true);
          setReconnecting(false);
        }
      }
    }, KEEPALIVE_INTERVAL_MS);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { sessionOk, reconnecting };
}