import { useCallback, useEffect, useState } from "react";
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

interface Stats { totalUsers: number; activeQRCodes: number; todayRequests: number; emergencyRequests: number; totalOrders: number; }

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number | string; icon: React.ElementType; color: string; bg: string }) {
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

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <p className="text-sm text-red-600 flex-1">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 flex-shrink-0"
      >
        Retry
      </button>
    </div>
  );
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2">
      <AlertCircle className="w-6 h-6 text-slate-300" />
      <p className="text-sm text-slate-400">Could not load chart data</p>
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
  const [statsError, setStatsError] = useState(false);

  const [scansData, setScansData] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState(false);

  const dateRange = useDateRange("7d");
  const { from, to, rangeKey } = dateRange;

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(false);
    ensureFreshSession()
      .then(() => getDashboardStats())
      .then((data) => { setStats(data); setStatsError(false); })
      .catch(() => { setStatsError(true); })
      .finally(() => setStatsLoading(false));
  }, []);

  const loadCharts = useCallback((f: Date, t: Date) => {
    setChartsLoading(true);
    setChartsError(false);
    ensureFreshSession()
      .then(() => Promise.all([getScansPerDay(f, t), getRequestsByType(f, t)]))
      .then(([scans, types]) => {
        setScansData(scans);
        setReqTypes(types);
        setChartsError(false);
      })
      .catch(() => { setChartsError(true); })
      .finally(() => setChartsLoading(false));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCharts(from, to); }, [loadCharts, from, to]);

  const handleRefresh = () => {
    loadStats();
    loadCharts(from, to);
  };

  const anyLoading = statsLoading || chartsLoading;
  const rangeLabel = RANGE_LABELS[rangeKey];

  return (
    <div className="space-y-6">

      {/* Header */}
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

      {/* Date range filter — always visible */}
      <DateRangeBar state={dateRange} label="Filter charts:" />

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : statsError || stats === null ? (
        <ErrorBanner
          message="Could not load platform stats."
          onRetry={loadStats}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Users"      value={stats.totalUsers}        icon={Users}          color="text-blue-600"    bg="bg-blue-50" />
          <StatCard label="Active QR Codes"  value={stats.activeQRCodes}     icon={QrCode}         color="text-violet-600"  bg="bg-violet-50" />
          <StatCard label="Requests Today"   value={stats.todayRequests}     icon={MessageSquare}  color="text-green-600"   bg="bg-green-50" />
          <StatCard label="Emergency Reqs"   value={stats.emergencyRequests} icon={Zap}            color="text-red-500"     bg="bg-red-50" />
          <StatCard label="Total Orders"     value={stats.totalOrders}       icon={ShoppingCart}   color="text-amber-600"   bg="bg-amber-50" />
          <StatCard label="Revenue"          value="—"                       icon={DollarSign}     color="text-emerald-600" bg="bg-emerald-50" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">QR Scans</p>
          <p className="text-[11px] text-slate-400 mb-4">{rangeLabel}</p>
          {chartsLoading ? (
            <Skeleton className="h-48" />
          ) : chartsError ? (
            <ChartError onRetry={() => loadCharts(from, to)} />
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
            <ChartError onRetry={() => loadCharts(from, to)} />
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
