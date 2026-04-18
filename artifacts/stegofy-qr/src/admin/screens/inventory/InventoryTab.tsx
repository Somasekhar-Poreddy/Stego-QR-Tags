import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Download, Trash2, Tag, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  getInventoryPaginated,
  getInventoryCounts,
  getBatches,
  bulkDeleteInventory,
  type InventoryStatus,
  type QRInventoryItem,
  type QRInventoryBatch,
} from "@/services/adminService";
import { downloadBatchStickerPdf } from "@/admin/utils/inventoryPdfGenerator";
import { QR_TYPES, STATUS_LABELS, statusBadge, formatDate } from "./inventoryHelpers";
import { BulkStatusModal } from "./BulkStatusModal";
import { InventoryDetailSlideOver } from "./InventoryDetailSlideOver";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

interface Props {
  initialBatchId?: string;
  initialFocus?: string;
}

type StatusKey = InventoryStatus | "all";

const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "unassigned",     label: "Unassigned" },
  { key: "sent_to_vendor", label: "Sent to Vendor" },
  { key: "in_stock",       label: "In Stock" },
  { key: "assigned",       label: "Assigned" },
];

export function InventoryTab({ initialBatchId, initialFocus }: Props) {
  const [items, setItems] = useState<QRInventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    all: 0, unassigned: 0, sent_to_vendor: 0, in_stock: 0, assigned: 0,
  });
  const [batches, setBatches] = useState<QRInventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<StatusKey>("all");
  const [type, setType] = useState<string>("all");
  const [batchId, setBatchId] = useState<string>(initialBatchId ?? "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [bulkPdfProgress, setBulkPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(initialFocus ?? null);
  const [error, setError] = useState<string | null>(null);

  // Sequential loads to avoid Supabase auth-lock contention. Each call
  // shares the deduplicated ensureFreshSession, but running them back-to-
  // back instead of in parallel avoids multiple getSession() races.
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const paged = await getInventoryPaginated({ status, type, batchId, search, page, pageSize: PAGE_SIZE });
      setItems(paged.items);
      setTotal(paged.total);
      const cnts = await getInventoryCounts();
      setCounts(cnts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [status, type, batchId, search, page]);

  useEffect(() => { reload(); }, [reload]);

  // Load batch list for the filter dropdown (after the main data settles).
  useEffect(() => {
    const t = setTimeout(() => {
      getBatches({ pageSize: 100 }).then(({ batches }) => setBatches(batches)).catch(() => {});
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelectedOnPage = items.length > 0 && items.every((i) => selected.has(i.id));
  const anySelected = selected.size > 0;

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) items.forEach((i) => next.delete(i.id));
      else items.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (!anySelected) return;
    if (!confirm(`Delete ${selected.size} selected item(s)? This cannot be undone.`)) return;
    try {
      await bulkDeleteInventory(Array.from(selected));
      clearSelection();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const handleBulkDownload = async () => {
    if (!anySelected) return;
    const picked = items.filter((i) => selected.has(i.id));
    if (picked.length === 0) {
      setError("Selected items are on other pages — load them first or use the batch download.");
      return;
    }
    setBulkPdfProgress({ done: 0, total: picked.length });
    try {
      await downloadBatchStickerPdf(picked, "selection", (done, total) => setBulkPdfProgress({ done, total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed.");
    } finally {
      setBulkPdfProgress(null);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ["QR Code", "Display Code", "PIN", "Type", "Category", "Status", "Batch", "Vendor", "Created"],
      ...items.map((i) => [
        i.qr_code, i.display_code ?? "", i.pin_code ?? "", i.type ?? "", i.category ?? "",
        i.status, i.batch_id ?? "", i.vendor_name ?? "", i.created_at?.slice(0, 10) ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "qr-inventory.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const batchLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    batches.forEach((b) => m.set(b.id, b.batch_number));
    return m;
  }, [batches]);

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1); clearSelection(); }}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
              status === t.key ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            {t.label}
            <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full", status === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search qr / display code / url…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary"
          />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary">
          <option value="all">All types</option>
          {QR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary max-w-[200px]">
          <option value="all">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
        </select>
        <button onClick={handleExportCsv} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Bulk actions */}
      {anySelected && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-primary">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button onClick={() => setShowBulkStatus(true)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
              <Tag className="w-4 h-4" /> Change status
            </button>
            <button onClick={handleBulkDownload} disabled={!!bulkPdfProgress} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
              {bulkPdfProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {bulkPdfProgress ? `PDF ${bulkPdfProgress.done}/${bulkPdfProgress.total}` : "Download PDF"}
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700">Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
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
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={allSelectedOnPage} onChange={toggleAllOnPage} className="accent-primary" />
                  </th>
                  <th className="px-3 py-3 text-left">QR Code</th>
                  <th className="px-3 py-3 text-left">Display</th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">Type</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Batch</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left hidden xl:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No inventory matches these filters.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetailId(item.id)}>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} className="accent-primary" />
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-700 truncate max-w-[180px]">{item.qr_code}</td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">{item.display_code ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-500 capitalize hidden md:table-cell">{item.type ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-500 hidden lg:table-cell font-mono text-xs">
                      {item.batch_id ? batchLabelMap.get(item.batch_id) ?? "—" : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", statusBadge(item.status))}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-400 hidden xl:table-cell">{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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

      {showBulkStatus && (
        <BulkStatusModal
          ids={Array.from(selected)}
          onClose={() => setShowBulkStatus(false)}
          onDone={() => { setShowBulkStatus(false); clearSelection(); reload(); }}
        />
      )}

      {detailId && (
        <InventoryDetailSlideOver
          itemId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
