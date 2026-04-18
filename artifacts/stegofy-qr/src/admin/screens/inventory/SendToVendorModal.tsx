import { useState } from "react";
import { X, Loader2, FileDown } from "lucide-react";
import {
  sendBatchToVendor,
  getBatchById,
  type QRInventoryBatch,
} from "@/services/adminService";
import { downloadBatchStickerPdf } from "@/admin/utils/inventoryPdfGenerator";

interface Props {
  batch: QRInventoryBatch;
  onClose: () => void;
  onDone: () => void;
}

export function SendToVendorModal({ batch, onClose, onDone }: Props) {
  const [vendorName, setVendorName] = useState(batch.vendor_name ?? "");
  const [vendorContact, setVendorContact] = useState(batch.vendor_contact ?? "");
  const [vendorNotes, setVendorNotes] = useState(batch.vendor_notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const handleSubmit = async () => {
    if (!vendorName.trim()) {
      setError("Vendor name is required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // 1. Flip batch + items to sent_to_vendor.
      await sendBatchToVendor({
        batchId: batch.id,
        vendorName: vendorName.trim(),
        vendorContact: vendorContact.trim() || undefined,
        vendorNotes: vendorNotes.trim() || undefined,
      });

      // 2. Pull the items fresh and generate the print-ready PDF.
      const { items } = await getBatchById(batch.id);
      if (items.length > 0) {
        setPdfProgress({ done: 0, total: items.length });
        await downloadBatchStickerPdf(items, batch.batch_number, (done, total) =>
          setPdfProgress({ done, total }),
        );
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send to vendor.");
    } finally {
      setLoading(false);
      setPdfProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Send batch to vendor</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{batch.batch_number} · {batch.total_count} QRs</p>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
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
            <textarea value={vendorNotes} onChange={(e) => setVendorNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
            <FileDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>A PDF with {batch.total_count} stickers (100×70mm, 8 per A4) will download automatically.</span>
          </div>

          {pdfProgress && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <p className="text-xs text-slate-600 mb-1">Generating PDF… {pdfProgress.done} / {pdfProgress.total}</p>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(pdfProgress.done / Math.max(1, pdfProgress.total)) * 100}%` }} />
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Sending…" : "Send & Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
