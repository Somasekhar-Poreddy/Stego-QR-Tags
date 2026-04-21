import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Plus, X } from "lucide-react";
import {
  getOpenLowStockAlerts,
  dismissLowStockAlert,
  type LowStockAlert,
} from "@/services/adminService";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export function LowStockBanner() {
  const [, navigate] = useLocation();
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);

  const load = () => {
    getOpenLowStockAlerts()
      .then(setAlerts)
      .catch(() => {}); // Silent — the banner just stays empty on transient failures.
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const handleRestock = (category: string) => {
    navigate(`/admin/inventory?restock=${encodeURIComponent(category)}`);
  };

  const handleDismiss = async (id: string) => {
    // Optimistic: drop from UI immediately, then persist.
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await dismissLowStockAlert(id);
    } catch {
      // If the dismiss RPC fails, the 2-minute poll will bring the alert back.
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
        >
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-bold text-amber-900">
              Only {a.current_stock} <span className="capitalize">{a.category}</span> QR codes left in stock
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Below your threshold of {a.threshold}. Generate more before running out.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleRestock(a.category)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Generate more
            </button>
            <button
              onClick={() => handleDismiss(a.id)}
              className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
