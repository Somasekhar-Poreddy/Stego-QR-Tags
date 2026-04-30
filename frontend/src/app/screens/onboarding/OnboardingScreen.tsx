import { useState } from "react";
import { Car, Heart, Shield, Cross, Briefcase, MoreHorizontal, ArrowRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { BrandIcon } from "@/components/Brand";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "pet", label: "Pet", icon: Heart, color: "bg-rose-100 text-rose-500", border: "border-rose-200" },
  { id: "vehicle", label: "Vehicle", icon: Car, color: "bg-blue-100 text-blue-500", border: "border-blue-200" },
  { id: "child", label: "Child", icon: Shield, color: "bg-green-100 text-green-500", border: "border-green-200" },
  { id: "medical", label: "Medical", icon: Cross, color: "bg-red-100 text-red-500", border: "border-red-200" },
  { id: "belongings", label: "Belongings", icon: Briefcase, color: "bg-amber-100 text-amber-500", border: "border-amber-200" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "bg-slate-100 text-slate-500", border: "border-slate-200" },
];

export function OnboardingScreen() {
  const { setStep, user, setUser } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    if (user) setUser({ ...user, isFirstTime: false });
    setStep("app");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8">
      {/* Header */}
      <div className="mb-10">
        <BrandIcon size={56} className="mb-4" />
        <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-primary text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 bg-primary rounded-full" />
          Welcome to StegoTags
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          What would you like to protect today?
        </h1>
        <p className="text-sm text-slate-500">We'll help you set up the right QR profile for your needs.</p>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={cn(
              "flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-[0.97]",
              selected === opt.id
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : `border-slate-100 bg-slate-50 hover:${opt.border} hover:bg-white`
            )}
          >
            <div className={cn("p-3 rounded-2xl", selected === opt.id ? "bg-primary text-white" : opt.color)}>
              <opt.icon className="w-6 h-6" />
            </div>
            <span className={cn("text-sm font-semibold", selected === opt.id ? "text-primary" : "text-slate-700")}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={() => setStep("app")} className="w-full text-sm text-slate-400 mt-3 py-2">
          Skip for now
        </button>
      </div>
    </div>
  );
}
