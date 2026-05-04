import { useCallback, useEffect, useState } from "react";
import {
  Eye, Send, PackageCheck, Download, Trash2, Loader2, ChevronLeft, ChevronRight, Settings,
} from "lucide-react";
import {
  getBatches,
  getBatchById,
  markBatchReceived,
  deleteBatch,
  type BatchStatus,
  type QRInventoryBatch,
} from "@/services/adminService";
import { downloadBatchStickers, type PrintSettings } from "@/admin/utils/inventoryPdfGenerator";
import { PrintSettingsModal } from "@/admin/components/PrintSettingsModal";
import { BATCH_STATUS_LABELS, batchStatusBadge, formatDate } from "./inventoryHelpers";
import { SendToVendorModal } from "./SendToVendorModal";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

interface Props {
  onViewBatchItems: (batchId: string) => void;
}

type StatusKey = BatchStatus | "all";

const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "created",        label: "Created" },
  { key: "sent_to_vendor", label: "Sent to Vendor" },
  { key: "received",       label: "Received" },
  { key: "fully_assigned", label: "Fully Assigned" },
];

export function BatchesTab({ onViewBatchItems }: Props) {
  const [batches, setBatches] = useState<QRInventoryBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<StatusKey>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // batch id currently being acted on
  const [sendTarget, setSendTarget] = useState<QRInventoryBatch | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [printTarget, setPrintTarget] = useState<QRInventoryBatch | null>(null);
  const [printItems, setPrintItems] = useState<Awaited<ReturnType<typeof getBatchById>>["items"]>([]);
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { batches, total } = await getBatches({ status, page, pageSize: PAGE_SIZE });
      setBatches(batches);
      setTotal(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load batches.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { reload(); }, [reload]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleMarkReceived = async (batch: QRInventoryBatch) => {
    if (!confirm(`Mark batch ${batch.batch_number} as received? This flips all items to In Stock.`)) return;
    setBusy(batch.id);
    setError(null);
    try {
      await markBatchReceived(batch.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark-received failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async (batch: QRInventoryBatch) => {
    setBusy(batch.id);
    setError(null);
    try {
      const { items } = await getBatchById(batch.id);
      if (items.length === 0) {
        setError("Batch has no items.");
        return;
      }
      setPrintItems(items);
      setPrintTarget(batch);
      setShowPrintSettings(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load batch items.");
    } finally {
      setBusy(null);
    }
  };

  const handlePrintConfirm = async (settings: PrintSettings) => {
    if (!printTarget) return;
    setShowPrintSettings(false);
    setBusy(printTarget.id);
    try {
      await downloadBatchStickers(printItems, settings, printTarget.batch_number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
      setPrintTarget(null);
      setPrintItems([]);
    }
  };

  const handleDelete = async (batch: QRInventoryBatch) => {
    if (!confirm(`Delete batch ${batch.batch_number}? All unassigned items in it will also be deleted.`)) return;
    setBusy(batch.id);
    setError(null);
    try {
      await deleteBatch(batch.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-semibold transition-all",
              status === t.key ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setShowSettings(true)}
          className="ml-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> Low-stock settings
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 text-left">Batch</th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">Type / Category</th>
                  <th className="px-3 py-3 text-left">QRs</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Vendor</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left hidden xl:table-cell">Created</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {batches.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No batches yet.</td></tr>
                ) : batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">{b.batch_number}</td>
                    <td className="px-3 py-3 text-slate-500 hidden md:table-cell">
                      <span className="capitalize">{b.type ?? "—"}</span>
                      {b.category && <span className="text-slate-400"> / {b.category}</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-semibold">{b.total_count}</td>
                    <td className="px-3 py-3 text-slate-500 hidden lg:table-cell truncate max-w-[160px]">{b.vendor_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", batchStatusBadge(b.status))}>
                        {BATCH_STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-400 hidden xl:table-cell">{formatDate(b.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button
                          title="View items"
                          onClick={() => onViewBatchItems(b.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {b.status === "created" && (
                          <button
                            title="Send to vendor"
                            onClick={() => setSendTarget(b)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {b.status === "sent_to_vendor" && (
                          <button
                            title="Mark received"
                            disabled={busy === b.id}
                            onClick={() => handleMarkReceived(b)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                          >
                            {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          title="Download stickers PDF"
                          disabled={busy === b.id}
                          onClick={() => handleDownloadPdf(b)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                        >
                          {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          title="Delete batch"
                          disabled={busy === b.id || b.status === "fully_assigned"}
                          onClick={() => handleDelete(b)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{total} total · Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}

      {sendTarget && (
        <SendToVendorModal
          batch={sendTarget}
          onClose={() => setSendTarget(null)}
          onDone={() => { setSendTarget(null); reload(); }}
        />
      )}

      {showSettings && <CategorySettingsModal onClose={() => setShowSettings(false)} />}

      <PrintSettingsModal
        open={showPrintSettings}
        onClose={() => { setShowPrintSettings(false); setPrintTarget(null); setPrintItems([]); }}
        onConfirm={handlePrintConfirm}
        stickerCount={printItems.length}
        loading={!!busy}
      />
    </div>
  );
}
