import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Tracks user inactivity and triggers a logout after `idleMs` of no input.
 * Shows a warning state for the final `warningMs` of the idle window so the
 * UI can render a "session expiring soon" modal with a "Stay signed in"
 * button that resets the timer.
 *
 * Activity = mouse move, key press, click, scroll, touch.
 *
 * The hook is timezone- and tab-aware:
 * - Uses `Date.now()` so it isn't affected by background-tab throttling that
 *   would otherwise let setTimeout fire late.
 * - Listens to `visibilitychange` so when the tab is restored we re-evaluate
 *   immediately rather than waiting for the next tick.
 */
export interface UseIdleLogoutOptions {
  /** Total idle window before forced logout. */
  idleMs: number;
  /** Window before logout during which `warning` is true (modal visible). */
  warningMs: number;
  /** Called when the idle window has fully elapsed. */
  onLogout: () => void;
  /** When false, the hook is a no-op (e.g. for the public/user app). */
  enabled?: boolean;
}

export function useIdleLogout({
  idleMs,
  warningMs,
  onLogout,
  enabled = true,
}: UseIdleLogoutOptions) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  // Reset to "fully active" state.
  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
    setSecondsLeft(Math.ceil(warningMs / 1000));
  }, [warningMs]);

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => {
      // Don't auto-reset if the warning modal is showing — the user must
      // explicitly click "Stay signed in" so we know they're actually present.
      if (!warning) lastActivityRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      const timeUntilLogout = idleMs - idleFor;

      if (timeUntilLogout <= 0) {
        onLogoutRef.current();
        return;
      }
      if (timeUntilLogout <= warningMs) {
        setWarning(true);
        setSecondsLeft(Math.ceil(timeUntilLogout / 1000));
      } else if (warning) {
        setWarning(false);
      }
    };

    // Tick once a second — cheap, and gives the modal countdown smooth updates.
    const interval = setInterval(tick, 1000);

    // When the tab comes back to the foreground, evaluate immediately rather
    // than waiting up to a second.
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [enabled, idleMs, warningMs, warning]);

  return { warning, secondsLeft, reset };
}
