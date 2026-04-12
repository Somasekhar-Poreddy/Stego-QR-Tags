import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  getScansPerDay, getRequestsByType, getTopQRCategories, getPeakHourData,
  adminGetGeoBreakdown, adminGetDeviceBreakdown,
  type GeoBreakdownRow, type DeviceBreakdownRow,
} from "@/services/adminService";

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
      <p className="text-[11px] text-slate-400">Each cell = 1 hour of the day (UTC). Hover for exact count.</p>
    </div>
  );
}

function GeoBarChart({ data }: { data: GeoBreakdownRow[] }) {
  if (data.length === 0) {
    return <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No geo data yet</div>;
  }

  const chartData = data.map((row) => ({
    country: `${countryFlag(row.country)} ${row.country}`,
    count: row.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={210}>
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

function DevicePieChart({ data }: { data: DeviceBreakdownRow[] }) {
  if (data.length === 0) {
    return <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No device data yet</div>;
  }

  const chartData = data.map((row) => ({
    name: row.device.charAt(0).toUpperCase() + row.device.slice(1),
    value: row.count,
    key: row.device,
  }));

  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={75}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          fontSize={10}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={DEVICE_COLORS[entry.key] ?? PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsScreen() {
  const [scans, setScans] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [qrCats, setQrCats] = useState<{ category: string; count: number }[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [geo, setGeo] = useState<GeoBreakdownRow[]>([]);
  const [devices, setDevices] = useState<DeviceBreakdownRow[]>([]);

  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - 13); from.setHours(0, 0, 0, 0);

    Promise.all([
      getScansPerDay(from, to),
      getRequestsByType(),
      getTopQRCategories(),
      getPeakHourData(),
    ]).then(([s, r, c, h]) => {
      setScans(s);
      setReqTypes(r);
      setQrCats(c);
      setPeakHours(h);
    })
    .catch(() => {})
    .finally(() => setLoadingCore(false));

    adminGetGeoBreakdown()
      .then(setGeo)
      .catch((e) => setGeoError(e instanceof Error ? e.message : "Failed to load geo data"))
      .finally(() => setLoadingGeo(false));

    adminGetDeviceBreakdown()
      .then(setDevices)
      .catch((e) => setDeviceError(e instanceof Error ? e.message : "Failed to load device data"))
      .finally(() => setLoadingDevices(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Platform usage & engagement insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scan trend */}
        <ChartCard title="QR Scans — Last 14 Days" loading={loadingCore}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={scans}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="scans" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Request types pie */}
        <ChartCard title="Contact Requests by Type" loading={loadingCore}>
          {reqTypes.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
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

        {/* Top countries */}
        <ChartCard
          title="Top Countries by Scan Count"
          subtitle="Based on IP geolocation data"
          loading={loadingGeo}
        >
          {geoError ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-semibold text-red-600">Failed to load geo data</p>
              <p className="text-xs font-mono text-red-500 bg-red-50 rounded-lg px-3 py-2 max-w-full text-center">{geoError}</p>
            </div>
          ) : (
            <GeoBarChart data={geo} />
          )}
        </ChartCard>

        {/* Device breakdown */}
        <ChartCard
          title="Devices & Browsers"
          subtitle="Scanner device type distribution"
          loading={loadingDevices}
        >
          {deviceError ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-semibold text-red-600">Failed to load device data</p>
              <p className="text-xs font-mono text-red-500 bg-red-50 rounded-lg px-3 py-2 max-w-full text-center">{deviceError}</p>
            </div>
          ) : (
            <DevicePieChart data={devices} />
          )}
        </ChartCard>

        {/* QR categories horizontal bar */}
        <ChartCard title="Top QR Code Categories" loading={loadingCore}>
          {qrCats.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
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

        {/* Peak hour heatmap grid */}
        <ChartCard title="Peak Scan Hours — 24-Hour Heatmap" loading={loadingCore}>
          <PeakHourHeatmap data={peakHours} />
        </ChartCard>
      </div>
    </div>
  );
}
