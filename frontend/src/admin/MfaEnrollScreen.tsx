import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, AlertTriangle, Check, Copy } from "lucide-react";
import QRCodeLib from "qrcode";
import { supabase } from "@/lib/supabase";

/**
 * One-time enrollment flow for TOTP MFA.
 *
 * 1. Calls supabase.auth.mfa.enroll({ factorType: 'totp' }) which returns
 *    a QR-code URI (otpauth://) + a base-32 secret.
 * 2. Renders the QR code so the admin can scan it with Google Authenticator
 *    / Authy / 1Password / etc., and shows the secret as a fallback.
 * 3. Asks for the first 6-digit code to confirm enrollment via .verify().
 *
 * After successful enrollment the session is automatically AAL2 — no
 * separate challenge needed for the rest of this session.
 */
export function MfaEnrollScreen({ onEnrolled }: { onEnrolled: () => void }) {
  const [, navigate] = useLocation();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startEnrollment() {
      setEnrolling(true);
      setError(null);
      try {
        // If a previous unverified factor exists, unenroll it first so we
        // don't pile up dangling enrollment attempts. listFactors's TS
        // signature only declares `verified` factors, but unverified ones
        // are returned at runtime — cast through unknown to inspect them.
        const existing = await supabase.auth.mfa.listFactors();
        if (existing.data?.totp) {
          for (const f of existing.data.totp as unknown as Array<{ id: string; status: string }>) {
            if (f.status !== "verified") {
              await supabase.auth.mfa.unenroll({ factorId: f.id });
            }
          }
        }

        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Stegofy Admin (${new Date().toLocaleDateString()})`,
        });
        if (cancelled) return;
        if (enrollErr) {
          setError(enrollErr.message);
          return;
        }
        setFactorId(data.id);
        setSecret(data.totp.secret);
        const dataUrl = await QRCodeLib.toDataURL(data.totp.uri, { width: 220 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Enrollment failed.");
      } finally {
        if (!cancelled) setEnrolling(false);
      }
    }

    startEnrollment();
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
        setError("Incorrect code. Make sure your phone's time is in sync and try again.");
        setCode("");
        return;
      }
      onEnrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const cancel = async () => {
    if (factorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId });
      } catch {}
    }
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-violet-600 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 gap-3">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white">Set up Two-Factor</h1>
            <p className="text-white/70 text-sm mt-1">
              Required for super admin access
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          {enrolling && (
            <div className="text-center py-8 text-sm text-slate-500">
              Generating your authenticator code…
            </div>
          )}

          {!enrolling && qrDataUrl && (
            <>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
                <li>Install Google Authenticator, Authy, or 1Password.</li>
                <li>Scan the QR code below.</li>
                <li>Enter the 6-digit code your app shows.</li>
              </ol>

              <div className="flex justify-center bg-slate-50 rounded-xl p-3">
                <img src={qrDataUrl} alt="MFA QR code" className="w-40 h-40" />
              </div>

              {secret && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-700">
                    Can't scan? Show secret to enter manually
                  </summary>
                  <div className="mt-2 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 font-mono text-[11px] text-slate-700">
                    <span className="flex-1 break-all">{secret}</span>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="flex-shrink-0 text-slate-400 hover:text-primary transition-colors"
                      aria-label="Copy secret"
                    >
                      {secretCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </details>
              )}

              <form onSubmit={verify} className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500">
                  6-digit verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold py-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary transition-colors bg-slate-50 focus:bg-white"
                />

                {error && (
                  <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={code.length !== 6 || verifying}
                  className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifying ? "Verifying…" : "Activate"}
                </button>

                <button
                  type="button"
                  onClick={cancel}
                  disabled={verifying}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel and sign out
                </button>
              </form>
            </>
          )}

          {!enrolling && error && !qrDataUrl && (
            <>
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={cancel}
                className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
