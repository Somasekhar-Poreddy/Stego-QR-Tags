import { useState, useEffect } from "react";
import { Plus, Bell, Shield, ShoppingBag, Wrench, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QRProfile } from "@/app/context/QRContext";
import type { User } from "@/app/context/AuthContext";

export interface ActivityItem {
  msg: string;
  time: string;
}

interface Settings {
  strictMode?: boolean;
  hasPhysicalTag?: boolean;
}

interface SmartBannerProps {
  user: User | null;
  profiles: QRProfile[];
  activity: ActivityItem[];
  settings?: Settings;
  onNavigate: (path: string) => void;
}

type BannerKind = "activity" | "incomplete" | "new-user" | "safety" | "shop";

interface BannerConfig {
  kind: BannerKind;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  dismissKey: string;
}

function pickBanner(
  profiles: QRProfile[],
  activity: ActivityItem[],
  settings: Settings,
  dismissed: Set<string>
): BannerConfig | null {
  const hasActivity = activity.length > 0;
  const hasProfiles = profiles.length > 0;
  const hasIncomplete = profiles.some(
    (p) => p.status === "inactive" || !p.primaryContact
  );
  const hasPhysicalTag = settings.hasPhysicalTag ?? false;

  const candidates: BannerConfig[] = [
    {
      kind: "activity",
      title: "Someone tried to reach you",
      subtitle: "Check recent activity now",
      cta: "View Activity",
      href: "/app/activity",
      Icon: Bell,
      gradient: "from-rose-500 to-pink-500",
      dismissKey: "banner_activity",
    },
    {
      kind: "incomplete",
      title: "Complete Your Setup",
      subtitle: "Add contact details to make your QR functional",
      cta: "Complete Now",
      href: "/app/qr",
      Icon: Wrench,
      gradient: "from-amber-500 to-orange-500",
      dismissKey: "banner_incomplete",
    },
    {
      kind: "new-user",
      title: "Get Started in 2 Minutes",
      subtitle: "Create your first QR and protect what matters",
      cta: "Create QR",
      href: "/app/qr/create",
      Icon: Plus,
      gradient: "from-blue-600 to-violet-600",
      dismissKey: "banner_new_user",
    },
    {
      kind: "safety",
      title: "Stay Protected Always",
      subtitle: "Enable strict mode to avoid unwanted contact",
      cta: "Enable Now",
      href: "/app/settings",
      Icon: Shield,
      gradient: "from-blue-600 to-violet-600",
      dismissKey: "banner_safety",
    },
    {
      kind: "shop",
      title: "Get Your QR Tag",
      subtitle: "Attach it to your car, pet or belongings",
      cta: "Shop Now",
      href: "/app/shop",
      Icon: ShoppingBag,
      gradient: "from-teal-500 to-cyan-500",
      dismissKey: "banner_shop",
    },
  ];

  // Priority filter — same order as spec
  const eligible = candidates.filter((c) => {
    if (dismissed.has(c.dismissKey)) return false;
    if (c.kind === "activity") return hasActivity;
    if (c.kind === "incomplete") return hasProfiles && hasIncomplete;
    if (c.kind === "new-user") return !hasProfiles;
    if (c.kind === "safety") return hasProfiles && !settings.strictMode;
    if (c.kind === "shop") return hasProfiles && !hasPhysicalTag;
    return false;
  });

  return eligible[0] ?? null;
}

export function SmartBanner({ user: _user, profiles, activity, settings = {}, onNavigate }: SmartBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("stegofy_dismissed_banners");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const banner = pickBanner(profiles, activity, settings, dismissed);

  useEffect(() => {
    setVisible(true);
    setLeaving(false);
  }, [banner?.kind]);

  const dismiss = () => {
    if (!banner) return;
    setLeaving(true);
    setTimeout(() => {
      const next = new Set(dismissed).add(banner.dismissKey);
      setDismissed(next);
      try {
        localStorage.setItem("stegofy_dismissed_banners", JSON.stringify([...next]));
      } catch {}
      setVisible(true);
      setLeaving(false);
    }, 280);
  };

  if (!banner) return null;

  const { title, subtitle, cta, href, Icon, gradient } = banner;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300",
        `bg-gradient-to-r ${gradient}`,
        leaving
          ? "opacity-0 scale-95 translate-y-1"
          : visible
          ? "opacity-100 scale-100 translate-y-0"
          : "opacity-0"
      )}
      style={{ willChange: "opacity, transform" }}
    >
      {/* Soft radial highlight */}
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute -bottom-8 -left-4 w-24 h-24 bg-black/5 rounded-full" />

      <div className="relative px-5 py-4 flex items-center gap-4">
        {/* Icon bubble */}
        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{title}</p>
          <p className="text-white/80 text-[11px] mt-0.5 leading-snug">{subtitle}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-white/80" />
        </button>
      </div>

      {/* CTA strip */}
      <button
        onClick={() => onNavigate(href)}
        className="w-full flex items-center justify-between px-5 py-3 bg-black/10 hover:bg-black/15 transition-colors active:bg-black/20"
      >
        <span className="text-white text-xs font-bold tracking-wide">{cta}</span>
        <ArrowRight className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}
