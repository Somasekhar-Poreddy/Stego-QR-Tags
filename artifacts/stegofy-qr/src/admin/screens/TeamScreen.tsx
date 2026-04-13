import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Shield, AlertTriangle, Eye, EyeOff } from "lucide-react";
import {
  getAdminUsers, addAdminUser, updateAdminUser, removeAdminUser,
  getPermissionDefinitions,
  type AdminUser, type PermissionDefinition,
} from "@/services/adminService";

const ROLES = [
  { key: "super_admin", label: "Super Admin" },
  { key: "ops_manager", label: "Ops Manager" },
  { key: "support", label: "Support" },
  { key: "marketing", label: "Marketing" },
  { key: "viewer", label: "Viewer" },
];

const FALLBACK_PERMISSIONS: PermissionDefinition[] = [
  { key: "manage_users",       label: "Manage Users",        sort_order: 1 },
  { key: "manage_qr_codes",    label: "Manage QR Codes",     sort_order: 2 },
  { key: "manage_orders",      label: "Manage Orders",       sort_order: 3 },
  { key: "manage_products",    label: "Manage Products",     sort_order: 4 },
  { key: "manage_inventory",   label: "Manage Inventory",    sort_order: 5 },
  { key: "view_analytics",     label: "View Analytics",      sort_order: 6 },
  { key: "manage_team",        label: "Manage Team",         sort_order: 7 },
  { key: "send_notifications", label: "Send Notifications",  sort_order: 8 },
  { key: "manage_support",     label: "Manage Support",      sort_order: 9 },
  { key: "manage_settings",    label: "Manage Settings",     sort_order: 10 },
];

const OPS_MANAGER_KEYS  = ["manage_orders", "manage_products", "manage_inventory", "view_analytics"];
const SUPPORT_KEYS      = ["manage_support", "view_analytics"];
const MARKETING_KEYS    = ["send_notifications", "view_analytics", "manage_products"];

function buildRoleDefaults(perms: PermissionDefinition[]): Record<string, Record<string, boolean>> {
  return {
    super_admin: Object.fromEntries(perms.map((p) => [p.key, true])),
    ops_manager: Object.fromEntries(perms.map((p) => [p.key, OPS_MANAGER_KEYS.includes(p.key)])),
    support:     Object.fromEntries(perms.map((p) => [p.key, SUPPORT_KEYS.includes(p.key)])),
    marketing:   Object.fromEntries(perms.map((p) => [p.key, MARKETING_KEYS.includes(p.key)])),
    viewer:      Object.fromEntries(perms.map((p) => [p.key, false])),
  };
}

interface MemberForm extends Partial<AdminUser> {
  password?: string;
  confirmPassword?: string;
}

