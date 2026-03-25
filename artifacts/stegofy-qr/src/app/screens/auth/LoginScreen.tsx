import { useState } from "react";
import { QrCode, Phone, ArrowRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

export function LoginScreen() {
  const { setStep } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (phone.length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 flex flex-col">
      {/* Top branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-3xl mb-5">
          <QrCode className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Stegofy</h1>
        <p className="text-blue-100 text-sm text-center">Smart QR tags for everything that matters</p>
      </div>

      {/* Login card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-12 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
        <p className="text-sm text-slate-500 mb-7">Enter your mobile number to continue</p>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 mb-5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
            <span className="text-base">🇮🇳</span>
            <span className="text-sm font-semibold text-slate-700">+91</span>
          </div>
          <Phone className="w-4 h-4 text-slate-400" />
          <input
            type="tel"
            placeholder="Mobile number"
            className="flex-1 bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-400"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={phone.length < 10 || loading}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>Send OTP <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-5">
          By continuing, you agree to our{" "}
          <a href="#terms" className="text-primary font-medium">Terms</a> &{" "}
          <a href="#privacy" className="text-primary font-medium">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
