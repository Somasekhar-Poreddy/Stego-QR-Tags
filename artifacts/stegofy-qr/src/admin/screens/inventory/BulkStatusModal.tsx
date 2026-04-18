import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { bulkUpdateStatus, type InventoryStatus } from "@/services/adminService";
import { STATUS_LABELS } from "./inventoryHelpers";

interface Props {
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}

// Which statuses the admin can manually jump to. `assigned` is excluded because
// that transition only happens through the end-user claim flow — moving items
// there manually would leave `linked_qr_id` / `linked_user_id` null and break
// the public profile lookup.
const TARGETABLE: InventoryStatus[] = ["unassigned", "sent_to_vendor", "in_stock"];

export function BulkStatusModal({ ids, onClose, onDone }: Props) {
  const [status, setStatus] = useState<InventoryStatus>("in_stock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await bulkUpdateStatus(ids, status);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Change status</h3>
          <button onClick={onClose} disabled={loading} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Move {ids.length} selected {ids.length === 1 ? "item" : "items"} to:
          </p>

          <div className="space-y-2">
            {TARGETABLE.map((s) => (
              <label key={s} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="accent-primary"
                />
                <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[s]}</span>
              </label>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            Items already in the selected status are left untouched. Assigned items cannot be reverted here.
          </p>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Updating…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
