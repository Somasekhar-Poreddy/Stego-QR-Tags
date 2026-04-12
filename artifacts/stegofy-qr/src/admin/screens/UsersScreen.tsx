import { useEffect, useState, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, X, User, QrCode, MessageSquare,
  Trash2, ShieldOff, ShieldCheck, Copy, Check, ChevronDown, ChevronUp,
  Phone, MapPin, Globe, Calendar, Instagram, Twitter, Facebook,
  Save, Edit3, RefreshCw, Filter, Home, Activity,
} from "lucide-react";
import {
  adminGetAllUsers, adminBlockUser, adminUnblockUser, adminDeleteUser,
  adminGetUserQRCodes, adminUpdateUserProfile, adminGetAllContactRequestsForUser,
  adminGetQRCountsByUser, adminDisableQRCode, adminEnableQRCode, adminDeleteQRCode,
} from "@/services/adminService";

/* ─────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────── */
interface Address {
  id?: string; label?: string; line1?: string; line2?: string;
  city?: string; state?: string; pincode?: string; is_default?: boolean;
}
interface SocialLinks { instagram?: string; facebook?: string; twitter?: string; }

interface UserRow {
  id: string; sgy_id?: string | null; first_name: string | null; last_name: string | null;
  email: string | null; mobile: string | null; age_group: string | null; gender: string | null;
  created_at?: string; status?: string | null; addresses?: Address[]; social_links?: SocialLinks;
}
interface QRRow {
  id: string; name: string; type: string; status: string; display_code: string | null;
  created_at?: string; scan_count?: number | null; scans?: number | null; is_active?: boolean;
}
interface ContactRow {
  id?: string; qr_id: string; intent: string | null; message: string | null;
  action_type: string | null; requester_phone: string | null; ip_address?: string | null;
  location?: string | null; latitude?: number | null; longitude?: number | null;
  scanner_name?: string | null; status: string; created_at?: string; qr_name?: string;
}

const PAGE_SIZE = 15;

/* ─────────────────────────────────────────────────
   UTILS
   ───────────────────────────────────────────────── */
