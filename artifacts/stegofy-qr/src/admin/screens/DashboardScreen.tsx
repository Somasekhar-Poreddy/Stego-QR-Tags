import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, QrCode, MessageSquare, ShoppingCart, Zap, DollarSign } from "lucide-react";
import {
  getDashboardStats, getScansPerDay, getRequestsByType,
} from "@/services/adminService";

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

export function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scansData, setScansData] = useState<{ date: string; scans: number }[]>([]);
  const [reqTypes, setReqTypes] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getScansPerDay(7), getRequestsByType()])
      .then(([s, scans, types]) => {
        setStats(s);
        setScansData(scans);
        setReqTypes(types);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Users"      value={stats!.totalUsers}       icon={Users}          color="text-blue-600"   bg="bg-blue-50" />
          <StatCard label="Active QR Codes"  value={stats!.activeQRCodes}    icon={QrCode}         color="text-violet-600" bg="bg-violet-50" />
          <StatCard label="Requests Today"   value={stats!.todayRequests}    icon={MessageSquare}  color="text-green-600"  bg="bg-green-50" />
          <StatCard label="Emergency Reqs"   value={stats!.emergencyRequests} icon={Zap}           color="text-red-500"    bg="bg-red-50" />
          <StatCard label="Total Orders"     value={stats!.totalOrders}      icon={ShoppingCart}   color="text-amber-600"  bg="bg-amber-50" />
          <StatCard label="Revenue"          value="—"                       icon={DollarSign}     color="text-emerald-600" bg="bg-emerald-50" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-4">QR Scans — Last 7 Days</p>
          {loading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scansData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="scans" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-800 mb-4">Contact Requests by Type</p>
          {loading ? <Skeleton className="h-48" /> : reqTypes.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data yet</div>
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
