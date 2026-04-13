import { useLocation } from "wouter";
import { CheckCircle2, Package, ChevronRight } from "lucide-react";

export function OrderConfirmationScreen({ orderId }: { orderId: string }) {
  const [, navigate] = useLocation();

  const short = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto flex flex-col items-center justify-center px-6 gap-6">
      {/* Success icon */}
      <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle2 className="w-14 h-14 text-green-500" />
      </div>

      {/* Text */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Order Placed!</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your order has been received and is being processed. We'll ship it soon!
        </p>
      </div>

      {/* Order ID card */}
      <div className="w-full bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Order ID</p>
          <p className="text-sm font-bold text-slate-800 font-mono">#{short}</p>
        </div>
        <div className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-lg">
          COD
        </div>
      </div>

      {/* CTA buttons */}
      <div className="w-full space-y-3">
        <button
          onClick={() => navigate("/app/orders")}
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
        >
          Track My Orders <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/app/shop")}
          className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
