import { useState, useEffect, useCallback } from "react";
import {
  Globe, Smartphone, Monitor, MapPin, Eye, EyeOff,
  RefreshCw, Users, UserX, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  adminGetAllScans, adminGetAllScansCount, adminDecryptIP,
  type ScanFilter, type ScanWithQRName,
} from "@/services/adminService";
import { ensureFreshSession } from "@/lib/adminAuth";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_USER_IDS ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
const PAGE_SIZE = 30;

const COUNTRY_ISO: Record<string, string> = {
  "india": "IN", "united states": "US", "united kingdom": "GB",
  "canada": "CA", "australia": "AU", "germany": "DE", "france": "FR",
  "japan": "JP", "china": "CN", "brazil": "BR", "russia": "RU",
  "south korea": "KR", "mexico": "MX", "italy": "IT", "spain": "ES",
  "netherlands": "NL", "switzerland": "CH", "sweden": "SE", "norway": "NO",
  "denmark": "DK", "finland": "FI", "poland": "PL", "austria": "AT",
  "belgium": "BE", "portugal": "PT", "greece": "GR", "turkey": "TR",
  "ukraine": "UA", "singapore": "SG", "malaysia": "MY", "indonesia": "ID",
  "thailand": "TH", "vietnam": "VN", "philippines": "PH", "pakistan": "PK",
  "bangladesh": "BD", "sri lanka": "LK", "nepal": "NP", "new zealand": "NZ",
  "south africa": "ZA", "nigeria": "NG", "kenya": "KE", "egypt": "EG",
  "saudi arabia": "SA", "united arab emirates": "AE", "israel": "IL",
  "iran": "IR", "iraq": "IQ", "argentina": "AR", "colombia": "CO",
  "chile": "CL", "peru": "PE", "venezuela": "VE", "czech republic": "CZ",
  "romania": "RO", "hungary": "HU", "slovakia": "SK", "croatia": "HR",
  "serbia": "RS", "bulgaria": "BG", "ireland": "IE", "hong kong": "HK",
  "taiwan": "TW", "myanmar": "MM", "cambodia": "KH", "qatar": "QA",
  "kuwait": "KW", "bahrain": "BH", "oman": "OM", "jordan": "JO",
  "lebanon": "LB", "morocco": "MA", "algeria": "DZ", "tunisia": "TN",
  "ghana": "GH", "ethiopia": "ET", "tanzania": "TZ", "uganda": "UG",
};

