import { useCallback, useEffect, useState } from "react";
import { Plus, ScanLine, QrCode, Bell, Eye, ChevronRight, Shield, CheckCircle2, AlertTriangle, AlertCircle, Zap, Tag, HelpCircle, ToggleRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useQR } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { SmartBanner, type ActivityItem } from "@/app/components/SmartBanner";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { safeFetch } from "@/lib/safeFetch";

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
  belongings: "bg-amber-100 text-amber-600",
};

function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

interface ActivityRow {
  id: string;
  kind: "scan" | "contact";
  msg: string;
  time: string;
  icon: React.ElementType;
  color: string;
  created_at: string;
}

type ProtectionState = "protected" | "attention" | "action";

function getProtectionState(profiles: ReturnType<typeof useQR>["profiles"]): {
  state: ProtectionState; title: string; subtitle: string; cta: string; href: string;
} {
  if (profiles.length === 0) return { state: "action", title: "Action Required", subtitle: "You haven't set up any QR yet", cta: "Fix Now", href: "/app/qr/create" };
  const incomplete = profiles.filter((p) => p.status === "inactive" || !p.primaryContact);
  if (incomplete.length > 0) return { state: "attention", title: "Needs Attention", subtitle: `${incomplete.length} QR ${incomplete.length === 1 ? "needs" : "need"} setup`, cta: "Fix Now", href: "/app/qr" };
  return { state: "protected", title: "All Protected", subtitle: "Your items are Safe and active", cta: "View", href: "/app/qr" };
}

