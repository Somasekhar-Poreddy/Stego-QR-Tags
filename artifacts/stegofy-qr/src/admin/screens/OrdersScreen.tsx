import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getOrders, updateOrderStatus, type Order } from "@/services/adminService";

const STATUS_OPTIONS = ["pending", "packed", "shipped", "delivered", "cancelled"];

function statusColor(s: string) {
  if (s === "delivered") return "text-green-600 bg-green-50";
  if (s === "cancelled") return "text-red-500 bg-red-50";
  if (s === "shipped") return "text-blue-600 bg-blue-50";
  if (s === "packed") return "text-violet-600 bg-violet-50";
  return "text-amber-600 bg-amber-50";
}

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = () => getOrders().then((d) => { setOrders(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(orders.filter((o) =>
      !q || [o.customer_name, o.email, o.phone, o.city, o.order_status].some((v) => v?.toLowerCase().includes(q))
    ));
  }, [search, orders]);

  const handleStatus = async (id: string, status: string) => {
    await updateOrderStatus(id, status);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} orders</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">City</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No orders found</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{o.customer_name || "—"}</p>
                    <p className="text-[11px] text-slate-400">{o.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{o.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{[o.city, o.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{o.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.order_status}
                      onChange={(e) => handleStatus(o.id, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${statusColor(o.order_status)}`}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
