import { useState } from "react";
import { ChevronLeft, Phone, MapPin, AlertCircle, User, Shield, Check, X } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const REASONS = [
  { id: "parking", label: "Wrong Parking", icon: MapPin, color: "bg-amber-100 text-amber-600" },
  { id: "pet", label: "Found Pet", icon: User, color: "bg-rose-100 text-rose-600" },
  { id: "emergency", label: "Emergency", icon: AlertCircle, color: "bg-red-100 text-red-600" },
  { id: "general", label: "General", icon: Phone, color: "bg-blue-100 text-blue-600" },
];

type Step = "profile" | "reason" | "code" | "submitted" | "accepted" | "rejected";

export function PublicProfileScreen() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("profile");
  const [reason, setReason] = useState<string | null>(null);
  const [code, setCode] = useState(["", "", "", ""]);
  const codeRefs = [
    { current: null as HTMLInputElement | null },
    { current: null as HTMLInputElement | null },
    { current: null as HTMLInputElement | null },
    { current: null as HTMLInputElement | null },
  ];

  const handleCodeChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 3) {
      const next_input = document.querySelectorAll(".code-input")[i + 1] as HTMLInputElement;
      next_input?.focus();
    }
  };

  const handleSubmit = () => {
    setStep("submitted");
    setTimeout(() => {
      setStep(Math.random() > 0.3 ? "accepted" : "rejected");
    }, 2500);
  };

  if (step === "submitted") {
    return (
      <div className="min-h-full bg-white flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Request Sent</h2>
        <p className="text-sm text-slate-500 text-center">Waiting for owner's response...</p>
      </div>
    );
  }

  if (step === "accepted") {
    return (
      <div className="min-h-full bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Request Accepted!</h2>
        <p className="text-sm text-slate-500 text-center mb-6">The owner has accepted your request. You may now contact them.</p>
        <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-800 text-center">+91 98765 43210</p>
          <p className="text-xs text-green-600 text-center mt-0.5">Owner's contact number</p>
        </div>
        <button
          onClick={() => navigate("/app")}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl"
        >
          Done
        </button>
      </div>
    );
  }

  if (step === "rejected") {
    return (
      <div className="min-h-full bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-5">
          <X className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Request Rejected</h2>
        <p className="text-sm text-slate-500 text-center mb-6">The owner has declined your request.</p>
        <button onClick={() => navigate("/app")} className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-4 rounded-2xl">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
        <button onClick={() => step === "profile" ? navigate("/app/scan") : setStep("profile")} className="p-1.5 rounded-xl hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-base font-bold text-slate-900">
          {step === "profile" ? "Scanned Profile" : step === "reason" ? "Select Reason" : "Enter Tag Code"}
        </h1>
      </div>

      {/* Profile view */}
      {step === "profile" && (
        <div className="px-4 pt-6 pb-4 flex-1 flex flex-col">
          <div className="bg-gradient-to-br from-blue-500 to-violet-600 rounded-3xl p-6 mb-5 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Bruno (Labrador)</h2>
            <p className="text-blue-200 text-sm mt-1">Pet ID Tag</p>
            <div className="flex items-center gap-1.5 mt-3 bg-white/20 rounded-full px-3 py-1.5">
              <Shield className="w-3.5 h-3.5 text-white" />
              <span className="text-white/90 text-xs font-medium">Protected by Stegofy</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">Contact Protected</span>
            </div>
            <p className="text-xs text-slate-500">Owner's contact is masked for privacy. Submit a request to connect securely.</p>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => setStep("reason")}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
            >
              Request to Connect
            </button>
          </div>
        </div>
      )}

      {/* Reason selection */}
      {step === "reason" && (
        <div className="px-4 pt-6 pb-4 flex-1 flex flex-col">
          <p className="text-sm text-slate-500 mb-5">Why do you need to contact the owner?</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-95",
                  reason === r.id ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50"
                )}
              >
                <div className={cn("p-3 rounded-2xl", reason === r.id ? "bg-primary text-white" : r.color)}>
                  <r.icon className="w-5 h-5" />
                </div>
                <span className={cn("text-sm font-semibold", reason === r.id ? "text-primary" : "text-slate-600")}>{r.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto">
            <button
              onClick={() => setStep("code")}
              disabled={!reason}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Code entry */}
      {step === "code" && (
        <div className="px-4 pt-6 pb-4 flex-1 flex flex-col">
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Enter Tag Code</h2>
            <p className="text-sm text-slate-500">Enter the 4-digit code printed on the physical tag to continue</p>
          </div>
          <div className="flex gap-3 justify-center mb-8">
            {code.map((digit, i) => (
              <input
                key={i}
                type="tel"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                className="code-input w-14 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all border-slate-200 bg-slate-50 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </div>
          <div className="mt-auto">
            <button
              onClick={handleSubmit}
              disabled={code.some((d) => !d)}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              Submit Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
