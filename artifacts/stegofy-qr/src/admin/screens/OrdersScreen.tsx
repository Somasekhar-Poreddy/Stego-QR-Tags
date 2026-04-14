import { useEffect, useState, useCallback } from "react";
import {
  Search, ShoppingBag, ChevronDown, ChevronUp, MapPin, Phone,
  Mail, AlertCircle, RefreshCw, Package, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Truck, Box, ClipboardList, CircleDot,
} from "lucide-react";
import {
  adminGetOrders,
  adminGetOrdersCount,
  adminGetOrderById,
  adminUpdateOrderStatus,
  ORDER_STATUS_PIPELINE,
  ORDER_STATUS_LABELS,
} from "@/services/adminService";
import { ensureFreshSession } from "@/lib/adminAuth";
import type { Order, OrderStatus, OrderWithItems } from "@/services/orderService";

/* ─── Constants ─── */

const PAGE_SIZE = 30;
const STATUS_TABS: (OrderStatus | "all")[] = [
  "all", "placed", "confirmed", "packed", "shipped", "delivered",
];

/* ─── Helpers ─── */

function statusBadge(s: OrderStatus | string) {
  const map: Record<string, string> = {
    delivered:  "bg-green-100 text-green-700 border-green-200",
    cancelled:  "bg-red-100 text-red-500 border-red-200",
    shipped:    "bg-blue-100 text-blue-700 border-blue-200",
    packed:     "bg-violet-100 text-violet-700 border-violet-200",
    confirmed:  "bg-cyan-100 text-cyan-700 border-cyan-200",
    placed:     "bg-amber-100 text-amber-700 border-amber-200",
  };
  return map[s] ?? "bg-slate-100 text-slate-500 border-slate-200";
}

