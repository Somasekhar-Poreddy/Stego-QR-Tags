import { useEffect, useState } from "react";
import { Search, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import {
  adminGetOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
  ORDER_STATUS_PIPELINE,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
  type OrderWithItems,
} from "@/services/orderService";

const STATUS_TABS: (OrderStatus | "all")[] = ["all", "placed", "confirmed", "packed", "shipped", "delivered"];

function statusColor(s: string) {
  if (s === "delivered") return "text-green-600 bg-green-50";
  if (s === "cancelled") return "text-red-500 bg-red-50";
  if (s === "shipped") return "text-blue-600 bg-blue-50";
  if (s === "packed") return "text-violet-600 bg-violet-50";
  if (s === "confirmed") return "text-cyan-600 bg-cyan-50";
  return "text-amber-600 bg-amber-50";
}

function Pipeline({ current, orderId, onUpdate }: { current: OrderStatus; orderId: string; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);

  const advance = async () => {
    const idx = ORDER_STATUS_PIPELINE.indexOf(current);
    if (idx < 0 || idx >= ORDER_STATUS_PIPELINE.length - 1) return;
    setSaving(true);
    await adminUpdateOrderStatus(orderId, ORDER_STATUS_PIPELINE[idx + 1]);
    setSaving(false);
    onUpdate();
  };

  const curIdx = ORDER_STATUS_PIPELINE.indexOf(current);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ORDER_STATUS_PIPELINE.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${i <= curIdx ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
              {ORDER_STATUS_LABELS[s]}
            </div>
            {i < ORDER_STATUS_PIPELINE.length - 1 && (
              <div className={`w-4 h-0.5 ${i < curIdx ? "bg-primary" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>
      {curIdx < ORDER_STATUS_PIPELINE.length - 1 && current !== "cancelled" && (
        <button
          onClick={advance}
          disabled={saving}
          className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : `Mark as ${ORDER_STATUS_LABELS[ORDER_STATUS_PIPELINE[curIdx + 1]]}`}
        </button>
      )}
    </div>
  );
}

function OrderRow({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<OrderWithItems | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const sd = order.shipping_details;

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      const d = await adminGetOrderById(order.id);
      setDetail(d);
      setLoadingDetail(false);
    }
    setExpanded((v) => !v);
  };

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={toggle}>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-800">{sd?.name || "—"}</p>
          <p className="text-[11px] text-slate-400">{sd?.email || sd?.phone || "—"}</p>
        </td>
        <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{sd?.phone || "—"}</td>
        <td className="px-4 py-3 text-slate-700 font-semibold hidden lg:table-cell">₹{order.total_price}</td>
        <td className="px-4 py-3 hidden xl:table-cell">
          <span className="text-xs font-semibold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{order.payment_type}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${statusColor(order.order_status)}`}>
            {ORDER_STATUS_LABELS[order.order_status] ?? order.order_status}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{order.created_at?.slice(0, 10)}</td>
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-4 pb-4">
            {loadingDetail ? (
              <p className="text-sm text-slate-400 py-2">Loading details…</p>
            ) : detail ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Shipping Address</p>
                  <div className="bg-white rounded-xl border border-slate-100 p-3 text-sm text-slate-700 space-y-0.5">
                    <p className="font-semibold">{sd?.name}</p>
                    <p>{sd?.phone}{sd?.alternate_phone ? ` / ${sd.alternate_phone}` : ""}</p>
                    <p>{sd?.address}{sd?.landmark ? `, ${sd.landmark}` : ""}</p>
                    <p>{sd?.city}, {sd?.state} – {sd?.pincode}</p>
                    {sd?.email && <p className="text-slate-400">{sd.email}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Order Items</p>
                  <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
                    {detail.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-800">{item.product_name}</span>
                          {item.variant_name && <span className="text-xs text-slate-400 ml-1">({item.variant_name})</span>}
                          <span className="text-xs text-slate-400 ml-1">× {item.quantity}</span>
                        </div>
                        <span className="font-semibold text-slate-700">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50">
                      <span>Total</span>
                      <span>₹{detail.total_price}</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <p className="text-xs font-bold text-slate-600 mb-2">Update Status</p>
                  <Pipeline current={detail.order_status} orderId={detail.id} onUpdate={onUpdate} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-2">Could not load order details.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    adminGetOrders(activeTab, 100, 0)
      .then((d) => { setOrders(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { reload(); }, [activeTab]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(orders.filter((o) => {
      if (!q) return true;
      const sd = o.shipping_details;
      return [sd?.name, sd?.email, sd?.phone, sd?.city, o.order_status].some((v) => v?.toLowerCase().includes(q));
    }));
  }, [search, orders]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} orders</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === tab ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            {tab === "all" ? "All" : ORDER_STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Total</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Payment</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Date</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  <p className="text-slate-400 text-sm">No orders found</p>
                </td></tr>
              ) : filtered.map((o) => (
                <OrderRow key={o.id} order={o} onUpdate={reload} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