function countryFlag(country: string | null): string {
  if (!country) return "";
  const iso = COUNTRY_ISO[country.toLowerCase()];
  if (!iso) return "🌐";
  return iso.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function formatRelativeTime(iso?: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getIntentLabel(intent: string | null) {
  if (!intent) return null;
  const map: Record<string, string> = {
    emergency: "Emergency", lights_on: "Lights are on", keys_inside: "Keys locked inside",
    blocking: "Blocking the way", accident: "Accident / Needs help", lost_pet: "Lost pet",
    lost_child: "Lost child", medical: "Medical emergency", others: "Other / Custom",
    contact: "Contact request",
  };
  return map[intent] ?? intent.replace(/_/g, " ");
}

function getIntentColor(intent: string | null) {
  if (intent === "emergency" || intent === "accident" || intent === "medical") return "bg-red-100 text-red-700";
  if (intent === "lost_pet" || intent === "lost_child") return "bg-orange-100 text-orange-700";
  return "bg-blue-100 text-blue-700";
}

const FILTERS: { key: ScanFilter; label: string; icon: React.ElementType }[] = [
  { key: "all",        label: "All Visitors",  icon: Activity },
  { key: "registered", label: "Registered",    icon: Users    },
  { key: "strangers",  label: "Strangers",     icon: UserX    },
];

export function VisitorLogScreen() {
  const { user } = useAuth();
  const isSuperAdmin = user?.id ? ADMIN_IDS.includes(user.id) : false;

  const [filter, setFilter] = useState<ScanFilter>("all");
  const [scans, setScans] = useState<ScanWithQRName[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revealedIps, setRevealedIps] = useState<Record<string, string>>({});
  const [loadingIp, setLoadingIp] = useState<Record<string, boolean>>({});

  const revealIp = (id: string, ip: string) => {
    setRevealedIps((prev) => ({ ...prev, [id]: ip }));
    setTimeout(() => {
      setRevealedIps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 10000);
  };

  const load = useCallback(async (f: ScanFilter, p: number) => {
    setLoading(true);
    setError(null);
    try {
      await ensureFreshSession();
      const [rows, cnt] = await Promise.all([
        adminGetAllScans(f, PAGE_SIZE, p * PAGE_SIZE),
        adminGetAllScansCount(f),
      ]);
      setScans(rows);
      setTotal(cnt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(filter, page); }, [load, filter, page]);

  const handleFilterChange = (f: ScanFilter) => {
    setFilter(f);
    setPage(0);
    setRevealedIps({});
  };

  const handleViewIp = async (scan: ScanWithQRName) => {
    if (!scan.encrypted_ip) return;
    setLoadingIp((prev) => ({ ...prev, [scan.id]: true }));
    const result = await adminDecryptIP(scan.encrypted_ip, scan.qr_id, scan.id);
    setLoadingIp((prev) => ({ ...prev, [scan.id]: false }));
    if ("ip" in result) {
      revealIp(scan.id, result.ip);
    } else {
      revealIp(scan.id, `Error: ${result.error}`);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Visitor Log</h2>
        <p className="text-sm text-slate-500 mt-0.5">All QR code scans — registered users and anonymous strangers</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              filter === key
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        <span className="ml-auto flex items-center text-xs text-slate-400 font-medium">
          {total.toLocaleString()} total
        </span>
      </div>

      {/* Content */}
      {loading && scans.length === 0 ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading visitor log…</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700">Failed to load visitor log</p>
          <p className="text-xs font-mono text-red-600 bg-red-100 rounded-xl p-3 text-left">{error}</p>
          <button onClick={() => load(filter, page)} className="text-sm text-primary hover:underline font-semibold">
            Retry
          </button>
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center space-y-3">
          <Globe className="w-12 h-12 text-slate-200 mx-auto" />
          <p className="text-sm font-semibold text-slate-500">No scans recorded yet</p>
          <p className="text-xs text-slate-400">Visitor data will appear here once QR codes are scanned</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center py-3 gap-1.5 text-slate-400 bg-primary/5 border-b border-slate-100">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs font-medium">Refreshing…</span>
              </div>
            )}
            <div className="divide-y divide-slate-50">
              {scans.map((scan) => {
                const ts = new Date(scan.created_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                });
                const location = [scan.city, scan.state, scan.country].filter(Boolean).join(", ");
                const flag = countryFlag(scan.country);
                const revealedIp = revealedIps[scan.id];
                const isLoadingThisIp = loadingIp[scan.id];
                const isStranger = !scan.user_id;
                const intentLabel = getIntentLabel(scan.intent);

                return (
                  <div key={scan.id} className="px-4 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Device icon */}
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        isStranger ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600",
                      )}>
                        {scan.device === "mobile"
                          ? <Smartphone className="w-4 h-4" />
                          : <Monitor className="w-4 h-4" />}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: time + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-700" title={ts}>
                            {formatRelativeTime(scan.created_at)}
                          </p>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            isStranger
                              ? "bg-amber-100 text-amber-700"
                              : "bg-indigo-100 text-indigo-700",
                          )}>
                            {isStranger ? "Stranger" : "Registered"}
                          </span>
                          {scan.qr_name && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                              {scan.qr_name}
                            </span>
                          )}
                          {scan.is_request_made && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              Request made
                            </span>
                          )}
                          {intentLabel && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getIntentColor(scan.intent)}`}>
                              {intentLabel}
                            </span>
                          )}
                        </div>

                        {/* Row 2: browser/OS + location */}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {(scan.browser || scan.os) && (
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {[scan.browser, scan.os].filter(Boolean).join(" · ")}
                            </span>
                          )}
                          {location && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500">
                              {flag ? (
                                <span className="text-sm leading-none">{flag}</span>
                              ) : (
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              {location}
                            </span>
                          )}
                        </div>

                        {/* Row 3: IP */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {scan.masked_ip && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {revealedIp ? (
                                <span className="text-primary font-semibold">{revealedIp}</span>
                              ) : (
                                scan.masked_ip
                              )}
                            </span>
                          )}
                          {isSuperAdmin && scan.encrypted_ip && (
                            <button
                              onClick={() => handleViewIp(scan)}
                              disabled={isLoadingThisIp || !!revealedIp}
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                              title="View full IP (visible for 10 seconds)"
                            >
                              {isLoadingThisIp ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : revealedIp ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                              {revealedIp ? "Hiding…" : "View Full IP 🔐"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Timestamp (right side) */}
                      <p className="text-[10px] text-slate-400 shrink-0 hidden sm:block" title={ts}>
                        {new Date(scan.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        <br />
                        {new Date(scan.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <p className="text-xs text-slate-500 font-medium">
                Page {page + 1} of {totalPages}
              </p>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
