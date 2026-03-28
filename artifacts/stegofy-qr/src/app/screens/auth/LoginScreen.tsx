import { useState } from "react";
import { QrCode, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

export function LoginScreen() {
  const { setStep, signInWithEmail, authError, setAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    setAuthError(null);
    await signInWithEmail(email, password);
    setLoading(false);
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

      {/* Login card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-7 pb-10 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
        <p className="text-sm text-slate-500 mb-6">Sign in with your email to continue</p>

        <div className="space-y-3">
          {/* Email */}
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

          {/* Password */}
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

          {/* Error */}
          {authError && (
            <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              {authError}
            </p>
          )}

          {/* Sign In */}
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

          <button className="w-full text-xs text-primary text-center font-semibold py-1">
            Forgot password?
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 font-medium">Don't have an account?</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Sign Up CTA */}
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
      </div>
    </div>
  );
}
