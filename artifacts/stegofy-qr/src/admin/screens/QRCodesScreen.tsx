import { useEffect, useState } from "react";
import { Search, X, ChevronLeft, ChevronRight, Eye, Trash2, PauseCircle } from "lucide-react";
import { adminGetAllQRCodes, adminDisableQRCode, adminDeleteQRCode, adminGetAllUsers } from "@/services/adminService";

const PAGE_SIZE = 15;

interface QRRow { id: string; user_id: string; name: string; type: string; status: string; display_code: string | null; is_active: boolean | null; created_at: string; [key: string]: unknown; }
interface OwnerRow { id: string; first_name: string | null; last_name: string | null; email: string | null; }

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function JSONModal({ qr, onClose }: { qr: QRRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">{qr.name}</h3>
            <p className="text-xs text-slate-400">{qr.display_code || qr.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          <pre className="text-xs bg-slate-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all font-mono text-slate-700">
            {JSON.stringify(qr, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function QRCodesScreen() {
  const [qrs, setQrs] = useState<QRRow[]>([]);
  const [filtered, setFiltered] = useState<QRRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, OwnerRow>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<QRRow | null>(null);

  const reload = () => {
    Promise.all([adminGetAllQRCodes(), adminGetAllUsers()]).then(([codes, users]) => {
      setQrs(codes as QRRow[]);
      const map: Record<string, OwnerRow> = {};
      (users as OwnerRow[]).forEach((u) => { map[u.id] = u; });
      setUserMap(map);
      setLoading(false);
    });
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered((qrs).filter((r) => {
      if (!q) return true;
      const owner = userMap[r.user_id];
      const ownerStr = [owner?.first_name, owner?.last_name, owner?.email].filter(Boolean).join(" ");
      return [r.name, r.type, r.display_code, r.id, ownerStr].some((v) => (v as string)?.toLowerCase().includes(q));
    }));
    setPage(1);
  }, [search, qrs, userMap]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDisable = async (id: string) => { await adminDisableQRCode(id); reload(); };
  const handleDelete = async (id: string) => { await adminDeleteQRCode(id); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, code, or owner…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} codes</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Owner</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Type</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Code</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No QR codes found</td></tr>
              ) : pageData.map((qr) => {
                const owner = userMap[qr.user_id];
                const ownerName = owner
                  ? [owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.email || qr.user_id.slice(0, 8)
                  : qr.user_id.slice(0, 8);
                const inactive = qr.is_active === false || qr.status === "inactive";
                return (
                  <tr key={qr.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[120px] truncate">{qr.name}</td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[150px]">
                      <p className="text-slate-700 font-medium truncate">{ownerName}</p>
                      {owner?.email && <p className="text-[11px] text-slate-400 truncate">{owner.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize hidden lg:table-cell">{qr.type}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden xl:table-cell">{qr.display_code || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge label={inactive ? "inactive" : qr.status} color={inactive ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(qr)} title="View JSON" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDisable(qr.id)} title="Disable" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"><PauseCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(qr.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-slate-500">Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewing && <JSONModal qr={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
