import { useEffect, useState } from "react";
import { Plus, Package, Boxes } from "lucide-react";
import { InventoryTab } from "./inventory/InventoryTab";
import { BatchesTab } from "./inventory/BatchesTab";
import {
  BulkGenerateModal,
  type BulkGenerateResult,
} from "./inventory/BulkGenerateModal";
import { readSearchParam, stripSearchParam } from "./inventory/inventoryHelpers";
import { cn } from "@/lib/utils";

type Tab = "inventory" | "batches";

export function InventoryScreen() {
  const [tab, setTab] = useState<Tab>("inventory");
  const [batchFilter, setBatchFilter] = useState<string | undefined>();
  const [focusItem, setFocusItem] = useState<string | undefined>();
  const [showGenerate, setShowGenerate] = useState(false);
  const [restockType, setRestockType] = useState<string | undefined>();
  const [inventoryKey, setInventoryKey] = useState(0); // forces InventoryTab remount after a new batch

  // Handle deep-link query params once at mount and whenever the URL changes
  // (the LowStockBanner uses client-side navigation with ?restock=…).
  useEffect(() => {
    const apply = () => {
      const tabParam = readSearchParam("tab");
      const batchParam = readSearchParam("batch");
      const focusParam = readSearchParam("focus");
      const restockParam = readSearchParam("restock");

      if (tabParam === "batches") setTab("batches");
      if (batchParam) { setTab("inventory"); setBatchFilter(batchParam); }
      if (focusParam) { setTab("inventory"); setFocusItem(focusParam); }
      if (restockParam) {
        setRestockType(restockParam);
        setShowGenerate(true);
      }
      // We consume the params so a refresh doesn't re-trigger the modal.
      if (tabParam || batchParam || focusParam || restockParam) {
        stripSearchParam("tab", "batch", "focus", "restock");
      }
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);

  const handleGenerated = (_result: BulkGenerateResult) => {
    setShowGenerate(false);
    setRestockType(undefined);
    // Re-render the Inventory tab so fresh counts and rows appear immediately.
    setInventoryKey((k) => k + 1);
    setTab("inventory");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setTab("inventory")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors",
              tab === "inventory" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <Package className="w-4 h-4" /> Inventory
          </button>
          <button
            onClick={() => setTab("batches")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors",
              tab === "batches" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <Boxes className="w-4 h-4" /> Batches
          </button>
        </div>
        <button
          onClick={() => { setRestockType(undefined); setShowGenerate(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Bulk Generate
        </button>
      </div>

      {tab === "inventory" ? (
        <InventoryTab
          key={inventoryKey}
          initialBatchId={batchFilter}
          initialFocus={focusItem}
        />
      ) : (
        <BatchesTab onViewBatchItems={(id) => { setBatchFilter(id); setTab("inventory"); setInventoryKey((k) => k + 1); }} />
      )}

      {showGenerate && (
        <BulkGenerateModal
          initialType={restockType}
          onClose={() => { setShowGenerate(false); setRestockType(undefined); }}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}
