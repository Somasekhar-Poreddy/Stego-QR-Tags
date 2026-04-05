import { Plus, ScanLine, QrCode, Bell, ChevronRight, Shield, CheckCircle2, AlertTriangle, AlertCircle, Zap, Tag, HelpCircle, ToggleRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useQR } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { SmartBanner } from "@/app/components/SmartBanner";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  pet: "bg-rose-100 text-rose-600",
  vehicle: "bg-blue-100 text-blue-600",
  child: "bg-green-100 text-green-600",
  medical: "bg-red-100 text-red-600",
  luggage: "bg-indigo-100 text-indigo-600",
  wallet: "bg-amber-100 text-amber-600",
  home: "bg-teal-100 text-teal-600",
  event: "bg-fuchsia-100 text-fuchsia-600",
  business: "bg-slate-100 text-slate-600",
};

const ACTIVITY = [
  { msg: "Someone tried to contact you", time: "2 min ago" },
  { msg: "QR scanned 2 times today", time: "1 hr ago" },
];

const BANNER_ACTIVITY = ACTIVITY;

// ── Protection status derived from profiles ───────────────────────────────────
type ProtectionState = "protected" | "attention" | "action";

function getProtectionState(profiles: ReturnType<typeof useQR>["profiles"]): {
  state: ProtectionState;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
} {
  if (profiles.length === 0) {
    return {
      state: "action",
      title: "Action Required",
      subtitle: "You haven't set up any QR yet",
      cta: "Fix Now",
      href: "/app/qr/create",
    };
  }
  const incomplete = profiles.filter((p) => p.status === "inactive" || !p.primaryContact);
  if (incomplete.length > 0) {
    return {
      state: "attention",
      title: "Needs Attention",
      subtitle: `${incomplete.length} QR ${incomplete.length === 1 ? "needs" : "need"} setup`,
      cta: "Fix Now",
      href: "/app/qr",
    };
  }
  return {
    state: "protected",
    title: "All Protected",
    subtitle: "Your items are सुरक्षित and active",
    cta: "View",
    href: "/app/qr",
  };
}

export function HomeScreen() {
  const { user } = useAuth();
  const { profiles } = useQR();
  const [, navigate] = useLocation();

  const protection = getProtectionState(profiles);

  const stateStyles: Record<ProtectionState, { bg: string; border: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; badge: string; badgeText: string; ctaColor: string }> = {
    protected: {
      bg: "bg-green-50",
      border: "border-green-100",
      icon: CheckCircle2,
      iconColor: "text-green-500",
      badge: "bg-green-100 text-green-700",
      badgeText: "Protected",
      ctaColor: "bg-green-600 hover:bg-green-700",
    },
    attention: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      badge: "bg-amber-100 text-amber-700",
      badgeText: "Attention",
      ctaColor: "bg-amber-500 hover:bg-amber-600",
    },
    action: {
      bg: "bg-rose-50",
      border: "border-rose-100",
      icon: AlertCircle,
      iconColor: "text-rose-500",
      badge: "bg-rose-100 text-rose-700",
      badgeText: "Action Required",
      ctaColor: "bg-rose-500 hover:bg-rose-600",
    },
  };
  const s = stateStyles[protection.state];
  const ProtectionIcon = s.icon;

  return (
    <div className="bg-slate-50 min-h-full">
      <AppHeader />

      <div className="px-4 pt-4 pb-6 space-y-4">

        {/* 1 ── Smart Banner ──────────────────────────────────────────────── */}
        <SmartBanner
          user={user}
          profiles={profiles}
          activity={BANNER_ACTIVITY}
          settings={{ strictMode: false, hasPhysicalTag: false }}
          onNavigate={navigate}
        />

        {/* 2 ── Protection Status ─────────────────────────────────────────── */}
        <div className={cn("rounded-2xl border px-4 py-4 flex items-center gap-3 shadow-sm", s.bg, s.border)}>
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <ProtectionIcon className={cn("w-5 h-5", s.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold text-slate-900">{protection.title}</p>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.badge)}>
                {s.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{protection.subtitle}</p>
          </div>
          <button
            onClick={() => navigate(protection.href)}
            className={cn("text-xs text-white font-bold px-3.5 py-2 rounded-xl flex-shrink-0 transition-colors", s.ctaColor)}
          >
            {protection.cta}
          </button>
        </div>

        {/* 3 ── Primary Actions ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/app/qr/create")}
            className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg shadow-primary/25 transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Create QR</span>
          </button>

          <button
            onClick={() => navigate("/app/scan")}
            className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-white border border-slate-100 text-slate-700 shadow-sm transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-xs font-bold">Scan QR</span>
          </button>

          <button
            onClick={() => navigate("/app/qr")}
            className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-white border border-slate-100 text-slate-700 shadow-sm transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-xs font-bold">My QR</span>
          </button>
        </div>

        {/* 4 ── Secondary Action Strip ────────────────────────────────────── */}
        <div className="flex gap-2.5 overflow-x-auto pb-0.5 -mx-4 px-4 scrollbar-none">
          {[
            { label: "Activate QR", icon: Zap, href: "/app/qr", color: "text-violet-600 bg-violet-50 border-violet-100" },
            { label: "Create Free Tag", icon: Tag, href: "/app/qr/create", color: "text-blue-600 bg-blue-50 border-blue-100" },
            { label: "How it Works", icon: HelpCircle, href: "/app/scan", color: "text-slate-600 bg-slate-100 border-slate-200" },
            { label: "Safety Tips", icon: Shield, href: "/app/profile", color: "text-green-600 bg-green-50 border-green-100" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex items-center gap-2 flex-shrink-0 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-95",
                item.color
              )}
            >
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </div>

        {/* 5 ── QR Profiles ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Your QR Profiles</h2>
            <button onClick={() => navigate("/app/qr")} className="text-xs text-primary font-semibold flex items-center gap-0.5">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {profiles.slice(0, 3).map((p) => (
              <div key={p.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", TYPE_COLORS[p.type] || "bg-slate-100 text-slate-600")}>
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{p.type} · {p.scans} scans</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", p.status === "active" ? "bg-green-400" : "bg-slate-300")} />
                  <span className="text-xs text-slate-400">{p.status}</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate("/app/qr/create")}
              className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-3 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New QR
            </button>
          </div>
        </section>

        {/* Safety Settings */}
        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-3">Safety Settings</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Privacy Status</p>
                  <p className="text-[10px] text-slate-400">Number is masked for all</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Protected</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ToggleRight className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Strict Mode</p>
                  <p className="text-[10px] text-slate-400">Require code to contact</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow" />
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
