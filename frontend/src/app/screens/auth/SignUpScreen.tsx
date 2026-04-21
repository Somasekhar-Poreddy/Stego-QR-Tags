import { useState, useRef, useEffect } from "react";
import { ChevronLeft, User, Mail, Phone, Eye, EyeOff, ChevronDown, CheckCircle2, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth, SignUpData } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const AGE_GROUPS = ["Under 18", "18–25", "26–35", "36–45", "46–55", "56 and above"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

function FieldWrapper({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600 block">{label}</label>
      {children}
      {error && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <AlertCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
          <p className="text-[11px] font-semibold text-rose-500">{error}</p>
        </div>
      )}
    </div>
  );
}

function InputRow({ icon: Icon, children, className }: { icon?: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all",
      className
    )}>
      {Icon && <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      {children}
    </div>
  );
}

// 6 separate digit boxes
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
    const joined = arr.join("").replace(/\s/g, "");
    onChange(joined);
    if (digit && i < 7) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, 7);
    refs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
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
            "w-11 h-12 text-center text-lg font-bold rounded-xl border-2 bg-slate-50 outline-none transition-all",
            digits[i]?.trim()
              ? "border-primary bg-primary/5 text-primary"
              : "border-slate-200 text-slate-900",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}

export function SignUpScreen() {
  const { setStep, signUpWithEmail, completeOtpSignup, beginOtpVerification, authError, setAuthError } = useAuth();

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    password: "", confirmPassword: "", mobile: "", ageGroup: "", gender: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = () => {
    setResendSeconds(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const set = (key: string, val: string) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: "" }));
    setAuthError(null);
    if (key === "email") { setOtpSent(false); setEmailVerified(false); setOtp(""); setOtpError(null); }
  };

  // Step 1: Send OTP to email
  const handleSendOtp = async () => {
    // Caution: first name and last name must be filled before we can verify email
    const nameErrors: Record<string, string> = {};
    if (!form.firstName.trim()) nameErrors.firstName = "Enter your first name before verifying email";
    if (!form.lastName.trim()) nameErrors.lastName = "Enter your last name before verifying email";
    if (Object.keys(nameErrors).length > 0) {
      setErrors((p) => ({ ...p, ...nameErrors }));
      return;
    }

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrors((p) => ({ ...p, email: "Enter a valid email address first" }));
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    // Use signUp (not signInWithOtp) so first_name + last_name are passed as metadata.
    // This lets the DB trigger insert the profile row correctly — no "Database error" anymore.
    // A random temp password is used here; the real password is set after OTP verification.
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!1";

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: tempPassword,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
        },
      },
    });

    setOtpLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setOtpError("An account with this email already exists. Try signing in instead.");
      } else {
        setOtpError(error.message || "Could not send verification code. Please try again.");
      }
    } else {
      beginOtpVerification(); // suppress auto-navigation until form is submitted
      setOtpSent(true);
      setOtp("");
      startResendTimer();
    }
  };

  // Step 2: Verify the 6-digit OTP
  const handleVerifyOtp = async () => {
    if (otp.length !== 8) {
      setOtpError("Enter the complete 8-digit code");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);

    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token: otp,
      type: "signup",
    });

    setOtpLoading(false);
    if (error) {
      setOtpError(error.message || "Invalid or expired code. Try again.");
    } else {
      setEmailVerified(true);
      setOtpSent(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!emailVerified) errs.email = "Please verify your email first";
    if (!form.password || form.password.length < 6) errs.password = "Min 6 characters";
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (!form.mobile || form.mobile.length < 10) errs.mobile = "Enter valid 10-digit mobile number";
    if (!form.ageGroup) errs.ageGroup = "Please select age group";
    if (!form.gender) errs.gender = "Please select gender";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);

    const payload: SignUpData = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      mobile: form.mobile,
      ageGroup: form.ageGroup,
      gender: form.gender,
    };

    if (emailVerified) {
      // Email was verified via OTP — user already has a session, just update password + save profile
      await completeOtpSignup(payload);
    } else {
      // Fallback: standard Supabase signup (sends confirmation email)
      await signUpWithEmail(payload);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => { setAuthError(null); setStep("login"); }}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Create Account</h1>
          <p className="text-xs text-slate-400 mt-0.5">Fill in the details below to get started</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <FieldWrapper label="First Name" error={errors.firstName}>
            <InputRow icon={User}>
              <input type="text" placeholder="John"
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
                value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </InputRow>
          </FieldWrapper>
          <FieldWrapper label="Last Name" error={errors.lastName}>
            <InputRow>
              <input type="text" placeholder="Doe"
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
                value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </InputRow>
          </FieldWrapper>
        </div>

        {/* Email + Verify */}
        <FieldWrapper label="Email ID" error={errors.email}>
          <div className={cn(
            "flex items-center gap-2 bg-slate-50 border rounded-2xl px-4 py-3.5 transition-all",
            emailVerified ? "border-green-400 bg-green-50/30 ring-2 ring-green-100" :
            errors.email ? "border-red-300" :
            "border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          )}>
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="email"
              placeholder="john@example.com"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
              disabled={emailVerified}
            />
            {emailVerified ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <button
                onClick={handleSendOtp}
                disabled={!form.email || otpLoading || otpSent}
                className="text-xs font-bold text-primary px-2.5 py-1 bg-primary/10 rounded-xl flex-shrink-0 disabled:opacity-50 hover:bg-primary/20 transition-colors active:scale-95"
              >
                {otpLoading && !otpSent ? (
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : otpSent ? "Sent ✓" : "Verify"}
              </button>
            )}
          </div>
          {emailVerified && (
            <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Email verified successfully
            </p>
          )}
          {/* Show send errors here — visible even before OTP card appears */}
          {otpError && !otpSent && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <AlertCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
              <p className="text-[11px] font-semibold text-rose-500">{otpError}</p>
            </div>
          )}
        </FieldWrapper>

        {/* OTP Input — shown after OTP is sent, before it's verified */}
        {otpSent && !emailVerified && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 text-center">
              A verification code has been sent to{" "}
              <span className="text-primary">{form.email}</span>. Check your inbox and enter the 8-digit code below.
            </p>

            <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />

            {otpError && (
              <div className="flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <p className="text-[11px] font-semibold text-rose-500">{otpError}</p>
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 8 || otpLoading}
              className="w-full bg-primary text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {otpLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : "Verify Code"}
            </button>

            <div className="flex items-center justify-center gap-1.5">
              {resendSeconds > 0 ? (
                <p className="text-[11px] text-slate-400">
                  Resend code in <span className="font-bold text-primary">{resendSeconds}s</span>
                </p>
              ) : (
                <button
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="text-[11px] text-primary font-semibold flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" /> Resend code
                </button>
              )}
            </div>
          </div>
        )}

        {/* Password */}
        <FieldWrapper label="Password" error={errors.password}>
          <InputRow>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Min 6 characters"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <button onClick={() => setShowPwd(!showPwd)} className="text-slate-400">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </InputRow>
        </FieldWrapper>

        {/* Confirm Password */}
        <FieldWrapper label="Confirm Password" error={errors.confirmPassword}>
          <InputRow>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type={showConfirmPwd ? "text" : "password"}
              placeholder="Re-enter password"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
            />
            <button onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="text-slate-400">
              {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </InputRow>
        </FieldWrapper>

        {/* Mobile */}
        <FieldWrapper label="Mobile Number" error={errors.mobile}>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 flex-shrink-0">
              <span className="text-sm">🇮🇳</span>
              <span className="text-xs font-bold text-slate-700">+91</span>
            </div>
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="tel"
              placeholder="10-digit mobile number"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              value={form.mobile}
              onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
            />
          </div>
        </FieldWrapper>

        {/* Age Group */}
        <FieldWrapper label="Age Group" error={errors.ageGroup}>
          <div className={cn("flex items-center gap-3 bg-slate-50 border rounded-2xl px-4 py-3.5 transition-all", errors.ageGroup ? "border-red-300" : "border-slate-200")}>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <select
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none font-medium appearance-none cursor-pointer"
              value={form.ageGroup}
              onChange={(e) => set("ageGroup", e.target.value)}
            >
              <option value="" disabled>Select age group</option>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 pointer-events-none" />
          </div>
        </FieldWrapper>

        {/* Gender */}
        <FieldWrapper label="Gender" error={errors.gender}>
          <div className={cn("flex items-center gap-3 bg-slate-50 border rounded-2xl px-4 py-3.5 transition-all", errors.gender ? "border-red-300" : "border-slate-200")}>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="8" r="4" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12v4m0 0H9m3 0h3" />
            </svg>
            <select
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none font-medium appearance-none cursor-pointer"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="" disabled>Select gender</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 pointer-events-none" />
          </div>
        </FieldWrapper>

        {/* API error */}
        {authError && (
          <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-semibold text-rose-600">{authError}</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSignUp}
          disabled={loading || (otpSent && !emailVerified)}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98] mt-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>Create Account <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 pb-2">
          Already have an account?{" "}
          <button onClick={() => { setAuthError(null); setStep("login"); }} className="text-primary font-semibold">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
