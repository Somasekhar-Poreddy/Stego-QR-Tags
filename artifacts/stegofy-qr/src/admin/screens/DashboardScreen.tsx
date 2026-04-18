import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, QrCode, MessageSquare, ShoppingCart, Zap, DollarSign, RefreshCw, AlertCircle } from "lucide-react";
import {
  getDashboardStats, getScansPerDay, getRequestsByType,
} from "@/services/adminService";
import { ensureFreshSession } from "@/lib/adminAuth";
import { DateRangeBar, useDateRange, RANGE_LABELS } from "@/admin/components/DateRangeBar";
import { LowStockBanner } from "@/admin/components/LowStockBanner";

interface Stats {
  totalUsers: number;
  activeQRCodes: number;
  todayRequests: number;
  emergencyRequests: number;
  totalOrders: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />;
}

function ErrorBanner({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-600">{message}</p>
        {detail && (
          <p className="text-xs text-red-500/80 mt-1 break-words font-mono">{detail}</p>
        )}
      </div>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 flex-shrink-0"
      >
        Retry
      </button>
    </div>
  );
}

function ChartError({ detail, onRetry }: { detail?: string; onRetry: () => void }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 px-4 text-center">
      <AlertCircle className="w-6 h-6 text-slate-300" />
      <p className="text-sm text-slate-400">Could not load chart data</p>
      {detail && (
        <p className="text-[10px] text-slate-400 font-mono max-w-full break-words">{detail}</p>
      )}
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-primary underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

export function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [scansData, setScansData] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState<string | null>(null);

  const dateRange = useDateRange("7d");
  const { from, to, rangeKey } = dateRange;

  const hasLoadedStats = useRef(false);
  const hasLoadedCharts = useRef(false);
  const prevRangeKey = useRef("");

  // Multi-tab lock contention errors from supabase-js are transient; retry
  // once after a short delay before surfacing them to the user.
  const isLockContention = (e: unknown) => {
    const msg = (e as { message?: string })?.message?.toLowerCase?.() ?? "";
    return msg.includes("lock") && (msg.includes("stole") || msg.includes("released"));
  };

  const runWithLockRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (isLockContention(e)) {
        await new Promise((r) => setTimeout(r, 600));
        return await fn();
      }
      throw e;
    }
  };

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(null);
    runWithLockRetry(async () => {
      await ensureFreshSession();
      return getDashboardStats();
    })
      .then((data) => {
        setStats(data);
        setStatsError(null);
      })
      .catch((e) => {
        if (e?.name !== "AuthExpiredError") {
          setStatsError(e instanceof Error ? e.message : "Unknown error");
          console.error("[Dashboard] getDashboardStats failed:", e);
        }
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const loadCharts = useCallback((f: Date, t: Date) => {
    setChartsLoading(true);
    setChartsError(null);
    runWithLockRetry(async () => {
      await ensureFreshSession();
      return Promise.all([getScansPerDay(f, t), getRequestsByType(f, t)]);
    })
      .then(([scans, types]) => {
        setScansData(scans);
        setReqTypes(types);
        setChartsError(null);
      })
      .catch((e) => {
        if (e?.name !== "AuthExpiredError") {
          setChartsError(e instanceof Error ? e.message : "Unknown error");
          console.error("[Dashboard] chart load failed:", e);
        }
      })
      .finally(() => setChartsLoading(false));
  }, []);

  useEffect(() => {
    if (!hasLoadedStats.current) {
      hasLoadedStats.current = true;
      loadStats();
    }
  }, [loadStats]);

  useEffect(() => {
    if (!hasLoadedCharts.current || prevRangeKey.current !== rangeKey) {
      hasLoadedCharts.current = true;
      prevRangeKey.current = rangeKey;
      loadCharts(from, to);
    }
  }, [loadCharts, from, to, rangeKey]);

  const handleRefresh = () => {
    loadStats();
    loadCharts(from, to);
  };

  const anyLoading = statsLoading || chartsLoading;
  const rangeLabel = RANGE_LABELS[rangeKey];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={anyLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <LowStockBanner />

      <DateRangeBar state={dateRange} label="Filter charts:" />

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : statsError || stats === null ? (
        <ErrorBanner
          message="Could not load platform stats."
          detail={statsError ?? undefined}
          onRetry={loadStats}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Active QR Codes" value={stats.activeQRCodes} icon={QrCode} color="text-violet-600" bg="bg-violet-50" />
          <StatCard label="Requests Today" value={stats.todayRequests} icon={MessageSquare} color="text-green-600" bg="bg-green-50" />
          <StatCard label="Emergency Reqs" value={stats.emergencyRequests} icon={Zap} color="text-red-500" bg="bg-red-50" />
          <StatCard label="Total Orders" value={stats.totalOrders} icon={ShoppingCart} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Revenue" value="—" icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">QR Scans</p>
          <p className="text-[11px] text-slate-400 mb-4">{rangeLabel}</p>
          {chartsLoading ? (
            <Skeleton className="h-48" />
          ) : chartsError ? (
            <ChartError detail={chartsError} onRetry={() => loadCharts(from, to)} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scansData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="scans" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">Contact Requests by Type</p>
          <p className="text-[11px] text-slate-400 mb-4">{rangeLabel}</p>
          {chartsLoading ? (
            <Skeleton className="h-48" />
          ) : chartsError ? (
            <ChartError detail={chartsError} onRetry={() => loadCharts(from, to)} />
          ) : reqTypes.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={reqTypes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}