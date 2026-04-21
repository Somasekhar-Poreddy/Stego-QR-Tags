import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Shown to an admin who has TOTP MFA enrolled but hasn't completed the
 * second factor yet for this session. Asks for the 6-digit code from their
 * authenticator app and elevates the session to AAL2 on success.
 */
export function MfaChallengeScreen({ onVerified }: { onVerified: () => void }) {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pick the first verified TOTP factor on mount.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data, error: listErr }) => {
      if (cancelled) return;
      if (listErr) {
        setError(listErr.message);
        return;
      }
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        setError("No verified authenticator app found on this account.");
        return;
      }
      setFactorId(totp.id);
      inputRef.current?.focus();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!factorId || code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }
      const verifyRes = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verifyRes.error) {
        setError("Incorrect code. Please try again.");
        setCode("");
        return;
      }
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const cancel = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-violet-600 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white">Two-Factor Required</h1>
            <p className="text-white/70 text-sm mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        </div>

        <form onSubmit={verify} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-3 rounded-xl border border-slate-200 outline-none focus:border-primary transition-colors bg-slate-50 focus:bg-white"
          />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || verifying || !factorId}
            className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={cancel}
            disabled={verifying}
            className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            Sign in with a different account
          </button>
        </form>
      </div>
    </div>
  );
}
