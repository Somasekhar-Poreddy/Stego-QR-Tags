import { useEffect, useState } from "react";
import { Plus, Search, Download } from "lucide-react";
import { getInventory, bulkGenerateInventory, type QRInventoryItem } from "@/services/adminService";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
type StatusFilter = "all" | "unclaimed" | "claimed" | "activated";

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function statusColor(s: string) {
  if (s === "claimed") return "bg-blue-100 text-blue-700";
  if (s === "activated") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-500";
}

function GenerateModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (count: number, type: string, category: string) => void }) {
  const [count, setCount] = useState(10);
  const [type, setType] = useState("vehicle");
  const [category, setCategory] = useState("car");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Bulk Generate QR Codes</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Count (max 100)</label>
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.min(100, parseInt(e.target.value) || 1))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white transition-colors">
              {["vehicle", "pet", "child", "medical", "luggage", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onGenerate(count, type, category)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">Generate</button>
        </div>
      </div>
    </div>
  );
}

export function InventoryScreen() {
  const [items, setItems] = useState<QRInventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [page, setPage] = useState(1);

  const reload = () => getInventory().then((d) => { setItems(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const filtered = items.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [i.qr_code, i.type, i.category, i.status].some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleGenerate = async (count: number, type: string, category: string) => {
    setShowGenerate(false);
    await bulkGenerateInventory(count, type, category);
    reload();
  };

  const handleExport = () => {
    const csv = ["Code,Type,Category,Status,Created"].concat(
      items.map((i) => `${i.qr_code},${i.type || ""},${i.category || ""},${i.status},${i.created_at?.slice(0, 10) || ""}`)
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "qr-inventory.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unclaimed", label: "Unclaimed" },
    { key: "claimed", label: "Claimed" },
    { key: "activated", label: "Activated" },
  ];

  return (
    <div className="space-y-4">
      {/* Status filter tabs + search + actions */}
      <div className="flex flex-wrap gap-2 items-center">
        {STATUS_TABS.map((t) => {
          const c = t.key === "all" ? items.length : items.filter((i) => i.status === t.key).length;
          return (
            <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }} className={cn("px-3 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5", statusFilter === t.key ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
              {t.label}
              <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full", statusFilter === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{c}</span>
            </button>
          );
        })}
        <div className="flex-1 relative min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search inventory…" className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Bulk Generate
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">QR Code</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Type</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Category</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Created</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageData.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No inventory found</td></tr>
              ) : pageData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{item.qr_code}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize hidden md:table-cell">{item.type || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{item.category || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{item.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3"><Badge label={item.status} color={statusColor(item.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">← Prev</button>
          <span className="text-sm text-slate-500">Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">Next →</button>
        </div>
      )}

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerate={handleGenerate} />}
    </div>
  );
}