function paymentBadge(pt: string) {
  return pt === "online"
    ? "bg-indigo-100 text-indigo-700"
    : "bg-slate-100 text-slate-600";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatPrice(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function shortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/* ─── Step icons for pipeline ─── */

const STEP_ICONS: Record<OrderStatus, React.ElementType> = {
  placed:    ClipboardList,
  confirmed: CheckCircle2,
  packed:    Box,
  shipped:   Truck,
  delivered: CircleDot,
  cancelled: XCircle,
};

/* ─── Pipeline stepper ─── */

function PipelineStepper({
  current, orderId, onUpdate, onStatusChanged,
}: {
  current: OrderStatus;
  orderId: string;
  onUpdate: () => void;
  onStatusChanged?: (s: OrderStatus) => void;
}) {
  const [saving, setSaving] = useState<OrderStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const curIdx = ORDER_STATUS_PIPELINE.indexOf(current);
  const nextStatus = curIdx >= 0 && curIdx < ORDER_STATUS_PIPELINE.length - 1
    ? ORDER_STATUS_PIPELINE[curIdx + 1]
    : null;
  const isCancelled = current === "cancelled";
  const isDelivered = current === "delivered";

  const advance = async () => {
    if (!nextStatus) return;
    setSaving(nextStatus); setErr(null);
    const result = await adminUpdateOrderStatus(orderId, nextStatus);
    setSaving(null);
    if (result.error) { setErr(result.error); return; }
    onStatusChanged?.(nextStatus);
    onUpdate();
  };

  const cancel = async () => {
    setSaving("cancelled"); setErr(null);
    const result = await adminUpdateOrderStatus(orderId, "cancelled");
    setSaving(null);
    if (result.error) { setErr(result.error); return; }
    onStatusChanged?.("cancelled");
    onUpdate();
  };

  return (
    <div className="space-y-3">
      {/* Stepper row */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {ORDER_STATUS_PIPELINE.map((s, i) => {
          const Icon = STEP_ICONS[s];
          const done = curIdx >= 0 && i <= curIdx && !isCancelled;
          const active = i === curIdx && !isCancelled;
          return (
            <div key={s} className="flex items-center gap-0 flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  active   ? "bg-primary text-white shadow-md shadow-primary/30 ring-2 ring-primary/20" :
                  done     ? "bg-primary/80 text-white" :
                             "bg-slate-100 text-slate-400"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className={`text-[10px] font-semibold whitespace-nowrap ${active ? "text-primary" : done ? "text-primary/70" : "text-slate-400"}`}>
                  {ORDER_STATUS_LABELS[s]}
                </p>
              </div>
              {i < ORDER_STATUS_PIPELINE.length - 1 && (
                <div className={`w-8 h-0.5 -mt-4 ${i < curIdx && !isCancelled ? "bg-primary/60" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
        {isCancelled && (
          <span className="ml-3 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Cancelled</span>
        )}
      </div>

      {/* Action buttons */}
      {!isCancelled && !isDelivered && (
        <div className="flex gap-2 flex-wrap">
          {nextStatus && (
            <button
              onClick={advance}
              disabled={!!saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm shadow-primary/20"
            >
              {saving === nextStatus ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Mark as {ORDER_STATUS_LABELS[nextStatus]}
            </button>
          )}
          <button
            onClick={cancel}
            disabled={!!saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 border border-red-200 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            {saving === "cancelled" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Cancel Order
          </button>
        </div>
      )}
      {err && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </p>
      )}
    </div>
  );
}

/* ─── Order detail panel (expanded row) ─── */

function OrderDetail({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const [detail, setDetail] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Track status locally so stepper updates immediately without collapsing the row
  const [localStatus, setLocalStatus] = useState<OrderStatus>(order.order_status);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    adminGetOrderById(order.id)
      .then((d) => {
        setDetail(d);
        if (d) setLocalStatus(d.order_status);
        setLoading(false);
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : "Failed to load"); setLoading(false); });
  }, [order.id]);

  const sd = detail?.shipping_details ?? order.shipping_details;

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (err || !detail) {
    return (
      <div className="px-4 py-4 flex items-center gap-2 text-red-500">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{err ?? "Could not load order details."}</span>
      </div>
    );
  }

  return (
    <div className="px-4 pb-5 pt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Shipping address */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2.5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" /> Shipping Address
        </p>
        <div className="space-y-0.5 text-sm text-slate-700">
          <p className="font-semibold">{sd?.name || "—"}</p>
          {sd?.phone && (
            <p className="flex items-center gap-1.5 text-slate-500">
              <Phone className="w-3 h-3 flex-shrink-0" />
              {sd.phone}
              {sd.alternate_phone ? ` / ${sd.alternate_phone}` : ""}
            </p>
          )}
          {sd?.email && (
            <p className="flex items-center gap-1.5 text-slate-500">
              <Mail className="w-3 h-3 flex-shrink-0" /> {sd.email}
            </p>
          )}
          <p className="pt-1">{sd?.address}{sd?.landmark ? `, ${sd.landmark}` : ""}</p>
          <p className="text-slate-500">{sd?.city}, {sd?.state} – {sd?.pincode}</p>
        </div>
        <div className="pt-1 flex gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border capitalize ${paymentBadge(detail.payment_type)}`}>
            {detail.payment_type === "cod" ? "Cash on Delivery" : "Online Payment"}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusBadge(localStatus)}`}>
            {ORDER_STATUS_LABELS[localStatus] ?? localStatus}
          </span>
        </div>
      </div>

      {/* Order items */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 py-3 border-b border-slate-50 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" /> Order Items
        </p>
        <div className="divide-y divide-slate-50">
          {detail.items.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-4 text-center">No items</p>
          ) : detail.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.product_name}</p>
                <p className="text-xs text-slate-400">
                  {item.variant_name ? `${item.variant_name} · ` : ""}× {item.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-700 ml-3 flex-shrink-0">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100">
          <span className="text-sm font-bold text-slate-800">Total</span>
          <span className="text-sm font-bold text-slate-800">{formatPrice(detail.total_price)}</span>
        </div>
      </div>

      {/* Status pipeline */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-primary" /> Update Status
        </p>
        <PipelineStepper
          current={localStatus}
          orderId={detail.id}
          onUpdate={onUpdate}
          onStatusChanged={(s) => setLocalStatus(s)}
        />
      </div>
    </div>
  );
}

/* ─── Order row ─── */

function OrderRow({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sd = order.shipping_details;

  return (
    <>
      <tr
        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Order ID */}
        <td className="px-4 py-3">
          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
            {shortId(order.id)}
          </span>
        </td>
        {/* Customer */}
        <td className="px-4 py-3">
          <p className="font-semibold text-slate-800 text-sm">{sd?.name || "—"}</p>
          <p className="text-[11px] text-slate-400">{sd?.phone || sd?.email || "—"}</p>
        </td>
        {/* Total */}
        <td className="px-4 py-3 hidden md:table-cell">
          <span className="font-semibold text-slate-700 text-sm">{formatPrice(order.total_price)}</span>
        </td>
        {/* Payment type */}
        <td className="px-4 py-3 hidden lg:table-cell">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${paymentBadge(order.payment_type)}`}>
            {order.payment_type === "cod" ? "COD" : "Online"}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${statusBadge(order.order_status)}`}>
            {ORDER_STATUS_LABELS[order.order_status] ?? order.order_status}
          </span>
        </td>
        {/* Date */}
        <td className="px-4 py-3 hidden xl:table-cell">
          <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
        </td>
        {/* Expand */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={7} className="p-0">
            <OrderDetail order={order} onUpdate={onUpdate} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Tab count badge ─── */

function CountBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <span className="ml-1.5 text-[10px] font-bold bg-white/30 px-1.5 py-0.5 rounded-full">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* ─── Main screen ─── */

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState<Partial<Record<OrderStatus | "all", number>>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const load = useCallback(async (tab: OrderStatus | "all", p: number) => {
    setLoading(true);
    setError(null);
    try {
      await ensureFreshSession();
      const [rows, cnt] = await Promise.all([
        adminGetOrders(tab, PAGE_SIZE, p * PAGE_SIZE),
        adminGetOrdersCount(tab),
      ]);
      setOrders(rows);
      setTotal(cnt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    }
    setLoading(false);
  }, []);

  // Load tab counts once on mount
  useEffect(() => {
    Promise.all(
      STATUS_TABS.map(async (t) => {
        const cnt = await adminGetOrdersCount(t).catch(() => 0);
        return [t, cnt] as [typeof t, number];
      })
    ).then((entries) => {
      setTabCounts(Object.fromEntries(entries));
    });
  }, []);

  useEffect(() => {
    load(activeTab, page);
  }, [load, activeTab, page]);

  const refreshTabCounts = useCallback(() => {
    ensureFreshSession()
      .then(() => Promise.all(
        STATUS_TABS.map(async (t) => {
          const cnt = await adminGetOrdersCount(t).catch(() => 0);
          return [t, cnt] as [typeof t, number];
        })
      ))
      .then((entries) => {
        setTabCounts(Object.fromEntries(entries));
      });
  }, []);

  const reload = useCallback(() => {
    load(activeTab, page);
    refreshTabCounts();
  }, [load, activeTab, page, refreshTabCounts]);

  const handleTabChange = (tab: OrderStatus | "all") => {
    setActiveTab(tab);
    setPage(0);
    setSearch("");
  };

  // Client-side search filter
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const sd = o.shipping_details;
    return [sd?.name, sd?.phone, sd?.email, sd?.city, o.id].some(
      (v) => v?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Orders</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {activeTab === "all" ? "total" : ORDER_STATUS_LABELS[activeTab as OrderStatus]?.toLowerCase()} orders
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex items-center px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary"
            }`}
          >
            {tab === "all" ? "All Orders" : ORDER_STATUS_LABELS[tab as OrderStatus]}
            <CountBadge count={tabCounts[tab] ?? null} />
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, order ID…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={reload} className="text-xs font-semibold text-red-600 underline">Retry</button>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="w-20 h-5 bg-slate-100 animate-pulse rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-100 animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-slate-100 animate-pulse rounded w-1/5" />
                </div>
                <div className="w-16 h-5 bg-slate-100 animate-pulse rounded-lg hidden md:block" />
                <div className="w-14 h-5 bg-slate-100 animate-pulse rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[580px]">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Order ID</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Total</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Payment</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Date</th>
                  <th className="px-4 py-3 text-right w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <ShoppingBag className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500">No orders found</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {search ? `No results for "${search}"` : "Orders will appear here once customers place them"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <OrderRow key={o.id} order={o} onUpdate={reload} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0 || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <p className="text-xs text-slate-500 font-medium">
            Page {page + 1} of {totalPages} · {total} orders
          </p>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1 || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Results summary */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {filtered.length}{search ? ` matching` : ""} of {orders.length} on this page
          {search && (
            <button onClick={() => setSearch("")} className="ml-2 text-primary hover:underline">Clear search</button>
          )}
        </p>
      )}
    </div>
  );
}
