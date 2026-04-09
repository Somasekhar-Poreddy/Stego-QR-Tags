import { useEffect, useState } from "react";
import { Search, CheckCircle, XCircle } from "lucide-react";
import { adminGetAllContactRequests, adminResolveContactRequest, adminRejectContactRequest } from "@/services/adminService";
import { cn } from "@/lib/utils";

type Filter = "all" | "emergency" | "pending" | "resolved";

interface RequestRow { id?: string; qr_id: string; intent: string | null; message: string | null; action_type: string | null; requester_phone: string | null; status: string; created_at?: string; }

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function intentBadgeColor(intent: string | null): string {
  if (intent === "emergency") return "bg-red-100 text-red-600";
  if (intent === "others") return "bg-slate-100 text-slate-600";
  return "bg-blue-100 text-blue-600";
}

function statusBadgeColor(status: string): string {
  if (status === "resolved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-500";
  return "bg-amber-100 text-amber-700";
}

export function ContactRequestsScreen() {
  const [all, setAll] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = () => adminGetAllContactRequests().then((d) => { setAll(d as RequestRow[]); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const filtered = all.filter((r) => {
    if (filter === "emergency" && r.intent !== "emergency") return false;
    if (filter === "pending" && r.status !== "pending") return false;
    if (filter === "resolved" && r.status !== "resolved") return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.intent, r.requester_phone, r.qr_id, r.status].some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const handleResolve = async (id: string) => { await adminResolveContactRequest(id); reload(); };
  const handleReject = async (id: string) => { await adminRejectContactRequest(id); reload(); };

  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "emergency", label: "Emergency 🚨" },
    { key: "pending", label: "Pending" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const c = t.key === "all" ? all.length : all.filter((r) => t.key === "emergency" ? r.intent === "emergency" : r.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)} className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5", filter === t.key ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
              {t.label}
              <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full", filter === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{c}</span>
            </button>
          );
        })}
        <div className="flex-1 relative min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Intent</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Requester Phone</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">QR ID</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No requests found</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id ?? i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge label={r.intent || "unknown"} color={intentBadgeColor(r.intent)} />
                    {r.message && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[140px]">{r.message}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{r.requester_phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden lg:table-cell">{r.qr_id?.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{r.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3"><Badge label={r.status} color={statusBadgeColor(r.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" && r.id && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleResolve(r.id!)} title="Mark resolved" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Resolve
                        </button>
                        <button onClick={() => handleReject(r.id!)} title="Reject" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
