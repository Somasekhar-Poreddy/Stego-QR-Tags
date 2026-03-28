import { useState, useRef } from "react";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";

export function OTPScreen() {
  const { setStep, setUser } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setOtp(val);
    setError(false);
  };

  const handleVerify = () => {
    if (otp.length < 4) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (otp === "1234") {
        setUser({ phone: "+91 98*** ***12", name: "User", isFirstTime: true });
        setStep("onboarding");
      } else {
        setError(true);
        setOtp("");
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12">
      <button
        onClick={() => setStep("login")}
        className="self-start p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors mb-8"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      <div className="mb-10">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
          <CheckCircle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Verify OTP</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Enter the 4-digit code sent to your mobile.{" "}
          <br />
          Use <span className="font-semibold text-slate-700">1234</span> to continue.
        </p>
      </div>

      {/* Dot display + hidden input */}
      <div className="mb-6">
        <button
          className="w-full focus:outline-none"
          onClick={() => inputRef.current?.focus()}
          type="button"
        >
          <div
            className={cn(
              "flex items-center justify-center gap-5 bg-slate-50 border-2 rounded-2xl px-6 py-5 transition-all",
              error
                ? "border-red-400 bg-red-50"
                : otp.length > 0
                ? "border-primary bg-primary/5"
                : "border-slate-200"
            )}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-4 h-4 rounded-full transition-all duration-200",
                  i < otp.length
                    ? error
                      ? "bg-red-500 scale-110"
                      : "bg-primary scale-110"
                    : "bg-slate-300"
                )}
              />
            ))}
          </div>
        </button>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={otp}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && otp.length === 4 && handleVerify()}
          className="opacity-0 absolute w-0 h-0"
          autoFocus
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-5 font-medium text-center">
          Incorrect OTP. Try <strong>1234</strong>.
        </p>
      )}

      <button
        onClick={handleVerify}
        disabled={otp.length < 4 || loading}
        className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {loading ? (
          <div className="mx-auto w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          "Verify & Continue"
        )}
      </button>

      <button className="mt-5 text-sm text-slate-500 text-center w-full">
        Didn't receive code?{" "}
        <span className="text-primary font-semibold">Resend</span>
      </button>
    </div>
  );
}
