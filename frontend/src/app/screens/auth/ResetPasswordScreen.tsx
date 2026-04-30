import { useState, useMemo } from "react";
import { Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { BrandIcon } from "@/components/Brand";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  bar: string;
  checks: { label: string; passed: boolean }[];
}

function getStrength(password: string): StrengthResult {
  const checks = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Uppercase letter (A–Z)", passed: /[A-Z]/.test(password) },
    { label: "Number (0–9)", passed: /[0-9]/.test(password) },
    { label: "Special character (!@#…)", passed: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.passed).length;
  const levels: Record<number, { label: string; color: string; bar: string }> = {
    0: { label: "Too short", color: "text-slate-400", bar: "bg-slate-200" },
    1: { label: "Weak", color: "text-red-500", bar: "bg-red-400" },
    2: { label: "Fair", color: "text-orange-500", bar: "bg-orange-400" },
    3: { label: "Medium", color: "text-amber-500", bar: "bg-amber-400" },
    4: { label: "Strong", color: "text-green-600", bar: "bg-green-500" },
  };
  return { score, checks, ...levels[score] };
}

export function ResetPasswordScreen() {
  const { setStep } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => getStrength(password), [password]);
  const confirmMismatch = confirm.length > 0 && password !== confirm;

  const handleReset = async () => {
    if (strength.score < 2) { setError("Please choose a stronger password."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message || "Could not update password. Please try again.");
    } else {
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 flex flex-col">
      {/* Branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-6">
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-3xl mb-4">
          <BrandIcon size={48} alt="StegoTags" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1.5">StegoTags</h1>
        <p className="text-blue-100 text-sm text-center">Smart QR tags for everything that matters</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-7 pb-10 shadow-2xl">

        {done ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Password updated!</h2>
              <p className="text-sm text-slate-500 mt-1">Your new password is now active. Sign in to continue.</p>
            </div>
            <button
              onClick={() => setStep("login")}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
            >
              Back to Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">Set new password</h2>
                <p className="text-xs text-slate-400 mt-0.5">Choose a strong password for your account</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* New password */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">New Password</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Enter new password"
                    className="flex-1 bg-transparent text-sm text-slate-900 font-medium outline-none placeholder:text-slate-400"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoFocus
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && (
                  <div className="space-y-2">
                    {/* Bar */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-all duration-300",
                            i <= strength.score ? strength.bar : "bg-slate-100"
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px] font-bold", strength.color)}>{strength.label}</span>
                    </div>
                    {/* Checklist */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {strength.checks.map((c) => (
                        <div key={c.label} className="flex items-center gap-1.5">
                          <div className={cn("w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0",
                            c.passed ? "bg-green-500" : "bg-slate-200"
                          )}>
                            {c.passed && (
                              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={cn("text-[10px] font-medium", c.passed ? "text-green-600" : "text-slate-400")}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Confirm New Password</label>
                <div className={cn(
                  "flex items-center gap-3 bg-slate-50 border rounded-2xl px-4 py-3.5 transition-all",
                  confirmMismatch
                    ? "border-rose-300 focus-within:ring-2 focus-within:ring-rose-100"
                    : "border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                )}>
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter new password"
                    className="flex-1 bg-transparent text-sm text-slate-900 font-medium outline-none placeholder:text-slate-400"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                  />
                  <button onClick={() => setShowConfirm(!showConfirm)} className="text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmMismatch && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <p className="text-[11px] font-semibold text-rose-500">Passwords do not match</p>
                  </div>
                )}
              </div>

              {/* General error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-rose-600">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleReset}
                disabled={!password || !confirm || loading || strength.score < 2}
                className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Update Password <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