function Modal({
  user,
  permissions,
  onClose,
  onSave,
}: {
  user: MemberForm | null;
  permissions: PermissionDefinition[];
  onClose: () => void;
  onSave: (u: MemberForm) => Promise<void>;
}) {
  const isNew = !user?.id;
  const roleDefaults = buildRoleDefaults(permissions);

  const [form, setForm] = useState<MemberForm>(() => {
    const defaultPerms = roleDefaults["viewer"] ?? {};
    return { name: "", email: "", role: "viewer", permissions: { ...defaultPerms }, password: "", confirmPassword: "", ...user };
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (k: keyof MemberForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRoleChange = (role: string) => {
    setForm((f) => ({ ...f, role, permissions: { ...(roleDefaults[role] ?? roleDefaults["viewer"] ?? {}) } }));
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({ ...f, permissions: { ...(f.permissions ?? {}), [key]: !(f.permissions ?? {})[key] } }));
  };

  const handleSave = async () => {
    setError(null);
    if (isNew) {
      if (!form.password) { setError("Password is required"); return; }
      if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
      if (!form.confirmPassword) { setError("Please confirm the password"); return; }
      if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    }
    setSaving(true);
    try { await onSave(form); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{isNew ? "Add Team Member" : "Edit Team Member"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {(["name", "email"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 mb-1 block capitalize">{k}</label>
              <input
                value={(form[k] as string) || ""}
                onChange={(e) => setField(k, e.target.value)}
                type={k === "email" ? "email" : "text"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
          ))}

          {isNew && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password || ""}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={form.confirmPassword || ""}
                    onChange={(e) => setField("confirmPassword", e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Role</label>
            <select
              value={form.role || "viewer"}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white transition-colors"
            >
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block">
              Permissions
              <span className="ml-1.5 text-[10px] font-normal text-slate-400">({permissions.length} available)</span>
            </label>
            {permissions.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-400 text-center">Loading permissions…</div>
            ) : (
              <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                {permissions.map((p) => {
                  const on = (form.permissions ?? {})[p.key] ?? false;
                  return (
                    <div key={p.key} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{p.label}</span>
                      <button
                        onClick={() => togglePerm(p.key)}
                        className={`w-10 h-5 rounded-full relative transition-all flex-shrink-0 ${on ? "bg-primary" : "bg-slate-300"}`}
                      >
                        <span
                          className="w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all"
                          style={{ left: on ? "calc(100% - 18px)" : "2px" }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({
  member,
  onCancel,
  onConfirm,
}: {
  member: AdminUser;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete member");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Delete {member.name || member.email}?</h3>
        </div>
        <p className="text-sm text-slate-600">This will permanently remove their admin access and revoke their login. This action cannot be undone.</p>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</div>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleBadgeColor(role: string) {
  if (role === "super_admin") return "bg-violet-100 text-violet-700";
  if (role === "ops_manager") return "bg-blue-100 text-blue-700";
  if (role === "support") return "bg-green-100 text-green-700";
  if (role === "marketing") return "bg-pink-100 text-pink-700";
  return "bg-slate-100 text-slate-600";
}

function roleLabel(role: string) {
  return ROLES.find((r) => r.key === role)?.label ?? role;
}

export function TeamScreen() {
  const [members, setMembers]           = useState<AdminUser[]>([]);
  const [permissions, setPermissions]   = useState<PermissionDefinition[]>([]);
  const [loading, setLoading]           = useState(true);
  const [editing, setEditing]           = useState<MemberForm | null | false>(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  useEffect(() => {
    Promise.all([
      getAdminUsers(),
      getPermissionDefinitions(),
    ])
      .then(([members, perms]) => {
        setMembers(members);
        setPermissions(perms.length > 0 ? perms : FALLBACK_PERMISSIONS);
      })
      .catch((err: unknown) => {
        // Auth errors auto-redirect via the global AUTH_EXPIRED_EVENT.
        // Log non-auth failures so they're visible in the browser console.
        console.error("[TeamScreen] Failed to load team data:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const reload = () => getAdminUsers().then((d) => setMembers(d));

  const handleSave = async (form: MemberForm) => {
    if (form.id) {
      const { password: _p, confirmPassword: _c, ...updateData } = form;
      await updateAdminUser(form.id, updateData);
    } else {
      const result = await addAdminUser(form);
      if (result.error) throw new Error(result.error);
    }
    setEditing(false);
    reload();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const result = await removeAdminUser(confirmDelete.id);
    if (result.error) throw new Error(result.error);
    setConfirmDelete(null);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} team members</p>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Member</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Role</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Permissions</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm">No team members yet</p>
                  </td>
                </tr>
              ) : members.map((m) => {
                const permCount = Object.values(m.permissions ?? {}).filter(Boolean).length;
                const totalPerms = permissions.length || Object.keys(m.permissions ?? {}).length;
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-primary text-sm">{(m.name || m.email || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{m.name || "—"}</p>
                          <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${roleBadgeColor(m.role)}`}>{roleLabel(m.role)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      <span className="text-xs">{permCount}/{totalPerms} permissions enabled</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{m.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(m)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDelete(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing !== false && (
        <Modal user={editing} permissions={permissions} onClose={() => setEditing(false)} onSave={handleSave} />
      )}
      {confirmDelete && (
        <DeleteConfirm member={confirmDelete} onCancel={() => setConfirmDelete(null)} onConfirm={handleConfirmDelete} />
      )}
    </div>
  );
}
