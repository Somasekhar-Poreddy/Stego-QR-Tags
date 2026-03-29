import { useState, useRef, useEffect } from "react";
import { QrCode, Mail, ArrowRight, Eye, EyeOff, ChevronLeft, CheckCircle2, RefreshCw, KeyRound, MessageSquare } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";

type LoginMode = "password" | "otp" | "forgot";

// ── Reusable 8-box OTP input ──────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(8, "").split("").slice(0, 8);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const next = digits.map((d, idx) => (idx === i ? "" : d)).join("").replace(/\s/g, "");
      onChange(next);
      if (i > 0) refs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const arr = digits.map((d) => (d === " " ? "" : d));
    arr[i] = digit;
    onChange(arr.join("").replace(/\s/g, ""));
    if (digit && i < 7) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 7)]?.focus();
  };

  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: 8 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]?.trim() || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "w-9 h-11 text-center text-base font-bold rounded-xl border-2 bg-slate-50 outline-none transition-all",
            digits[i]?.trim() ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-900",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}

export function LoginScreen() {
  const { setStep, signInWithEmail, sendLoginOtp, verifyLoginOtp, sendPasswordReset, authError, setAuthError } = useAuth();

  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP login state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = (seconds = 30) => {
    setResendSeconds(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const parseRateLimitSeconds = (msg: string): number | null => {
    const match = msg.match(/(\d+)\s*second/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setAuthError(null);
    setOtpSent(false);
    setOtp("");
    setOtpError(null);
    setResetSent(false);
    setResetError(null);
  };

  // ── Password sign in ────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    setAuthError(null);
    await signInWithEmail(email, password);
    setLoading(false);
  };

  // ── OTP login: send code ────────────────────────────────────────────────
  const handleSendLoginOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError("Enter a valid email address");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    const err = await sendLoginOtp(email);
    setOtpLoading(false);
    if (err) {
      const secs = parseRateLimitSeconds(err);
      if (secs) {
        startResendTimer(secs);
        setOtpSent(true);
      } else {
        setOtpError(err);
      }
    } else {
      setOtpSent(true);
      setOtp("");
      startResendTimer();
    }
  };

  // ── OTP login: verify code ──────────────────────────────────────────────
  const handleVerifyLoginOtp = async () => {
    if (otp.length !== 8) { setOtpError("Enter the complete 8-digit code"); return; }
    setOtpLoading(true);
    setOtpError(null);
    await verifyLoginOtp(email, otp);
    setOtpLoading(false);
  };

  // ── Forgot password ─────────────────────────────────────────────────────
  const handleSendReset = async () => {
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetError("Enter a valid email address");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    const err = await sendPasswordReset(resetEmail);
    setResetLoading(false);
    if (err) {
      setResetError(err);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 flex flex-col">
      {/* Branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-6">
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-3xl mb-4">
          <QrCode className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1.5">Stegofy</h1>
        <p className="text-blue-100 text-sm text-center">Smart QR tags for everything that matters</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-7 pb-10 shadow-2xl">

        {/* ── Forgot Password view ─────────────────────────────────────── */}
        {mode === "forgot" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => switchMode("password")}
                className="p-1.5 -ml-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">Forgot Password</h2>
                <p className="text-xs text-slate-400 mt-0.5">We'll send a reset link to your email</p>
              </div>
            </div>

            {resetSent ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Reset link sent!</p>
                <p className="text-xs text-slate-500">
                  Check your inbox at <span className="font-semibold text-primary">{resetEmail}</span> and click the link to reset your password.
                </p>
                <button
                  onClick={() => switchMode("password")}
                  className="mt-3 w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-3.5 rounded-2xl text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="flex-1 bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-400"
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setResetError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendReset()}
                    autoFocus
                  />
                </div>

                {resetError && (
                  <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    {resetError}
                  </p>
                )}

                <button
                  onClick={handleSendReset}
                  disabled={!resetEmail || resetLoading}
                  className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {resetLoading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Password + OTP tabs ──────────────────────────────────────── */}
        {mode !== "forgot" && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-4">Sign in to your Stegofy account</p>

            {/* Mode toggle */}
            <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
              <button
                onClick={() => switchMode("password")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
                  mode === "password"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <KeyRound className="w-3.5 h-3.5" /> Password
              </button>
              <button
                onClick={() => switchMode("otp")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
                  mode === "otp"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Login with OTP
              </button>
            </div>

            {/* ── Password mode ─────────────────────────────────────── */}
            {mode === "password" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="email"
                    placeholder="Email address"
                    className="flex-1 bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-400"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                    autoComplete="email"
                    onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Password"
                    className="flex-1 bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-400"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {authError && (
                  <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    {authError}
                  </p>
                )}

                <button
                  onClick={handleSignIn}
                  disabled={!email || !password || loading}
                  className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <button
                  onClick={() => switchMode("forgot")}
                  className="w-full text-xs text-primary text-center font-semibold py-1 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* ── OTP mode ──────────────────────────────────────────── */}
            {mode === "otp" && (
              <div className="space-y-3">
                <div className={cn(
                  "flex items-center gap-3 bg-slate-50 border rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all",
                  otpSent ? "border-primary/40 bg-primary/5" : "border-slate-200"
                )}>
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="email"
                    placeholder="Email address"
                    className="flex-1 bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-400"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setOtpSent(false);
                      setOtp("");
                      setOtpError(null);
                    }}
                    disabled={otpSent}
                    autoComplete="email"
                  />
                  {otpSent && (
                    <button
                      onClick={() => { setOtpSent(false); setOtp(""); setOtpError(null); }}
                      className="text-[10px] text-primary font-bold px-2 py-0.5 bg-primary/10 rounded-lg"
                    >
                      Change
                    </button>
                  )}
                </div>

                {otpError && !otpSent && (
                  <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    {otpError}
                  </p>
                )}

                {!otpSent ? (
                  <button
                    onClick={handleSendLoginOtp}
                    disabled={!email || otpLoading}
                    className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {otpLoading ? (
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Send OTP <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700 text-center">
                      Code sent to <span className="text-primary">{email}</span>. Check your inbox.
                    </p>

                    <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />

                    {authError && (
                      <p className="text-[11px] text-red-500 font-medium text-center">{authError}</p>
                    )}
                    {otpError && (
                      <p className="text-[11px] text-red-500 font-medium text-center">{otpError}</p>
                    )}

                    <button
                      onClick={handleVerifyLoginOtp}
                      disabled={otp.length !== 8 || otpLoading}
                      className="w-full bg-gradient-to-r from-primary to-violet-600 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {otpLoading ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Verify & Sign In <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <div className="flex items-center justify-center">
                      {resendSeconds > 0 ? (
                        <p className="text-[11px] text-slate-400">
                          Resend in <span className="font-bold text-primary">{resendSeconds}s</span>
                        </p>
                      ) : (
                        <button
                          onClick={handleSendLoginOtp}
                          disabled={otpLoading}
                          className="text-[11px] text-primary font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" /> Resend code
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Divider + Sign Up */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">Don't have an account?</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <button
              onClick={() => { setAuthError(null); setStep("signup"); }}
              className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl text-sm hover:border-primary hover:text-primary transition-all active:scale-[0.98]"
            >
              Create an account
            </button>

            <p className="text-center text-xs text-slate-400 mt-4">
              By continuing, you agree to our{" "}
              <a href="#terms" className="text-primary font-medium">Terms</a> &{" "}
              <a href="#privacy" className="text-primary font-medium">Privacy Policy</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
