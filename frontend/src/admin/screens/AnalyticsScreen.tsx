import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Users, UserX, Activity } from "lucide-react";
import {
  getScansPerDay, getRequestsByType, getTopQRCategories, getPeakHourData,
  adminGetGeoBreakdown, adminGetDeviceBreakdown,
  adminGetScanSummary, getScansPerDayWithSplit,
  type GeoBreakdownRow, type DeviceBreakdownRow, type ScanSummary, type ScanDaySplit,
} from "@/services/adminService";
import { DateRangeBar, useDateRange, RANGE_LABELS } from "@/admin/components/DateRangeBar";
import { ensureFreshSession } from "@/lib/adminAuth";

const PIE_COLORS = ["#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065", "#8b5cf6"];
const DEVICE_COLORS: Record<string, string> = {
  mobile: "#7c3aed",
  desktop: "#06b6d4",
  tablet: "#f59e0b",
  unknown: "#94a3b8",
};

const COUNTRY_ISO: Record<string, string> = {
  "india": "IN", "united states": "US", "united kingdom": "GB",
  "canada": "CA", "australia": "AU", "germany": "DE", "france": "FR",
  "japan": "JP", "china": "CN", "brazil": "BR", "russia": "RU",
  "south korea": "KR", "mexico": "MX", "italy": "IT", "spain": "ES",
  "netherlands": "NL", "switzerland": "CH", "sweden": "SE", "singapore": "SG",
  "malaysia": "MY", "indonesia": "ID", "thailand": "TH", "vietnam": "VN",
  "philippines": "PH", "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK",
  "nepal": "NP", "new zealand": "NZ", "south africa": "ZA", "nigeria": "NG",
  "kenya": "KE", "egypt": "EG", "saudi arabia": "SA", "united arab emirates": "AE",
  "qatar": "QA", "turkey": "TR", "ukraine": "UA", "poland": "PL",
};

function countryFlag(country: string): string {
  const iso = COUNTRY_ISO[country.toLowerCase()];
  if (!iso) return "🌐";
  return iso.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />;
}

function ChartCard({ title, subtitle, children, loading }: { title: string; subtitle?: string; children: React.ReactNode; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {loading ? <Skeleton className="h-52" /> : children}
    </div>
  );
}

function PeakHourHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const empty = data.every((d) => d.count === 0);

  if (empty) {
    return <div className="h-32 flex items-center justify-center text-sm text-slate-400">No scan data yet</div>;
  }

  const intensity = (count: number) => {
    if (count === 0) return { bg: "#f8fafc", text: "#94a3b8" };
    const ratio = count / max;
    if (ratio < 0.2) return { bg: "#ede9fe", text: "#7c3aed" };
    if (ratio < 0.4) return { bg: "#ddd6fe", text: "#6d28d9" };
    if (ratio < 0.6) return { bg: "#c4b5fd", text: "#5b21b6" };
    if (ratio < 0.8) return { bg: "#a78bfa", text: "#3b0764" };
    return { bg: "#7c3aed", text: "#ffffff" };
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-1">
        {data.map((d) => {
          const style = intensity(d.count);
          return (
            <div
              key={d.hour}
              title={`${d.hour}:00 — ${d.count} scans`}
              className="aspect-square rounded-md flex flex-col items-center justify-center cursor-default select-none"
              style={{ backgroundColor: style.bg }}
            >
              <span className="text-[9px] font-bold leading-none" style={{ color: style.text }}>{d.hour}</span>
              <span className="text-[8px] leading-none mt-0.5" style={{ color: style.text }}>{d.count > 0 ? d.count : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Low</span>
        {["#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#7c3aed"].map((c) => (
          <div key={c} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
        ))}
        <span>High</span>
      </div>
      <p className="text-[11px] text-slate-400">Each cell = 1 hour of the day. Hover for exact count.</p>
    </div>
  );
}

function GeoBarChart({ data, height = 210 }: { data: GeoBreakdownRow[]; height?: number }) {
  if (data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-sm text-slate-400">No geo data yet</div>;
  }
  const chartData = data.map((row) => ({
    country: `${countryFlag(row.country)} ${row.country}`,
    count: row.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
        <YAxis dataKey="country" type="category" tick={{ fontSize: 10 }} width={100} />
        <Tooltip />
        <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DevicePieChart({ data, colors, height = 210 }: { data: DeviceBreakdownRow[]; colors?: Record<string, string>; height?: number }) {
  if (data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-sm text-slate-400">No device data yet</div>;
  }
  const chartData = data.map((row) => ({
    name: row.device.charAt(0).toUpperCase() + row.device.slice(1),
    value: row.count,
    key: row.device,
  }));
  const colorMap = colors ?? DEVICE_COLORS;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false} fontSize={10}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={colorMap[entry.key] ?? PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="h-[210px] flex flex-col items-center justify-center gap-2 px-4">
      <p className="text-sm font-semibold text-red-600 text-center">Failed to load data</p>
      <p className="text-xs font-mono text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center max-w-xs">{message}</p>
    </div>
  );
}

/* ────────── User vs Strangers split section ────────── */
function ScanSummaryPills({ summary, loading }: { summary: ScanSummary | null; loading: boolean }) {
  const pills = [
    { label: "Total Scans",     value: summary?.total ?? 0,      icon: Activity, bg: "bg-violet-50", color: "text-violet-700" },
    { label: "Registered",      value: summary?.registered ?? 0, icon: Users,    bg: "bg-indigo-50", color: "text-indigo-700" },
    { label: "Anonymous",       value: summary?.strangers ?? 0,  icon: UserX,    bg: "bg-amber-50",  color: "text-amber-700"  },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {pills.map(({ label, value, icon: Icon, bg, color }) => (
        <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0`}>
            <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className={`text-xl font-extrabold ${color}`}>{loading ? "…" : value.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-tight">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScanSplitChart({ data, loading }: { data: ScanDaySplit[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[210px]" />;
  if (data.length === 0) {
    return <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No scan data in this period</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="registered" name="Registered" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="strangers" name="Anonymous" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ────────── Main screen ────────── */
export function AnalyticsScreen() {
  const dateRange = useDateRange("30d");
  const { from, to, rangeKey } = dateRange;

  const [scans, setScans] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [qrCats, setQrCats] = useState<{ category: string; count: number }[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [loadingCore, setLoadingCore] = useState(true);

  const [geo, setGeo] = useState<GeoBreakdownRow[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [devices, setDevices] = useState<DeviceBreakdownRow[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [splitScans, setSplitScans] = useState<ScanDaySplit[]>([]);
  const [loadingSplit, setLoadingSplit] = useState(true);
  const [splitError, setSplitError] = useState<string | null>(null);

  const [geoReg, setGeoReg] = useState<GeoBreakdownRow[]>([]);
  const [geoStr, setGeoStr] = useState<GeoBreakdownRow[]>([]);
  const [loadingGeoSplit, setLoadingGeoSplit] = useState(true);
  const [geoSplitError, setGeoSplitError] = useState<string | null>(null);

  const [devReg, setDevReg] = useState<DeviceBreakdownRow[]>([]);
  const [devStr, setDevStr] = useState<DeviceBreakdownRow[]>([]);
  const [loadingDevSplit, setLoadingDevSplit] = useState(true);
  const [devSplitError, setDevSplitError] = useState<string | null>(null);

  const loadAll = useCallback((f: Date, t: Date) => {
    setLoadingCore(true);
    setLoadingGeo(true);
    setLoadingDevices(true);
    setLoadingSummary(true);
    setLoadingSplit(true);
    setLoadingGeoSplit(true);
    setLoadingDevSplit(true);
    setGeoError(null);
    setDeviceError(null);
    setSummaryError(null);
    setSplitError(null);
    setGeoSplitError(null);
    setDevSplitError(null);

    ensureFreshSession().then(() => {
      Promise.all([
        getScansPerDay(f, t),
        getRequestsByType(f, t),
        getTopQRCategories(f, t),
        getPeakHourData(f, t),
      ]).then(([s, r, c, h]) => {
        setScans(s); setReqTypes(r); setQrCats(c); setPeakHours(h);
      })
      .catch(() => {})
      .finally(() => setLoadingCore(false));

      adminGetGeoBreakdown("all", f, t)
        .then(setGeo)
        .catch((e) => setGeoError(e instanceof Error ? e.message : "Failed to load geo data"))
        .finally(() => setLoadingGeo(false));

      adminGetDeviceBreakdown("all", f, t)
        .then(setDevices)
        .catch((e) => setDeviceError(e instanceof Error ? e.message : "Failed to load device data"))
        .finally(() => setLoadingDevices(false));

      adminGetScanSummary(f, t)
        .then(setSummary)
        .catch((e) => setSummaryError(e instanceof Error ? e.message : "Failed to load scan summary"))
        .finally(() => setLoadingSummary(false));

      getScansPerDayWithSplit(f, t)
        .then(setSplitScans)
        .catch((e) => setSplitError(e instanceof Error ? e.message : "Failed to load scan trend"))
        .finally(() => setLoadingSplit(false));

      Promise.all([
        adminGetGeoBreakdown("registered", f, t, 5),
        adminGetGeoBreakdown("strangers", f, t, 5),
      ]).then(([reg, str]) => { setGeoReg(reg); setGeoStr(str); })
        .catch((e) => setGeoSplitError(e instanceof Error ? e.message : "Failed to load geo split"))
        .finally(() => setLoadingGeoSplit(false));

      Promise.all([
        adminGetDeviceBreakdown("registered", f, t),
        adminGetDeviceBreakdown("strangers", f, t),
      ]).then(([reg, str]) => { setDevReg(reg); setDevStr(str); })
        .catch((e) => setDevSplitError(e instanceof Error ? e.message : "Failed to load device split"))
        .finally(() => setLoadingDevSplit(false));
    });
  }, []);

  useEffect(() => { loadAll(from, to); }, [loadAll, from, to]);

  const rangeLabel = RANGE_LABELS[rangeKey];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Platform usage & engagement insights</p>
      </div>

      {/* Date filter */}
      <DateRangeBar state={dateRange} label="Filter data:" />

      {/* ── Core charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ChartCard title="QR Scans" subtitle={rangeLabel} loading={loadingCore}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={scans}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="scans" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contact Requests by Type" subtitle={rangeLabel} loading={loadingCore}>
          {reqTypes.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No data in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={reqTypes} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {reqTypes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top Countries by Scan Count" subtitle="Based on IP geolocation" loading={loadingGeo}>
          {geoError ? <ErrorState message={geoError} /> : <GeoBarChart data={geo} />}
        </ChartCard>

        <ChartCard title="Devices & Browsers" subtitle="Scanner device type distribution" loading={loadingDevices}>
          {deviceError ? <ErrorState message={deviceError} /> : <DevicePieChart data={devices} />}
        </ChartCard>

        <ChartCard title="Top QR Code Categories" subtitle={rangeLabel} loading={loadingCore}>
          {qrCats.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No data in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={qrCats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Peak Scan Hours — 24-Hour Heatmap" subtitle={rangeLabel} loading={loadingCore}>
          <PeakHourHeatmap data={peakHours} />
        </ChartCard>

      </div>

      {/* ── Registered Users vs Strangers ── */}
      <div className="space-y-4">
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-base font-bold text-slate-900">Registered Users vs Strangers</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Breakdown of scanner activity by identity type — {rangeLabel.toLowerCase()}
          </p>
        </div>

        {/* Summary pills */}
        {summaryError ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center space-y-1">
            <p className="text-sm font-semibold text-red-600">Failed to load scan summary</p>
            <p className="text-xs font-mono text-red-500">{summaryError}</p>
          </div>
        ) : (
          <ScanSummaryPills summary={summary} loading={loadingSummary} />
        )}

        {/* Dual-line scan trend */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">Scan Trend — Registered vs Anonymous</p>
          <p className="text-[11px] text-slate-400 mb-4">{rangeLabel} · Purple = registered, Amber = anonymous strangers</p>
          {splitError ? (
            <ErrorState message={splitError} />
          ) : (
            <ScanSplitChart data={splitScans} loading={loadingSplit} />
          )}
        </div>

        {/* Geo split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Countries — Registered Scanners" subtitle="Top 5 countries" loading={loadingGeoSplit}>
            {geoSplitError ? <ErrorState message={geoSplitError} /> : <GeoBarChart data={geoReg} height={180} />}
          </ChartCard>
          <ChartCard title="Countries — Anonymous Strangers" subtitle="Top 5 countries" loading={loadingGeoSplit}>
            {geoSplitError ? <ErrorState message={geoSplitError} /> : <GeoBarChart data={geoStr} height={180} />}
          </ChartCard>
        </div>

        {/* Device split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Devices — Registered Scanners" subtitle="Device type breakdown" loading={loadingDevSplit}>
            {devSplitError ? <ErrorState message={devSplitError} /> : <DevicePieChart data={devReg} height={180} />}
          </ChartCard>
          <ChartCard title="Devices — Anonymous Strangers" subtitle="Device type breakdown" loading={loadingDevSplit}>
            {devSplitError ? <ErrorState message={devSplitError} /> : (
              <DevicePieChart
                data={devStr}
                height={180}
                colors={{ mobile: "#f59e0b", desktop: "#fb923c", tablet: "#fbbf24", unknown: "#94a3b8" }}
              />
            )}
          </ChartCard>
        </div>
      </div>

    </div>
  );
}
