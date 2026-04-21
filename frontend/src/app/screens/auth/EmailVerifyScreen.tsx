import { Mail, ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

export function EmailVerifyScreen() {
  const { user, setStep } = useAuth();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Icon */}
      <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
        <Mail className="w-12 h-12 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h1>
      <p className="text-sm text-slate-500 leading-relaxed mb-2">
        We've sent a verification link to
      </p>
      <p className="text-sm font-bold text-slate-800 mb-7 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
        {user?.email || "your email"}
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-8 text-left w-full max-w-xs">
        <p className="text-xs font-semibold text-blue-800 mb-1">Next steps:</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Open your email inbox</li>
          <li>Click the verification link</li>
          <li>Return here and sign in</li>
        </ol>
      </div>

      <button
        onClick={() => setStep("login")}
        className="w-full max-w-xs bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 mb-3 active:scale-[0.98] transition-all"
      >
        Go to Sign In <ArrowRight className="w-4 h-4" />
      </button>

      <button className="flex items-center gap-2 text-sm text-slate-500 font-medium py-2">
        <RefreshCw className="w-4 h-4" /> Resend verification email
      </button>
    </div>
  );
}
