import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronDown, ChevronUp, Package, ShoppingBag } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { getUserOrders, getUserOrderWithItems, type Order, type OrderWithItems, type OrderStatus, ORDER_STATUS_LABELS } from "@/services/orderService";
import { useDataFetch } from "@/hooks/useDataFetch";
import { cn } from "@/lib/utils";

/* ─── Status badge ─── */

const STATUS_COLORS: Record<OrderStatus, string> = {
  placed:    "bg-blue-50 text-blue-600",
  confirmed: "bg-violet-50 text-violet-600",
  packed:    "bg-amber-50 text-amber-600",
  shipped:   "bg-cyan-50 text-cyan-600",
  delivered: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-500",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg", STATUS_COLORS[status])}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

/* ─── Order card ─── */

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(false);

  const date = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const short = order.id.slice(0, 8).toUpperCase();

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoading(true);
      const d = await getUserOrderWithItems(order.id);
      setDetail(d);
      setLoading(false);
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header row */}
      <button
        onClick={toggle}
        className="w-full flex items-start gap-3 p-4 text-left active:bg-slate-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-slate-800 font-mono">#{short}</p>
            <StatusBadge status={order.order_status} />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{date}</p>
          <p className="text-sm font-bold text-primary mt-1">₹{order.total_price.toLocaleString()}</p>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-slate-50 px-4 pb-4">
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              <div className="space-y-2 mt-3">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{item.product_name}</p>
                      {item.variant_name && <p className="text-[10px] text-slate-400">{item.variant_name}</p>}
                      <p className="text-[10px] text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-xs font-bold text-slate-700 flex-shrink-0">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Shipping address */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Shipping To</p>
                <p className="text-xs font-semibold text-slate-700">{detail.shipping_details.name}</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {detail.shipping_details.address}
                  {detail.shipping_details.landmark ? `, ${detail.shipping_details.landmark}` : ""}
                  {", "}{detail.shipping_details.city}, {detail.shipping_details.state} — {detail.shipping_details.pincode}
                </p>
                <p className="text-[10px] text-slate-500">{detail.shipping_details.phone}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">Could not load order details</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ─── */

function OrderSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-100 animate-pulse rounded w-2/3" />
        <div className="h-3 bg-slate-100 animate-pulse rounded w-1/3" />
        <div className="h-4 bg-slate-100 animate-pulse rounded w-1/4" />
      </div>
    </div>
  );
}

/* ─── Main screen ─── */

export function OrdersScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // useDataFetch: guards auth, preserves prev orders on empty/error, cancels on unmount
  const { data: orders, loading, error } = useDataFetch<Order>(
    () => (user?.id ? getUserOrders(user.id) : Promise.resolve([])),
    [user?.id],
  );

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/profile")}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-base font-bold text-slate-900">My Orders</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* Loading skeleton — only when no data has been loaded yet */}
        {loading && !orders ? (
          <>
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </>
        ) : (
          <>
            {/* Non-blocking inline error banner — shown above retained data */}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                <Package className="w-4 h-4 text-rose-400 shrink-0" />
                <p className="text-xs text-rose-600">{error}</p>
              </div>
            )}
            {/* Empty state — only when there is genuinely nothing to show */}
            {!orders || orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Package className="w-12 h-12 text-slate-200" />
                <p className="text-sm font-semibold text-slate-500">No orders yet</p>
                <p className="text-xs text-slate-400">Your orders will appear here after checkout</p>
                <button
                  onClick={() => navigate("/app/shop")}
                  className="mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-transform"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              orders.map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
