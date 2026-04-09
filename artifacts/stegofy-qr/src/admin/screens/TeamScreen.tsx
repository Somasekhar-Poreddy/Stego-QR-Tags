import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Shield } from "lucide-react";
import { getAdminUsers, addAdminUser, updateAdminUser, removeAdminUser, type AdminUser } from "@/services/adminService";

const ROLES = ["super_admin", "admin", "support", "viewer"];

function Modal({ user, onClose, onSave }: { user: Partial<AdminUser> | null; onClose: () => void; onSave: (u: Partial<AdminUser>) => void }) {
  const [form, setForm] = useState<Partial<AdminUser>>(user || {});
  const set = (k: keyof AdminUser, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{user?.id ? "Edit Team Member" : "Add Team Member"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {(["name", "email"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 mb-1 block capitalize">{k}</label>
              <input value={(form[k] as string) || ""} onChange={(e) => set(k, e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Role</label>
            <select value={form.role || "viewer"} onChange={(e) => set("role", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white transition-colors">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

function roleBadgeColor(role: string) {
  if (role === "super_admin") return "bg-violet-100 text-violet-700";
  if (role === "admin") return "bg-blue-100 text-blue-700";
  if (role === "support") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-600";
}

export function TeamScreen() {
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AdminUser> | null | false>(false);

  const reload = () => getAdminUsers().then((d) => { setMembers(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const handleSave = async (form: Partial<AdminUser>) => {
    if (form.id) await updateAdminUser(form.id, form);
    else await addAdminUser(form);
    setEditing(false);
    reload();
  };

  const handleRemove = async (id: string) => { await removeAdminUser(id); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} team members</p>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p>No team members yet</p>
            </div>
          ) : members.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{(m.name || m.email || "?")[0].toUpperCase()}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(m)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleRemove(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="font-bold text-slate-900 text-sm">{m.name || "—"}</p>
              <p className="text-xs text-slate-400 mb-3">{m.email}</p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${roleBadgeColor(m.role)}`}>{m.role.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}

      {editing !== false && <Modal user={editing} onClose={() => setEditing(false)} onSave={handleSave} />}
    </div>
  );
}
