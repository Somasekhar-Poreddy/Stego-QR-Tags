import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Eye, EyeOff, AlertTriangle, Lock } from "lucide-react";
import { BrandIcon } from "@/components/Brand";
import { supabase } from "@/lib/supabase";

/** Hash of UA + screen size — best-effort device fingerprint without any PII. */
async function deviceFingerprint(): Promise<string> {
  const raw = `${navigator.userAgent}|${navigator.platform}|${screen.width}x${screen.height}|${navigator.language}`;
  const buf = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AdminLogin() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const reason = new URLSearchParams(search).get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const [secondsUntilUnlock, setSecondsUntilUnlock] = useState(0);

  // Live countdown while the lock is active.
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
      setSecondsUntilUnlock(secs);
      if (secs === 0) setLockUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // When the email field changes, query the lock state for that email so the
  // admin sees "Try again in 12 min" before submitting (instead of being
  // told only after they type their password).
  useEffect(() => {
    const trimmed = email.trim();
    if (trimmed.length < 3 || !trimmed.includes("@")) {
      setLockUntil(null);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("check_admin_login_lock", { p_email: trimmed });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.locked && row.unlock_at) {
        setLockUntil(new Date(row.unlock_at));
      } else {
        setLockUntil(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil) return;
    setError(null);
    setLoading(true);
    try {
      // Run lock check + sign-in in parallel — they're independent and the
      // server-side lock check inside Supabase auth handles the atomicity.
      // This roughly halves the perceived login latency.
      const trimmed = email.trim();
      const [lockResult, authResult] = await Promise.all([
        supabase.rpc("check_admin_login_lock", { p_email: trimmed }),
        supabase.auth.signInWithPassword({ email, password }),
      ]);

      const lockRow = Array.isArray(lockResult.data) ? lockResult.data[0] : lockResult.data;
      if (lockRow?.locked && lockRow.unlock_at) {
        // Locked: sign out the just-created session if any, show lock UI.
        if (!authResult.error) await supabase.auth.signOut().catch(() => null);
        setLockUntil(new Date(lockRow.unlock_at));
        setError("Too many failed attempts. Please wait before trying again.");
        return;
      }

      if (authResult.error) {
        // Record failure + re-check lock (these can run in parallel too).
        const [, postFail] = await Promise.all([
          supabase.rpc("record_admin_login_failure", {
            p_email: trimmed,
            p_ip_hash: null,
            p_user_agent: navigator.userAgent.slice(0, 200),
          }),
          supabase.rpc("check_admin_login_lock", { p_email: trimmed }),
        ]);
        const postRow = Array.isArray(postFail.data) ? postFail.data[0] : postFail.data;
        if (postRow?.locked && postRow.unlock_at) {
          setLockUntil(new Date(postRow.unlock_at));
          setError("Too many failed attempts. Account locked for 15 minutes.");
        } else {
          const left = Math.max(0, 5 - (postRow?.failures ?? 0));
          setError(
            left > 0
              ? `${authResult.error.message} (${left} attempt${left === 1 ? "" : "s"} left before lockout)`
              : authResult.error.message,
          );
        }
        return;
      }

      // Successful login — navigate immediately, run cleanup + telemetry in
      // the background so the user doesn't wait for them to land on /admin.
      navigate("/admin");

      void (async () => {
        try {
          const fp = await deviceFingerprint().catch(() => "");
          const userId = authResult.data.session?.user?.id ?? authResult.data.user?.id;
          await Promise.all([
            supabase.rpc("clear_admin_login_failures", { p_email: trimmed }),
            userId
              ? supabase.from("user_activity_logs").insert({
                  user_id: userId,
                  event_type: "admin_login",
                  metadata: {
                    user_agent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                  },
                  device_fingerprint: fp,
                })
              : Promise.resolve(),
          ]);
        } catch {
          // Telemetry failures must not affect the user — they're already in.
        }
      })();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-violet-600 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="bg-white/20 rounded-2xl backdrop-blur-sm p-2">
            <BrandIcon size={56} alt="StegoTags" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white">StegoTags Admin</h1>
            <p className="text-white/70 text-sm mt-1">Sign in to access the dashboard</p>
          </div>
        </div>

        {(reason === "expired" || reason === "idle" || reason === "absolute" || reason === "manual") && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <span>
              {reason === "idle" && "You were signed out due to inactivity. Please sign in again."}
              {reason === "absolute" && "Your session reached its 12-hour limit. Please sign in again."}
              {reason === "manual" && "You were signed out. Sign in to continue."}
              {reason === "expired" && "Your session expired. Please sign in again to continue."}
            </span>
          </div>
        )}

        {(reason === "not-admin" || reason === "admin-check-failed") && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <span>
              {reason === "not-admin" &&
                "This account doesn't have admin access. Sign in with an admin account, or contact a super admin to request access."}
              {reason === "admin-check-failed" &&
                "We couldn't verify admin permissions right now. Try again in a moment — if it keeps happening, contact a super admin."}
            </span>
          </div>
        )}

        {lockUntil && secondsUntilUnlock > 0 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <span>
              Account temporarily locked due to repeated failed sign-ins. Try again in
              {" "}
              <span className="font-semibold">
                {Math.floor(secondsUntilUnlock / 60)}m {secondsUntilUnlock % 60}s
              </span>
              .
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-slate-50 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!lockUntil}
            className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : lockUntil ? "Locked" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-white/50 text-xs mt-6">
          StegoTags Super Admin Panel
        </p>
      </div>
    </div>
  );
}
