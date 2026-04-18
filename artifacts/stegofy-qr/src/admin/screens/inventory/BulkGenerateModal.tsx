import { useEffect, useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { bulkGenerateInventory, getInventorySettings, type InventoryCategorySetting } from "@/services/adminService";
import { QR_TYPES } from "./inventoryHelpers";

export interface BulkGenerateResult {
  batch_id: string;
  batch_number: string;
  count: number;
  item_ids: string[];
}

interface Props {
  /** Pre-filled type (from ?restock=<type> deep link). */
  initialType?: string;
  onClose: () => void;
  onGenerated: (result: BulkGenerateResult) => void;
}

export function BulkGenerateModal({ initialType, onClose, onGenerated }: Props) {
  const [count, setCount] = useState<number>(100);
  const [type, setType] = useState<string>(initialType ?? "vehicle");
  const [category, setCategory] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorContact, setVendorContact] = useState<string>("");
  const [vendorNotes, setVendorNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<InventoryCategorySetting[]>([]);

  // Pull per-category reorder defaults so ?restock= deep-links get the right count.
  useEffect(() => {
    getInventorySettings()
      .then((s) => {
        setSettings(s);
        if (initialType) {
          const match = s.find((row) => row.category === initialType);
          if (match) setCount(match.reorder_count);
        }
      })
      .catch(() => {});
  }, [initialType]);

  // Whenever the admin picks a different type, snap the count to that type's
  // reorder default (unless they've manually overridden with a non-default).
  useEffect(() => {
    const match = settings.find((row) => row.category === type);
    if (match) setCount((prev) => (prev === 100 || prev <= 0 ? match.reorder_count : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, settings.length]);

  const handleGenerate = async () => {
    setError(null);
    const n = Number(count);
    if (!Number.isFinite(n) || n < 1) {
      setError("Count must be at least 1.");
      return;
    }
    setLoading(true);
    try {
      const result = await bulkGenerateInventory({
        count: n,
        type,
        category: category.trim() || undefined,
        vendor_name: vendorName.trim() || undefined,
        vendor_contact: vendorContact.trim() || undefined,
        vendor_notes: vendorNotes.trim() || undefined,
      });
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate batch.");
    } finally {
      setLoading(false);
    }
  };

  const countNum = Number(count);
  const highCountWarning = Number.isFinite(countNum) && countNum > 500;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Bulk Generate QR Codes</h3>
            <p className="text-xs text-slate-500 mt-0.5">Creates a new batch with printable stickers.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Count</label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
            />
            {highCountWarning && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>Generating more than 500 codes at once is slow and the resulting PDF is heavy. It will still work.</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white transition-colors">
                {QR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Category (optional)</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. car, bike" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          <details className="border border-slate-200 rounded-xl px-3 py-2">
            <summary className="text-xs font-semibold text-slate-600 cursor-pointer select-none">Pre-assign vendor (optional)</summary>
            <div className="pt-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendor name</label>
                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendor contact</label>
                <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} placeholder="Phone or email" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                <textarea value={vendorNotes} onChange={(e) => setVendorNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
              </div>
            </div>
          </details>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleGenerate} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
