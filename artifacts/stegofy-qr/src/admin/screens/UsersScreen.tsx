import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, X, User, QrCode, MessageSquare, Trash2, ShieldOff, ShieldCheck } from "lucide-react";
import {
  adminGetAllUsers, adminBlockUser, adminUnblockUser, adminDeleteUser,
  adminGetUserQRCodes, adminGetContactRequestsByQR,
} from "@/services/adminService";

const PAGE_SIZE = 15;

interface UserRow { id: string; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null; age_group: string | null; gender: string | null; created_at?: string; status?: string | null; }
interface QRRow { id: string; name: string; type: string; status: string; display_code: string | null; }
interface RequestRow { id?: string; intent: string | null; status: string; created_at?: string; }

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function DetailPanel({ user, onRefresh, onClose }: { user: UserRow; onRefresh: () => void; onClose: () => void }) {
  const [qrs, setQrs] = useState<QRRow[]>([]);
  const [reqs, setReqs] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const userQrs = (await adminGetUserQRCodes(user.id)) as QRRow[];
      setQrs(userQrs);
      const allReqs: RequestRow[] = [];
      for (const qr of userQrs.slice(0, 5)) {
        const r = (await adminGetContactRequestsByQR(qr.id)) as RequestRow[];
        allReqs.push(...r);
      }
      setReqs(allReqs.sort((a, b) => ((b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1)).slice(0, 10));
      setLoading(false);
    }
    load();
  }, [user.id]);

  const isBlocked = user.status === "blocked";

  const handleBlock = async () => { await adminBlockUser(user.id); onRefresh(); onClose(); };
  const handleUnblock = async () => { await adminUnblockUser(user.id); onRefresh(); onClose(); };
  const handleDelete = async () => { await adminDeleteUser(user.id); onRefresh(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900">User Detail</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}</p>
                <p className="text-xs text-slate-500">{user.email || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">Mobile</span><p className="font-semibold text-slate-700">{user.mobile || "—"}</p></div>
              <div><span className="text-slate-400">Status</span>
                <p className={`font-semibold capitalize ${isBlocked ? "text-red-600" : "text-green-600"}`}>{user.status || "active"}</p>
              </div>
              <div><span className="text-slate-400">Joined</span><p className="font-semibold text-slate-700">{user.created_at?.slice(0, 10) || "—"}</p></div>
              <div><span className="text-slate-400">Age Group</span><p className="font-semibold text-slate-700">{user.age_group || "—"}</p></div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">QR Codes ({qrs.length})</p>
            </div>
            {qrs.length === 0 ? <p className="text-xs text-slate-400">No QR codes</p> : (
              <div className="space-y-2">
                {qrs.slice(0, 5).map((qr) => (
                  <div key={qr.id} className="bg-slate-50 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{qr.name}</p>
                      <p className="text-[11px] text-slate-400">{qr.type} · {qr.display_code || qr.id.slice(0, 8)}</p>
                    </div>
                    <Badge label={qr.status} color={qr.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">Contact History ({reqs.length})</p>
            </div>
            {loading ? <p className="text-xs text-slate-400">Loading…</p> : reqs.length === 0 ? (
              <p className="text-xs text-slate-400">No contact requests</p>
            ) : (
              <div className="space-y-2">
                {reqs.map((r, i) => (
                  <div key={r.id ?? i} className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800 capitalize">{r.intent || "—"}</p>
                    <p className="text-[11px] text-slate-400">{r.created_at?.slice(0, 10)} · {r.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3">
          {isBlocked ? (
            <button onClick={handleUnblock} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-green-200 text-green-700 hover:bg-green-50 text-sm font-semibold transition-colors">
              <ShieldCheck className="w-4 h-4" /> Unblock
            </button>
          ) : (
            <button onClick={handleBlock} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-semibold transition-colors">
              <ShieldOff className="w-4 h-4" /> Block
            </button>
          )}
          <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-sm font-semibold transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const reload = () => adminGetAllUsers().then((u) => { setUsers(u as UserRow[]); setLoading(false); });
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered((users as UserRow[]).filter((u) =>
      !q || [u.first_name, u.last_name, u.email, u.mobile].some((v) => v?.toLowerCase().includes(q))
    ));
    setPage(1);
  }, [search, users]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} users</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Mobile</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Joined</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageData.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No users found</td></tr>
              ) : pageData.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{u.mobile || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{u.created_at?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge label={u.status || "active"} color={u.status === "blocked" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"} />
                  </td>
                </tr>
              ))}
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

      {selected && <DetailPanel user={selected} onRefresh={reload} onClose={() => setSelected(null)} />}
    </div>
  );
}
