import { useState, useEffect, useRef } from "react";
import { ShieldCheck, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ConfirmWithPasswordModalProps {
  open: boolean;
  /** Email of the currently signed-in admin (used to verify the password). */
  adminEmail: string;
  /** Title shown at the top of the modal. */
  title: string;
  /** Sub-text explaining what the admin is about to do. Use plain text. */
  description: string;
  /** Label for the confirmation button. e.g. "Delete user". */
  confirmLabel: string;
  /** Visual style — `danger` paints the confirm button red. */
  variant?: "default" | "danger";
  /** Called when the admin closes the modal without confirming. */
  onCancel: () => void;
  /** Called only after Supabase has accepted the password. */
  onConfirmed: () => void | Promise<void>;
}

/**
 * Re-authentication modal for high-impact admin actions.
 *
 * The verification calls supabase.auth.signInWithPassword({ email, password })
 * which:
 *   - returns an error if the password is wrong (we surface it inline)
 *   - returns success otherwise WITHOUT disrupting the existing session
 *     (the auth listener will fire SIGNED_IN with the same user.id, which
 *     our AuthContext now short-circuits as a no-op)
 *
 * This is the standard "step-up auth" pattern — the admin proves they're
 * still the human at the keyboard before we run something destructive.
 */
export function ConfirmWithPasswordModal({
  open,
  adminEmail,
  title,
  description,
  confirmLabel,
  variant = "default",
  onCancel,
  onConfirmed,
}: ConfirmWithPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal opens so a previous attempt's password
  // / error doesn't leak into the next confirmation.
  useEffect(() => {
    if (!open) return;
    setPassword("");
    setShowPass(false);
    setError(null);
    // Autofocus the password field for keyboard-only flow.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!password || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password,
      });
      if (verifyError) {
        setError("Incorrect password. Please try again.");
        setVerifying(false);
        return;
      }
      await onConfirmed();
      setVerifying(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-primary hover:bg-primary/90 text-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="reauth-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={verifying}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
          Confirm with your password
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            disabled={verifying}
            autoComplete="current-password"
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-slate-50 focus:bg-white disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={verifying}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={verifying || !password}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass}`}
          >
            {verifying ? "Verifying…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