function formatRelativeTime(iso?: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getTypeEmoji(type: string) {
  const map: Record<string, string> = {
    vehicle: "🚗", pet: "🐾", child: "👶", elder: "🧓", medical: "💊",
    home: "🏠", travel: "✈️", business: "💼", personal: "👤",
  };
  return map[type] ?? "🔖";
}

function getIntentLabel(intent: string | null) {
  if (!intent) return "Unknown";
  const map: Record<string, string> = {
    emergency: "Emergency", lights_on: "Lights are on", keys_inside: "Keys locked inside",
    blocking: "Blocking the way", accident: "Accident / Needs help", lost_pet: "Lost pet",
    lost_child: "Lost child", medical: "Medical emergency", others: "Other / Custom",
    contact: "Contact request",
  };
  return map[intent] ?? intent.replace(/_/g, " ");
}

function getIntentColor(intent: string | null) {
  if (intent === "emergency" || intent === "accident" || intent === "medical") return "bg-red-100 text-red-700";
  if (intent === "lost_pet" || intent === "lost_child") return "bg-orange-100 text-orange-700";
  return "bg-blue-100 text-blue-700";
}

function getStatusColor(status: string) {
  if (status === "resolved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-600";
  return "bg-amber-100 text-amber-700";
}

function initials(u: UserRow) {
  const parts = [u.first_name, u.last_name].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "??";
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${color}`}>{label}</span>;
}

function CopyBtn({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={handle} className={`p-1 rounded-lg hover:bg-slate-100 transition-colors ${className}`} title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   PROFILE TAB
   ───────────────────────────────────────────────── */
function ProfileTab({ user, onRefresh, onUserUpdated }: {
  user: UserRow; onRefresh: () => void;
  onUserUpdated: (updates: Partial<UserRow>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    mobile: user.mobile ?? "",
    age_group: user.age_group ?? "",
    gender: user.gender ?? "",
    status: user.status ?? "active",
  });
  const [expandAddresses, setExpandAddresses] = useState(false);

  const textField = (key: keyof typeof form, label: string, prefix?: string) => (
    <div key={key}>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      {editing ? (
        <div className="flex items-center mt-1">
          {prefix && <span className="text-sm text-slate-500 mr-1 font-semibold">{prefix}</span>}
          <input
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none transition-colors"
          />
        </div>
      ) : (
        <p className="mt-0.5 text-sm font-semibold text-slate-800">
          {prefix && form[key] ? `${prefix}${form[key]}` : form[key] || "—"}
        </p>
      )}
    </div>
  );

  const selectField = (key: keyof typeof form, label: string, opts: string[]) => (
    <div key={key}>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      {editing ? (
        <select
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none transition-colors bg-white"
        >
          <option value="">— Select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <p className="mt-0.5 text-sm font-semibold text-slate-800 capitalize">{form[key] || "—"}</p>
      )}
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await adminUpdateUserProfile(user.id, {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      mobile: form.mobile || null,
      age_group: form.age_group || null,
      gender: form.gender || null,
      status: form.status || "active",
    });
    setSaving(false);
    if (error) {
      setSaveMsg({ ok: false, text: "Failed to save. Please try again." });
    } else {
      const updatedFields: Partial<UserRow> = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        mobile: form.mobile || null,
        age_group: form.age_group || null,
        gender: form.gender || null,
        status: form.status || "active",
      };
      setSaveMsg({ ok: true, text: "Changes saved successfully!" });
      setEditing(false);
      onUserUpdated(updatedFields);
      onRefresh();
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const addresses: Address[] = Array.isArray(user.addresses) ? user.addresses : [];
  const social: SocialLinks = user.social_links ?? {};

  return (
    <div className="p-5 space-y-5">
      {/* Personal Information */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-700">Personal Information</h4>
          <button
            onClick={() => { setEditing((e) => !e); setSaveMsg(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${editing ? "bg-slate-200 text-slate-700" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {textField("first_name", "First Name")}
          {textField("last_name", "Last Name")}
          {textField("mobile", "Mobile", "+91 ")}
          {selectField("age_group", "Age Group", ["18-25", "26-35", "36-45", "46-55", "56-65", "65+"])}
          {selectField("gender", "Gender", ["Male", "Female", "Other", "Prefer not to say"])}
          {selectField("status", "Status", ["active", "blocked"])}
        </div>
        {editing && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        )}
        {saveMsg && (
          <p className={`mt-3 text-xs font-semibold ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>{saveMsg.text}</p>
        )}
      </div>

      {/* Account Information */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-4">Account Information</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Email</label>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{user.email || "—"}</p>
            </div>
            {user.email && <CopyBtn text={user.email} />}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">SGY ID</label>
              <p className="mt-0.5 text-sm font-black text-primary font-mono tracking-wide">{user.sgy_id || "—"}</p>
            </div>
            {user.sgy_id && <CopyBtn text={user.sgy_id} />}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">User ID</label>
              <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">{user.id}</p>
            </div>
            <CopyBtn text={user.id} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Joined</label>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Addresses */}
      {addresses.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4">
          <button onClick={() => setExpandAddresses((e) => !e)} className="flex items-center justify-between w-full">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Home className="w-4 h-4 text-slate-400" /> Addresses ({addresses.length})
            </h4>
            {expandAddresses ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {expandAddresses && (
            <div className="mt-3 space-y-2">
              {addresses.map((addr, i) => (
                <div key={addr.id ?? i} className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-600 capitalize">{addr.label || "Address"}</span>
                    {addr.is_default && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-xs text-slate-600">{[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Social Links */}
      {(social.instagram || social.facebook || social.twitter) && (
        <div className="bg-slate-50 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Social Links</h4>
          <div className="space-y-2">
            {social.instagram && (
              <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-pink-600 transition-colors">
                <Instagram className="w-4 h-4 text-pink-500" /> @{social.instagram}
              </a>
            )}
            {social.facebook && (
              <a href={`https://facebook.com/${social.facebook}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors">
                <Facebook className="w-4 h-4 text-blue-600" /> {social.facebook}
              </a>
            )}
            {social.twitter && (
              <a href={`https://twitter.com/${social.twitter}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-sky-500 transition-colors">
                <Twitter className="w-4 h-4 text-sky-500" /> @{social.twitter}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   QR CARD (expandable with activity timeline)
   ───────────────────────────────────────────────── */
function QRCard({ qr, contacts, onToggle, onDelete }: {
  qr: QRRow; contacts: ContactRow[];
  onToggle: (id: string, currentStatus: string) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const scanCount = qr.scan_count ?? qr.scans ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5 leading-none">{getTypeEmoji(qr.type)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-800 truncate">{qr.name || "Unnamed QR"}</p>
              <Badge label={qr.status} color={qr.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"} />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-slate-400 capitalize">{qr.type}</span>
              {qr.display_code && <span className="text-[11px] text-slate-400 font-mono">{qr.display_code}</span>}
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                {scanCount} scan{scanCount !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
              </span>
            </div>
            {qr.created_at && <p className="text-[10px] text-slate-400 mt-0.5">Created {formatRelativeTime(qr.created_at)}</p>}
          </div>
          <div className="shrink-0">{expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Contact Activity</p>
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contact activity yet</p>
            ) : (
              <div className="space-y-4">
                {contacts.map((c, i) => (
                  <div key={c.id ?? i} className="relative pl-4 border-l-2 border-slate-100">
                    <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getIntentColor(c.intent)}`}>
                        {getIntentLabel(c.intent)}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    {c.message && (
                      <div className="bg-slate-50 rounded-xl px-3 py-2 mb-2 border-l-2 border-primary/30">
                        <p className="text-xs text-slate-600 italic">"{c.message}"</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {c.requester_phone && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" /> {c.requester_phone}
                        </span>
                      )}
                      {c.ip_address && (
                        <span className="flex items-center gap-1 text-slate-500 font-mono">
                          <Globe className="w-3 h-3 text-slate-400 shrink-0" /> {c.ip_address}
                        </span>
                      )}
                      {c.location && (
                        <span className="flex items-center gap-1 text-slate-600 col-span-2">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> <span className="font-semibold">{c.location}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1" title={c.created_at}>{formatRelativeTime(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 pb-3 flex items-center gap-2 border-t border-slate-50 pt-3">
            <button onClick={() => onToggle(qr.id, qr.status)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${qr.status === "active" ? "border border-amber-200 text-amber-700 hover:bg-amber-50" : "border border-green-200 text-green-700 hover:bg-green-50"}`}>
              {qr.status === "active" ? <><ShieldOff className="w-3.5 h-3.5" /> Disable</> : <><ShieldCheck className="w-3.5 h-3.5" /> Enable</>}
            </button>
            <button onClick={() => onDelete(qr.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   QR CODES TAB
   ───────────────────────────────────────────────── */
function QRCodesTab({ qrs, contacts, onRefreshQrs }: {
  qrs: QRRow[]; contacts: ContactRow[]; onRefreshQrs: () => void;
}) {
  const totalScans = qrs.reduce((sum, q) => sum + (q.scan_count ?? q.scans ?? 0), 0);
  const contactsByQr: Record<string, ContactRow[]> = {};
  contacts.forEach((c) => {
    if (!contactsByQr[c.qr_id]) contactsByQr[c.qr_id] = [];
    contactsByQr[c.qr_id].push(c);
  });

  const handleToggle = async (qrId: string, currentStatus: string) => {
    if (currentStatus === "active") {
      await adminDisableQRCode(qrId);
    } else {
      await adminEnableQRCode(qrId);
    }
    onRefreshQrs();
  };
  const handleDelete = async (qrId: string) => {
    if (!confirm("Delete this QR code? This cannot be undone.")) return;
    await adminDeleteQRCode(qrId); onRefreshQrs();
  };

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "QR Codes", value: qrs.length, icon: QrCode, color: "text-indigo-600 bg-indigo-50" },
          { label: "Total Scans", value: totalScans, icon: Activity, color: "text-blue-600 bg-blue-50" },
          { label: "Contact Reqs", value: contacts.length, icon: MessageSquare, color: "text-amber-600 bg-amber-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-50 rounded-2xl p-3 text-center">
            <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mx-auto mb-1.5`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      {qrs.length === 0 ? (
        <div className="text-center py-10">
          <QrCode className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No QR codes created yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {qrs.map((qr) => (
            <QRCard key={qr.id} qr={qr} contacts={contactsByQr[qr.id] ?? []}
              onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   ACTIVITY TAB
   ───────────────────────────────────────────────── */
type FilterType = "all" | "pending" | "resolved" | "emergency";

function ActivityTab({ contacts }: { contacts: ContactRow[] }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = contacts.filter((c) => {
    if (filter === "pending") return c.status === "pending";
    if (filter === "resolved") return c.status === "resolved";
    if (filter === "emergency") return c.intent === "emergency";
    return true;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "resolved", label: "Resolved" },
    { key: "emergency", label: "Emergency" },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        {filters.map(({ key, label }) => {
          const count = key === "all" ? contacts.length
            : key === "emergency" ? contacts.filter((c) => c.intent === "emergency").length
            : contacts.filter((c) => c.status === key).length;
          return (
            <button key={key} onClick={() => { setFilter(key); setPage(1); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${filter === key ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {pageData.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No activity found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageData.map((c, i) => (
            <div key={c.id ?? i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.qr_name && (
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                      <QrCode className="w-3 h-3" /> {c.qr_name}
                    </span>
                  )}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getIntentColor(c.intent)}`}>
                    {getIntentLabel(c.intent)}
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${getStatusColor(c.status)}`}>
                  {c.status}
                </span>
              </div>
              {c.message && (
                <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3 border-l-2 border-primary/30">
                  <p className="text-xs text-slate-600 italic">"{c.message}"</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {c.requester_phone && (
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" /> <span className="font-semibold">{c.requester_phone}</span>
                  </span>
                )}
                {c.ip_address && (
                  <span className="flex items-center gap-1.5 text-slate-500 font-mono">
                    <Globe className="w-3 h-3 text-slate-400 shrink-0" /> {c.ip_address}
                  </span>
                )}
                {c.location && (
                  <span className="flex items-center gap-1.5 text-slate-600 col-span-2">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> <span className="font-semibold">{c.location}</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2" title={c.created_at}>{formatRelativeTime(c.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-slate-500">Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   USER DETAIL MODAL — true full-page overlay
   ───────────────────────────────────────────────── */
type TabKey = "profile" | "qrcodes" | "activity";

function UserDetailModal({ user, onRefresh, onClose }: {
  user: UserRow; onRefresh: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const [qrs, setQrs] = useState<QRRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [localUser, setLocalUser] = useState<UserRow>(user);

  const handleUserUpdated = useCallback((updates: Partial<UserRow>) => {
    setLocalUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const loadUserData = useCallback(async () => {
    setLoadingData(true);
    const [userQrs, allContacts] = await Promise.all([
      adminGetUserQRCodes(user.id) as Promise<QRRow[]>,
      adminGetAllContactRequestsForUser(user.id) as Promise<ContactRow[]>,
    ]);
    setQrs(userQrs);
    setContacts(allContacts);
    setLoadingData(false);
  }, [user.id]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const isBlocked = localUser.status === "blocked";
  const fullName = [localUser.first_name, localUser.last_name].filter(Boolean).join(" ") || "Unknown User";
  const avatarLetters = initials(localUser);

  const handleBlock = async () => {
    setActionLoading(true);
    await adminBlockUser(user.id);
    setActionLoading(false);
    onRefresh();
    onClose();
  };
  const handleUnblock = async () => {
    setActionLoading(true);
    await adminUnblockUser(user.id);
    setActionLoading(false);
    onRefresh();
    onClose();
  };
  const handleDelete = async () => {
    if (!confirm(`Delete user "${fullName}"? This cannot be undone.`)) return;
    setActionLoading(true);
    await adminDeleteUser(user.id);
    setActionLoading(false);
    onRefresh();
    onClose();
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { key: "qrcodes", label: "QR Codes", icon: <QrCode className="w-4 h-4" />, badge: qrs.length },
    { key: "activity", label: "Activity", icon: <Activity className="w-4 h-4" />, badge: contacts.length },
  ];

  return (
    /* True full-screen overlay — covers the entire viewport */
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/5 to-violet-50 border-b border-slate-100 px-5 py-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-lg">{avatarLetters}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900">{fullName}</h2>
                <Badge label={localUser.status || "active"} color={isBlocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{localUser.email || "No email"}</p>
              {localUser.sgy_id && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs font-black text-primary bg-primary/10 border border-primary/20 rounded-lg px-2 py-0.5 font-mono tracking-wide">{localUser.sgy_id}</span>
                  <CopyBtn text={localUser.sgy_id} />
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {isBlocked ? (
              <button onClick={handleUnblock} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-green-200 text-green-700 hover:bg-green-50 text-xs font-semibold transition-colors disabled:opacity-50">
                <ShieldCheck className="w-3.5 h-3.5" /> Unblock User
              </button>
            ) : (
              <button onClick={handleBlock} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold transition-colors disabled:opacity-50">
                <ShieldOff className="w-3.5 h-3.5" /> Block User
              </button>
            )}
            <button onClick={handleDelete} disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-xs font-semibold transition-colors disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete User
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-100 bg-white shrink-0">
        <div className="max-w-4xl mx-auto w-full flex">
          {tabs.map(({ key, label, icon, badge }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors relative ${tab === key ? "text-primary border-b-2 border-primary -mb-px" : "text-slate-500 hover:text-slate-700"}`}>
              {icon} {label}
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === key ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {loadingData ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Loading user data…</span>
            </div>
          ) : (
            <>
              {tab === "profile" && <ProfileTab user={localUser} onRefresh={onRefresh} onUserUpdated={handleUserUpdated} />}
              {tab === "qrcodes" && <QRCodesTab qrs={qrs} contacts={contacts} onRefreshQrs={loadUserData} />}
              {tab === "activity" && <ActivityTab contacts={contacts} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   USERS SCREEN (main export)
   ───────────────────────────────────────────────── */
export function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [qrCounts, setQrCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await adminGetAllUsers()) as UserRow[];
      setUsers(u);
      if (u.length > 0) {
        const counts = await adminGetQRCountsByUser(u.map((x) => x.id));
        setQrCounts(counts);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered((users as UserRow[]).filter((u) =>
      !q || [u.first_name, u.last_name, u.email, u.mobile, u.sgy_id].some((v) => v?.toLowerCase().includes(q))
    ));
    setPage(1);
  }, [search, users]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, mobile, SGY ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
          <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} users</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading users…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">SGY ID</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Mobile</th>
                  <th className="px-4 py-3 text-center hidden xl:table-cell">QR Codes</th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Joined</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      No users found
                    </td>
                  </tr>
                ) : pageData.map((u) => (
                  <tr key={u.id} onClick={() => setSelected(u)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/70 to-violet-500/70 flex items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-black">{initials(u)}</span>
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-primary transition-colors">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {u.sgy_id
                        ? <span className="text-xs font-bold text-primary bg-primary/8 border border-primary/15 rounded-lg px-2 py-0.5 font-mono">{u.sgy_id}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{u.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{u.mobile || "—"}</td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      {qrCounts[u.id] !== undefined ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${qrCounts[u.id] > 0 ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                          {qrCounts[u.id]}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden xl:table-cell text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-slate-500">Page {page} of {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {selected && (
        <UserDetailModal user={selected} onRefresh={reload} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
