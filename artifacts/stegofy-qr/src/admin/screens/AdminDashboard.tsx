import { Users, QrCode, MessageSquare, ShoppingCart } from "lucide-react";

function StatCard({
  label, value, icon: Icon, color, bg,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; bg: string;
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

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Overview</h2>
        <p className="text-sm text-slate-500 mt-0.5">Real-time stats will appear here once the admin panel modules are built.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"     value="—" icon={Users}          color="text-blue-600"   bg="bg-blue-50" />
        <StatCard label="Active QR Codes" value="—" icon={QrCode}         color="text-violet-600" bg="bg-violet-50" />
        <StatCard label="Requests Today"  value="—" icon={MessageSquare}  color="text-green-600"  bg="bg-green-50" />
        <StatCard label="Total Orders"    value="—" icon={ShoppingCart}   color="text-amber-600"  bg="bg-amber-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500 mb-4">Charts — coming in Task #4</p>
        <div className="h-48 bg-slate-50 rounded-xl flex items-center justify-center">
          <p className="text-sm text-slate-400">QR scans per day chart will render here</p>
        </div>
      </div>
    </div>
  );
}
