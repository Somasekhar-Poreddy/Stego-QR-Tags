import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  getScansPerDay, getRequestsByType, getTopQRCategories, getPeakHourData,
} from "@/services/adminService";

const PIE_COLORS = ["#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065", "#8b5cf6"];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />;
}

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-4">{title}</p>
      {loading ? <Skeleton className="h-52" /> : children}
    </div>
  );
}

export function AnalyticsScreen() {
  const [scans, setScans] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [qrCats, setQrCats] = useState<{ category: string; count: number }[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getScansPerDay(14),
      getRequestsByType(),
      getTopQRCategories(),
      getPeakHourData(),
    ]).then(([s, r, c, h]) => {
      setScans(s);
      setReqTypes(r);
      setQrCats(c);
      setPeakHours(h);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Platform usage & engagement insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scan trend */}
        <ChartCard title="QR Scans — Last 14 Days" loading={loading}>
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

        {/* Request types */}
        <ChartCard title="Contact Requests by Type" loading={loading}>
          {reqTypes.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={reqTypes} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {reqTypes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* QR categories */}
        <ChartCard title="Top QR Code Categories" loading={loading}>
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

        {/* Peak hour heatmap (bar) */}
        <ChartCard title="Peak Scan Hours (by UTC hour)" loading={loading}>
          {peakHours.every((h) => h.count === 0) ? (
            <div className="h-[210px] flex items-center justify-center text-sm text-slate-400">No scan data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickFormatter={(h) => `${h}h`} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} scans`, "Count"]} labelFormatter={(h) => `Hour ${h}:00`} />
                <Bar dataKey="count" fill="#6d28d9" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