export function HomeScreen() {
  const { user } = useAuth();
  const { profiles } = useQR();
  const [, navigate] = useLocation();
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    if (!user?.id) { setActivityLoading(false); return; }
    setActivityLoading(true);
    try {
      const rows: ActivityRow[] = [];

      // safeFetch guards the session, prevents replacing existing data with an
      // empty result on transient auth failures, and logs errors to the console.
      const qrData = await safeFetch<{ id: string; name: string }>(
        async () => {
          const { data, error } = await supabase
            .from("qr_codes")
            .select("id, name")
            .eq("user_id", user.id);
          if (error) throw new Error(error.message);
          return (data ?? []) as { id: string; name: string }[];
        },
        [],
        "HomeScreen:qrCodes",
      );

      const userQrIds = (qrData ?? []).map((q) => q.id as string);
      const qrNameMap = Object.fromEntries((qrData ?? []).map((q) => [q.id as string, q.name as string]));

      if (userQrIds.length > 0) {
        const [scansRes, contactsRes] = await Promise.all([
          supabase
            .from("qr_scans")
            .select("id, qr_id, created_at, city, country")
            .in("qr_id", userQrIds)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("contact_requests")
            .select("id, qr_id, intent, created_at")
            .in("qr_id", userQrIds)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        (scansRes.data ?? []).forEach((row) => {
          const qrName = qrNameMap[row.qr_id as string] || "your QR";
          const loc = [row.city, row.country].filter(Boolean).join(", ");
          rows.push({
            id: `scan-${row.id}`,
            kind: "scan",
            msg: `${qrName} was scanned${loc ? ` · ${loc}` : ""}`,
            time: getTimeAgo(row.created_at as string),
            icon: QrCode,
            color: "bg-violet-100 text-violet-600",
            created_at: row.created_at as string,
          });
        });

        (contactsRes.data ?? []).forEach((row) => {
          const intent = (row.intent as string) || "general";
          const label = intent === "emergency" ? "Emergency contact request" : intent === "whatsapp" ? "WhatsApp contact request" : "Someone tried to contact you";
          rows.push({
            id: `contact-${row.id}`,
            kind: "contact",
            msg: label,
            time: getTimeAgo(row.created_at as string),
            icon: Bell,
            color: "bg-primary/10 text-primary",
            created_at: row.created_at as string,
          });
        });

        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      // Functional update: only replace the activity state if we fetched
      // at least one row — never overwrite existing data with an empty result.
      const fresh = rows.slice(0, 5);
      setActivity((prev) => fresh.length > 0 ? fresh : prev);
    } catch (err) {
      // Do NOT clear the activity feed on error — preserve the last known good state
      // so the screen never flashes blank. The AuthContext SIGNED_OUT handler will
      // redirect to login if the session is truly gone.
      console.error("[HomeScreen] Activity load failed:", err);
    } finally {
      setActivityLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  const protection = getProtectionState(profiles);

  const stateStyles: Record<ProtectionState, { bg: string; border: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; badge: string; badgeText: string; ctaColor: string }> = {
    protected: { bg: "bg-green-50", border: "border-green-100", icon: CheckCircle2, iconColor: "text-green-500", badge: "bg-green-100 text-green-700", badgeText: "Protected", ctaColor: "bg-green-600 hover:bg-green-700" },
    attention: { bg: "bg-amber-50", border: "border-amber-100", icon: AlertTriangle, iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700", badgeText: "Attention", ctaColor: "bg-amber-500 hover:bg-amber-600" },
    action: { bg: "bg-rose-50", border: "border-rose-100", icon: AlertCircle, iconColor: "text-rose-500", badge: "bg-rose-100 text-rose-700", badgeText: "Action Required", ctaColor: "bg-rose-500 hover:bg-rose-600" },
  };
  const s = stateStyles[protection.state];
  const ProtectionIcon = s.icon;

  const bannerActivity: ActivityItem[] = activity.map((a) => ({ msg: a.msg, time: a.time }));

  return (
    <div className="bg-slate-50 min-h-full">
      <AppHeader />

      <div className="px-4 pt-4 pb-6 space-y-4">

        {/* 1 ── Smart Banner */}
        <SmartBanner
          user={user}
          profiles={profiles}
          activity={bannerActivity}
          settings={{ strictMode: false, hasPhysicalTag: false }}
          onNavigate={navigate}
        />

        {/* 2 ── Protection Status */}
        <div className={cn("rounded-2xl border px-4 py-4 flex items-center gap-3 shadow-sm", s.bg, s.border)}>
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <ProtectionIcon className={cn("w-5 h-5", s.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold text-slate-900">{protection.title}</p>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.badge)}>{s.badgeText}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{protection.subtitle}</p>
          </div>
          <button onClick={() => navigate(protection.href)} className={cn("text-xs text-white font-bold px-3.5 py-2 rounded-xl flex-shrink-0 transition-colors", s.ctaColor)}>
            {protection.cta}
          </button>
        </div>

        {/* 3 ── Primary Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => navigate("/app/qr/create")} className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg shadow-primary/25 transition-all active:scale-95">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Plus className="w-5 h-5" /></div>
            <span className="text-xs font-bold">Create QR</span>
          </button>
          <button onClick={() => navigate("/app/scan")} className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-white border border-slate-100 text-slate-700 shadow-sm transition-all active:scale-95">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><ScanLine className="w-5 h-5 text-slate-600" /></div>
            <span className="text-xs font-bold">Scan QR</span>
          </button>
          <button onClick={() => navigate("/app/qr")} className="flex flex-col items-center gap-2.5 py-5 rounded-2xl bg-white border border-slate-100 text-slate-700 shadow-sm transition-all active:scale-95">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><QrCode className="w-5 h-5 text-slate-600" /></div>
            <span className="text-xs font-bold">My QR</span>
          </button>
        </div>

        {/* 4 ── Secondary Action Strip */}
        <div className="flex gap-2.5 overflow-x-auto pb-0.5 -mx-4 px-4 scrollbar-none">
          {[
            { label: "Activate QR", icon: Zap, href: "/app/qr", color: "text-violet-600 bg-violet-50 border-violet-100" },
            { label: "Create Free Tag", icon: Tag, href: "/app/qr/create", color: "text-blue-600 bg-blue-50 border-blue-100" },
            { label: "How it Works", icon: HelpCircle, href: "/app/scan", color: "text-slate-600 bg-slate-100 border-slate-200" },
            { label: "Safety Tips", icon: Shield, href: "/app/profile", color: "text-green-600 bg-green-50 border-green-100" },
          ].map((item) => (
            <button key={item.label} onClick={() => navigate(item.href)} className={cn("flex items-center gap-2 flex-shrink-0 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-95", item.color)}>
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </div>

        {/* 5 ── QR Profiles */}
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
            <button onClick={() => navigate("/app/qr/create")} className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-3 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
              <Plus className="w-4 h-4" /> Add New QR
            </button>
          </div>
        </section>

        {/* 6 ── Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
            {!activityLoading && (
              <button onClick={loadActivity} className="text-xs text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {activityLoading ? (
              <div className="divide-y divide-slate-50">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Eye className="w-8 h-8 text-slate-200" />
                <p className="text-sm font-semibold text-slate-400">No recent activity yet</p>
                <p className="text-[11px] text-slate-300 text-center max-w-[200px]">Activity will appear here when someone scans or contacts you</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", a.color)}>
                      <a.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{a.msg}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 7 ── Safety Settings */}
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
