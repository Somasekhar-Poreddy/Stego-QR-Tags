import { useState, useRef, useEffect } from "react";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

export function OTPScreen() {
  const { setStep, setUser } = useAuth();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { refs[0].current?.focus(); }, []);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    setError(false);
    if (val && i < 3) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length < 4) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (code === "1234") {
        setUser({ phone: "+91 98*** ***12", name: "User", isFirstTime: true });
        setStep("onboarding");
      } else {
        setError(true);
      }
    }, 1200);
  };

  const filled = otp.every((d) => d !== "");

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
      <button onClick={() => setStep("login")} className="self-start p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors mb-8">
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      <div className="mb-8">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
          <CheckCircle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Verify OTP</h1>
        <p className="text-sm text-slate-500">Enter the 4-digit code sent to your mobile. <br />Use <span className="font-semibold text-slate-700">1234</span> to continue.</p>
      </div>

      <div className="flex gap-3 mb-6">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="tel"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`flex-1 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all ${
              error ? "border-red-400 bg-red-50 text-red-600" :
              digit ? "border-primary bg-primary/5 text-primary" :
              "border-slate-200 bg-slate-50 text-slate-900"
            } focus:border-primary focus:ring-2 focus:ring-primary/20`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-500 mb-4 font-medium">Incorrect OTP. Try 1234.</p>}

      <button
        onClick={handleVerify}
        disabled={!filled || loading}
        className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {loading ? (
          <div className="mx-auto w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : "Verify & Continue"}
      </button>

      <button className="mt-5 text-sm text-slate-500 text-center w-full">
        Didn't receive code? <span className="text-primary font-semibold">Resend</span>
      </button>
    </div>
  );
}
