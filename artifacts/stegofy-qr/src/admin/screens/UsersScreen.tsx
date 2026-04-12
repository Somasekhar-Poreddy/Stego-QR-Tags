import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search, ChevronLeft, ChevronRight, X, User, QrCode, MessageSquare,
  Trash2, ShieldOff, ShieldCheck, Copy, Check, ChevronDown, ChevronUp,
  Phone, MapPin, Globe, Calendar, Instagram, Twitter, Facebook,
  Save, Edit3, RefreshCw, Filter, Home, Activity, Plus, Key, Link2,
  ExternalLink, Download, Clock, LogIn, LogOut, Smartphone, Monitor,
  BarChart2, Eye, EyeOff,
} from "lucide-react";
import QRCodeLib from "qrcode";
import {
  adminGetAllUsers, adminBlockUser, adminUnblockUser, adminDeleteUser,
  adminGetUserQRCodes, adminUpdateUserProfile, adminGetAllContactRequestsForUser,
  adminGetQRCountsByUser, adminDisableQRCode, adminEnableQRCode, adminDeleteQRCode,
  adminUpdateQRCode, adminGetUserActivityLogs, adminGetLastSeenByUsers,
  adminGetUserActivityLogCount, adminGetScansByQRIds, adminGetScanCountByQRIds,
  adminDecryptIP, type ActivityLog, type QRScan,
} from "@/services/adminService";
import { supabase } from "@/lib/supabase";

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
interface QRPrivacy {
  maskPhone?: boolean; whatsappOnly?: boolean; videoCall?: boolean;
  emergencyPriority?: boolean; strictMode?: boolean;
}
interface QRRow {
  id: string; name: string; type: string; status: string; display_code: string | null;
  qr_url?: string | null;
  created_at?: string; scan_count?: number | null; scans?: number | null; is_active?: boolean;
  primary_contact?: string | null; secondary_phone?: string | null;
  emergency_contact?: string | null; allow_contact?: boolean | null;
  strict_mode?: boolean | null; whatsapp_enabled?: boolean | null;
  allow_video_call?: boolean | null; privacy?: QRPrivacy | null;
  privacy_mode?: string | null; pin_code?: string | null;
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

function parseUA(ua: string | null | undefined): { browser: string; platform: string; isMobile: boolean } {
  if (!ua) return { browser: "Unknown", platform: "Unknown", isMobile: false };
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  let browser = "Other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  let platform = "Other";
  if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = "iOS";
  else if (/Windows/i.test(ua)) platform = "Windows";
  else if (/Mac OS X/i.test(ua)) platform = "macOS";
  else if (/Linux/i.test(ua)) platform = "Linux";
  return { browser, platform, isMobile };
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
function genUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

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
  const [editAddresses, setEditAddresses] = useState<Address[]>(
    Array.isArray(user.addresses) ? user.addresses.map((a) => ({ ...a })) : []
  );
  const [editSocial, setEditSocial] = useState<SocialLinks>(user.social_links ?? {});

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
    const rawAddresses = editAddresses.filter((a) => a.line1?.trim() && a.city?.trim());
    const hasDefault = rawAddresses.some((a) => a.is_default);
    const cleanAddresses = rawAddresses.map((a, i) => ({
      ...a,
      is_default: hasDefault ? !!a.is_default : i === 0,
    }));
    const cleanSocial: SocialLinks = {
      instagram: editSocial.instagram?.trim() || undefined,
      facebook: editSocial.facebook?.trim() || undefined,
      twitter: editSocial.twitter?.trim() || undefined,
    };
    const { error } = await adminUpdateUserProfile(user.id, {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      mobile: form.mobile || null,
      age_group: form.age_group || null,
      gender: form.gender || null,
      status: form.status || "active",
      addresses: cleanAddresses,
      social_links: cleanSocial,
    });
    setSaving(false);
    if (error) {
      setSaveMsg({ ok: false, text: "Failed to save. Please try again." });
    } else {
      setEditSocial(cleanSocial);
      const updatedFields: Partial<UserRow> = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        mobile: form.mobile || null,
        age_group: form.age_group || null,
        gender: form.gender || null,
        status: form.status || "active",
        addresses: cleanAddresses,
        social_links: cleanSocial,
      };
      setSaveMsg({ ok: true, text: "All changes saved!" });
      setEditing(false);
      onUserUpdated(updatedFields);
      onRefresh();
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSaveMsg(null);
    setForm({
      first_name: user.first_name ?? "", last_name: user.last_name ?? "",
      mobile: user.mobile ?? "", age_group: user.age_group ?? "",
      gender: user.gender ?? "", status: user.status ?? "active",
    });
    setEditAddresses(Array.isArray(user.addresses) ? user.addresses.map((a) => ({ ...a })) : []);
    setEditSocial(user.social_links ?? {});
  };

  const addAddress = () => {
    setEditAddresses((prev) => [...prev, { id: genUUID(), label: "Home", line1: "", line2: "", city: "", state: "", pincode: "", is_default: prev.length === 0 }]);
  };
  const removeAddress = (idx: number) => {
    setEditAddresses((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((a) => a.is_default)) next[0].is_default = true;
      return next;
    });
  };
  const setDefault = (idx: number) => {
    setEditAddresses((prev) => prev.map((a, i) => ({ ...a, is_default: i === idx })));
  };
  const updateAddr = (idx: number, field: keyof Address, value: string) => {
    setEditAddresses((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const readAddresses: Address[] = Array.isArray(user.addresses) ? user.addresses : [];
  const readSocial: SocialLinks = user.social_links ?? {};

  return (
    <div className="p-5 space-y-5">
      {/* Personal Information */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-700">Personal Information</h4>
          <button
            onClick={() => { editing ? handleCancelEdit() : setEditing(true); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${editing ? "bg-slate-200 text-slate-700" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editing ? "Cancel" : "Edit All"}
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
      <div className="bg-slate-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Home className="w-4 h-4 text-slate-400" /> Addresses
            {(editing ? editAddresses : readAddresses).length > 0 && (
              <span className="text-[11px] font-bold text-slate-400">({(editing ? editAddresses : readAddresses).length})</span>
            )}
          </h4>
          {editing && (
            <button onClick={addAddress}
              className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded-xl hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
        {editing ? (
          editAddresses.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-3">No addresses. Click "Add" to add one.</p>
          ) : (
            <div className="space-y-3">
              {editAddresses.map((addr, idx) => (
                <div key={addr.id ?? idx} className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={addr.label || "Home"}
                      onChange={(e) => updateAddr(idx, "label", e.target.value)}
                      className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:border-primary outline-none"
                    >
                      {["Home", "Work", "Other"].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      {!addr.is_default && (
                        <button onClick={() => setDefault(idx)}
                          className="text-[10px] font-semibold text-primary border border-primary/30 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors">
                          Set Default
                        </button>
                      )}
                      {addr.is_default && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>
                      )}
                      <button onClick={() => removeAddress(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Line 1" value={addr.line1 || ""} onChange={(e) => updateAddr(idx, "line1", e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                    <input placeholder="Line 2" value={addr.line2 || ""} onChange={(e) => updateAddr(idx, "line2", e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                    <input placeholder="City" value={addr.city || ""} onChange={(e) => updateAddr(idx, "city", e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                    <input placeholder="State" value={addr.state || ""} onChange={(e) => updateAddr(idx, "state", e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                    <input placeholder="Pincode" value={addr.pincode || ""} onChange={(e) => updateAddr(idx, "pincode", e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          readAddresses.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-3">No addresses added yet</p>
          ) : (
            <div className="space-y-2">
              {readAddresses.map((addr, i) => (
                <div key={addr.id ?? i} className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-600 capitalize">{addr.label || "Address"}</span>
                    {addr.is_default && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-xs text-slate-600">{[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Social Links */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400" /> Social Links
        </h4>
        {editing ? (
          <div className="space-y-2.5">
            {([
              { key: "instagram" as keyof SocialLinks, icon: <Instagram className="w-4 h-4 text-pink-500" />, placeholder: "Instagram handle (without @)" },
              { key: "facebook" as keyof SocialLinks, icon: <Facebook className="w-4 h-4 text-blue-600" />, placeholder: "Facebook handle or URL" },
              { key: "twitter" as keyof SocialLinks, icon: <Twitter className="w-4 h-4 text-sky-500" />, placeholder: "Twitter / X handle (without @)" },
            ]).map(({ key, icon, placeholder }) => (
              <div key={key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
                {icon}
                <input
                  value={editSocial[key] || ""}
                  onChange={(e) => setEditSocial((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
                {editSocial[key] && (
                  <button onClick={() => setEditSocial((s) => ({ ...s, [key]: "" }))} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          readSocial.instagram || readSocial.facebook || readSocial.twitter ? (
            <div className="space-y-2">
              {readSocial.instagram && (
                <a href={`https://instagram.com/${readSocial.instagram}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-pink-600 transition-colors">
                  <Instagram className="w-4 h-4 text-pink-500" /> @{readSocial.instagram}
                </a>
              )}
              {readSocial.facebook && (() => {
                const fbVal = readSocial.facebook;
                const fbUrl = fbVal.startsWith("http") ? fbVal : `https://facebook.com/${fbVal}`;
                return (
                  <a href={fbUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors">
                    <Facebook className="w-4 h-4 text-blue-600" /> {fbVal}
                  </a>
                );
              })()}
              {readSocial.twitter && (
                <a href={`https://twitter.com/${readSocial.twitter}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-sky-500 transition-colors">
                  <Twitter className="w-4 h-4 text-sky-500" /> @{readSocial.twitter}
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-2">No social links added yet</p>
          )
        )}
      </div>

      {/* Save / Cancel row — only show when editing */}
      {editing && (
        <div className="flex items-center gap-3 pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save All Changes
          </button>
          <button onClick={handleCancelEdit} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          {saveMsg && (
            <p className={`text-xs font-semibold ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>{saveMsg.text}</p>
          )}
        </div>
      )}
      {!editing && saveMsg && (
        <p className={`text-xs font-semibold ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>{saveMsg.text}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   QR CODE IMAGE (small preview)
   ───────────────────────────────────────────────── */
function QRImage({ url, size = 128 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDataUrl(null);
    setError(false);
    QRCodeLib.toDataURL(url, {
      width: size * 2,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setDataUrl).catch(() => setError(true));
  }, [url, size]);

  if (error) return (
    <div style={{ width: size, height: size }}
      className="bg-slate-100 rounded-xl flex items-center justify-center">
      <span className="text-[10px] text-slate-400">Error</span>
    </div>
  );
  if (!dataUrl) return (
    <div style={{ width: size, height: size }} className="bg-slate-100 rounded-xl animate-pulse" />
  );
  return (
    <img src={dataUrl} alt="QR Code" style={{ width: size, height: size }}
      className="rounded-xl shadow-sm" />
  );
}

/* ─────────────────────────────────────────────────
   QR PREVIEW CARD (128×128 image + copy URL + links)
   ───────────────────────────────────────────────── */
function QRPreviewCard({ qr }: { qr: { id: string; qr_url?: string | null; display_code: string | null; name: string } }) {
  const [copied, setCopied] = useState(false);
  const qrPageUrl = qr.qr_url || `${window.location.origin}/qr/${qr.id}`;

  const handleDl = async () => {
    try {
      const d = await QRCodeLib.toDataURL(qrPageUrl, { width: 512, margin: 3, color: { dark: "#1e293b", light: "#ffffff" } });
      const fname = qr.display_code ? `stegofy-${qr.display_code}` : (qr.name || qr.id);
      const a = document.createElement("a"); a.href = d;
      a.download = `${fname}.png`; a.click();
    } catch { /* ignore */ }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrPageUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* ignore */ });
  };

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 140 }}>
      <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
        <QRImage url={qrPageUrl} size={128} />
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Stegofy</p>
      <button
        onClick={handleCopy}
        title="Copy URL"
        className="flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors w-full justify-center group"
      >
        <span className="truncate max-w-[90px]">{qrPageUrl}</span>
        {copied ? <Check className="w-2.5 h-2.5 text-green-500 shrink-0" /> : <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0 group-hover:text-slate-600" />}
      </button>
      <a href={qrPageUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
        <ExternalLink className="w-2.5 h-2.5" /> Open Page
      </a>
      <button onClick={handleDl}
        className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700">
        <Download className="w-2.5 h-2.5" /> PNG
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   QR SETTINGS TOGGLE (reusable)
   ───────────────────────────────────────────────── */
function SettingToggle({ label, value, onChange, disabled }: {
  label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-700 font-medium">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${value ? "bg-primary" : "bg-slate-200"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function computePrivacyMode(p: QRPrivacy): string {
  if (p.emergencyPriority) return "emergency";
  if (p.whatsappOnly) return "whatsapp";
  if (p.maskPhone) return "mask";
  return "show";
}

/* ─────────────────────────────────────────────────
   QR CARD (expandable with activity + settings edit)
   ───────────────────────────────────────────────── */
function QRCard({ qr: initialQr, contacts, onToggle, onDelete, onUpdated }: {
  qr: QRRow; contacts: ContactRow[];
  onToggle: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
  onUpdated: (id: string, updates: Partial<QRRow>) => void;
}) {
  const [qr, setQr] = useState<QRRow>(initialQr);
  const [expanded, setExpanded] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPinChange, setShowPinChange] = useState(false);

  const [editQR, setEditQR] = useState({
    name: qr.name || "",
    primary_contact: qr.primary_contact || "",
    secondary_phone: qr.secondary_phone || "",
    emergency_contact: qr.emergency_contact || "",
    allow_contact: qr.allow_contact ?? false,
    strict_mode: qr.strict_mode ?? false,
    maskPhone: qr.privacy?.maskPhone ?? false,
    whatsappOnly: qr.privacy?.whatsappOnly ?? (qr.whatsapp_enabled ?? false),
    videoCall: qr.privacy?.videoCall ?? (qr.allow_video_call ?? false),
    emergencyPriority: qr.privacy?.emergencyPriority ?? false,
    pin_code: qr.pin_code || "",
    newPin: "",
  });

  const syncFromQR = (q: QRRow) => {
    setEditQR({
      name: q.name || "",
      primary_contact: q.primary_contact || "",
      secondary_phone: q.secondary_phone || "",
      emergency_contact: q.emergency_contact || "",
      allow_contact: q.allow_contact ?? false,
      strict_mode: q.strict_mode ?? false,
      maskPhone: q.privacy?.maskPhone ?? false,
      whatsappOnly: q.privacy?.whatsappOnly ?? (q.whatsapp_enabled ?? false),
      videoCall: q.privacy?.videoCall ?? (q.allow_video_call ?? false),
      emergencyPriority: q.privacy?.emergencyPriority ?? false,
      pin_code: q.pin_code || "",
      newPin: "",
    });
    setShowPinChange(false);
  };

  const handleCancelSettings = () => {
    setEditingSettings(false);
    setSettingsMsg(null);
    syncFromQR(qr);
  };

  const handleSaveSettings = async () => {
    if (editQR.newPin && editQR.newPin.length !== 4) {
      setSettingsMsg({ ok: false, text: "PIN must be exactly 4 digits." });
      return;
    }
    setSavingSettings(true);
    setSettingsMsg(null);
    const privacy: QRPrivacy = {
      maskPhone: editQR.maskPhone,
      whatsappOnly: editQR.whatsappOnly,
      videoCall: editQR.videoCall,
      emergencyPriority: editQR.emergencyPriority,
      strictMode: editQR.strict_mode,
    };
    const pinToSave = showPinChange
      ? (editQR.newPin || null)
      : qr.pin_code;
    const updates: Record<string, unknown> = {
      name: editQR.name || qr.name,
      primary_contact: editQR.primary_contact || null,
      secondary_phone: editQR.secondary_phone || null,
      emergency_contact: editQR.emergency_contact || null,
      allow_contact: editQR.allow_contact,
      strict_mode: editQR.strict_mode,
      whatsapp_enabled: editQR.whatsappOnly,
      allow_video_call: editQR.videoCall,
      privacy,
      privacy_mode: computePrivacyMode(privacy),
      pin_code: pinToSave,
    };
    const { error } = await adminUpdateQRCode(qr.id, updates);
    setSavingSettings(false);
    if (error) {
      setSettingsMsg({ ok: false, text: "Failed to save. Please try again." });
    } else {
      const updated: QRRow = { ...qr, ...updates as Partial<QRRow>, pin_code: pinToSave };
      setQr(updated);
      onUpdated(qr.id, updates as Partial<QRRow>);
      setEditingSettings(false);
      setSettingsMsg({ ok: true, text: "QR settings saved!" });
      setShowPinChange(false);
      setTimeout(() => setSettingsMsg(null), 3000);
    }
  };

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
          {/* Settings section */}
          <div className="px-4 py-3 border-b border-slate-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">QR Settings</p>
              {!editingSettings ? (
                <button onClick={() => { setEditingSettings(true); setSettingsMsg(null); }}
                  className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded-xl hover:bg-primary/20 transition-colors">
                  <Edit3 className="w-3 h-3" /> Edit Settings
                </button>
              ) : (
                <button onClick={handleCancelSettings} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              )}
            </div>

            {editingSettings ? (
              <div className="space-y-3">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">QR Name</label>
                    <input value={editQR.name} onChange={(e) => setEditQR((f) => ({ ...f, name: e.target.value }))}
                      placeholder="QR Code name"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Primary Contact</label>
                    <input value={editQR.primary_contact} onChange={(e) => setEditQR((f) => ({ ...f, primary_contact: e.target.value }))}
                      placeholder="+91 phone"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Secondary Phone</label>
                    <input value={editQR.secondary_phone} onChange={(e) => setEditQR((f) => ({ ...f, secondary_phone: e.target.value }))}
                      placeholder="+91 phone"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Emergency Contact</label>
                    <input value={editQR.emergency_contact} onChange={(e) => setEditQR((f) => ({ ...f, emergency_contact: e.target.value }))}
                      placeholder="+91 phone"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none" />
                  </div>
                </div>

                {/* Privacy Toggles */}
                <div className="bg-slate-50 rounded-xl px-3 py-2 divide-y divide-slate-100">
                  <SettingToggle label="Allow Contact" value={editQR.allow_contact} onChange={(v) => setEditQR((f) => ({ ...f, allow_contact: v }))} />
                  <SettingToggle label="Strict Mode" value={editQR.strict_mode} onChange={(v) => setEditQR((f) => ({ ...f, strict_mode: v }))} />
                  <SettingToggle label="Mask Phone Number" value={editQR.maskPhone} onChange={(v) => setEditQR((f) => ({ ...f, maskPhone: v }))} />
                  <SettingToggle label="WhatsApp Only" value={editQR.whatsappOnly} onChange={(v) => setEditQR((f) => ({ ...f, whatsappOnly: v }))} />
                  <SettingToggle label="Allow Video Call" value={editQR.videoCall} onChange={(v) => setEditQR((f) => ({ ...f, videoCall: v }))} />
                  <SettingToggle label="Emergency Priority" value={editQR.emergencyPriority} onChange={(v) => setEditQR((f) => ({ ...f, emergencyPriority: v }))} />
                </div>

                {/* PIN Management */}
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">PIN Code</span>
                      <span className="text-xs text-slate-500">
                        {qr.pin_code ? "•••• (set)" : "Not set"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowPinChange((s) => !s)}
                        className="text-[11px] font-semibold text-primary hover:underline">
                        {showPinChange ? "Cancel" : "Change"}
                      </button>
                      {qr.pin_code && !showPinChange && (
                        <button onClick={() => { setEditQR((f) => ({ ...f, newPin: "" })); setShowPinChange(true); }}
                          className="text-[11px] font-semibold text-red-500 hover:underline">Remove</button>
                      )}
                    </div>
                  </div>
                  {showPinChange && (
                    <div className="mt-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={editQR.newPin}
                        onChange={(e) => setEditQR((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                        placeholder="Enter 4-digit PIN (leave blank to remove)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary outline-none font-mono tracking-widest"
                      />
                    </div>
                  )}
                </div>

                {/* Save row */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={handleSaveSettings} disabled={savingSettings}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {savingSettings ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save QR Settings
                  </button>
                  {settingsMsg && (
                    <p className={`text-xs font-semibold ${settingsMsg.ok ? "text-green-600" : "text-red-600"}`}>{settingsMsg.text}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Read-only settings view */
              <div className="space-y-1.5">
                {settingsMsg && (
                  <p className={`text-xs font-semibold mb-2 ${settingsMsg.ok ? "text-green-600" : "text-red-600"}`}>{settingsMsg.text}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  {qr.primary_contact && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {qr.primary_contact}</span>}
                  {qr.secondary_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {qr.secondary_phone} (alt)</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: "Allow Contact", val: qr.allow_contact },
                    { label: "Strict Mode", val: qr.strict_mode },
                    { label: "Mask Phone", val: qr.privacy?.maskPhone },
                    { label: "WhatsApp Only", val: qr.privacy?.whatsappOnly ?? qr.whatsapp_enabled },
                    { label: "Video Call", val: qr.privacy?.videoCall ?? qr.allow_video_call },
                    { label: "Emergency", val: qr.privacy?.emergencyPriority },
                    { label: "PIN Set", val: !!qr.pin_code },
                  ].map(({ label, val }) => (
                    <span key={label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${val ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                      {val ? "✓" : "✗"} {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contact Activity — with QR image preview on the left */}
          <div className="px-4 py-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Contact Activity</p>
            <div className="flex gap-4 items-start">
              {/* QR Code Preview column */}
              <QRPreviewCard qr={qr} />

              {/* Timeline column */}
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-400 italic pt-1">No contact activity yet</p>
              ) : (
              <div className="space-y-4 flex-1 min-w-0">
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
function QRCodesTab({ qrs: initialQrs, contacts, onRefreshQrs }: {
  qrs: QRRow[]; contacts: ContactRow[]; onRefreshQrs: () => void;
}) {
  const [qrs, setQrs] = useState<QRRow[]>(initialQrs);
  useEffect(() => { setQrs(initialQrs); }, [initialQrs]);
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
  const handleUpdated = (qrId: string, updates: Partial<QRRow>) => {
    setQrs((prev) => prev.map((q) => q.id === qrId ? { ...q, ...updates } : q));
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
              onToggle={handleToggle} onDelete={handleDelete} onUpdated={handleUpdated} />
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
   SESSIONS TAB
   ───────────────────────────────────────────────── */
function SessionsTab({ userId, totalCount }: { userId: string; totalCount: number }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (lim: number) => {
    setLoading(true);
    const data = await adminGetUserActivityLogs(userId, lim + 1);
    setHasMore(data.length > lim);
    setLogs(data.slice(0, lim));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(30); }, [load]);

  const handleLoadMore = () => {
    const next = limit + 30;
    setLimit(next);
    load(next);
  };

  const loginEvents = logs.filter((l) => l.event_type === "login");
  const logoutEvents = logs.filter((l) => l.event_type === "logout");
  const lastLogin = loginEvents[0]?.created_at;
  const lastLogout = logoutEvents[0]?.created_at;

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm">Loading sessions…</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Total Logins</p>
          <p className="text-xl font-black text-slate-800">{totalCount > 0 ? totalCount : loginEvents.length}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Last Login</p>
          <p className="text-xs font-semibold text-slate-700" title={lastLogin ? new Date(lastLogin).toLocaleString("en-IN") : undefined}>
            {lastLogin ? formatRelativeTime(lastLogin) : "—"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Last Logout</p>
          <p className="text-xs font-semibold text-slate-700" title={lastLogout ? new Date(lastLogout).toLocaleString("en-IN") : undefined}>
            {lastLogout ? formatRelativeTime(lastLogout) : "—"}
          </p>
        </div>
      </div>

      {/* Timeline */}
      {logs.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Clock className="w-10 h-10 text-slate-200 mx-auto" />
          <p className="text-sm text-slate-400">No session activity recorded yet</p>
          <p className="text-xs text-slate-300">Sessions are recorded from this point forward</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isLogin = log.event_type === "login";
            const ua = (log.metadata as Record<string, string | null>)?.user_agent;
            const { browser, platform, isMobile } = parseUA(ua);
            const ts = new Date(log.created_at).toLocaleString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isLogin ? "bg-green-100" : "bg-red-100"}`}>
                  {isLogin
                    ? <LogIn className="w-4 h-4 text-green-600" />
                    : <LogOut className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-bold ${isLogin ? "text-green-700" : "text-red-600"}`}>
                      {isLogin ? "Logged In" : "Logged Out"}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {browser} · {platform}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5" title={ts}>
                    {formatRelativeTime(log.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-slate-300">
                  {isMobile
                    ? <Smartphone className="w-4 h-4" />
                    : <Monitor className="w-4 h-4" />
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="w-full py-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
          Load more sessions
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   COUNTRY FLAG HELPER
   ───────────────────────────────────────────────── */
const COUNTRY_ISO: Record<string, string> = {
  "india": "IN", "united states": "US", "united kingdom": "GB",
  "canada": "CA", "australia": "AU", "germany": "DE", "france": "FR",
  "japan": "JP", "china": "CN", "brazil": "BR", "russia": "RU",
  "south korea": "KR", "mexico": "MX", "italy": "IT", "spain": "ES",
  "netherlands": "NL", "switzerland": "CH", "sweden": "SE", "norway": "NO",
  "denmark": "DK", "finland": "FI", "poland": "PL", "austria": "AT",
  "belgium": "BE", "portugal": "PT", "greece": "GR", "turkey": "TR",
  "ukraine": "UA", "singapore": "SG", "malaysia": "MY", "indonesia": "ID",
  "thailand": "TH", "vietnam": "VN", "philippines": "PH", "pakistan": "PK",
  "bangladesh": "BD", "sri lanka": "LK", "nepal": "NP", "new zealand": "NZ",
  "south africa": "ZA", "nigeria": "NG", "kenya": "KE", "egypt": "EG",
  "saudi arabia": "SA", "united arab emirates": "AE", "israel": "IL",
  "iran": "IR", "iraq": "IQ", "argentina": "AR", "colombia": "CO",
  "chile": "CL", "peru": "PE", "venezuela": "VE", "czech republic": "CZ",
  "romania": "RO", "hungary": "HU", "slovakia": "SK", "croatia": "HR",
  "serbia": "RS", "bulgaria": "BG", "ireland": "IE", "hong kong": "HK",
  "taiwan": "TW", "myanmar": "MM", "cambodia": "KH", "qatar": "QA",
  "kuwait": "KW", "bahrain": "BH", "oman": "OM", "jordan": "JO",
  "lebanon": "LB", "morocco": "MA", "algeria": "DZ", "tunisia": "TN",
  "ghana": "GH", "ethiopia": "ET", "tanzania": "TZ", "uganda": "UG",
};

function countryFlag(country: string | null): string {
  if (!country) return "";
  const iso = COUNTRY_ISO[country.toLowerCase()];
  if (!iso) return "🌐";
  return iso.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

/* ─────────────────────────────────────────────────
   SCANS TAB
   ───────────────────────────────────────────────── */
function ScansTab({
  qrs,
  totalCount,
  isSuperAdmin,
}: {
  qrs: QRRow[];
  totalCount: number;
  isSuperAdmin: boolean;
}) {
  const qrIds = useMemo(() => qrs.map((q) => q.id), [qrs]);
  const qrNameMap = useMemo(
    () => Object.fromEntries(qrs.map((q) => [q.id, q.name || q.display_code || q.type || "QR"])),
    [qrs],
  );
  const [scans, setScans] = useState<QRScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const [hasMore, setHasMore] = useState(false);
  const [revealedIps, setRevealedIps] = useState<Record<string, string>>({});
  const [loadingIp, setLoadingIp] = useState<Record<string, boolean>>({});

  const revealIp = (id: string, ip: string) => {
    setRevealedIps((prev) => ({ ...prev, [id]: ip }));
    setTimeout(() => {
      setRevealedIps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 10000);
  };

  const load = useCallback(async (lim: number) => {
    setLoading(true);
    const data = await adminGetScansByQRIds(qrIds, lim + 1);
    setHasMore(data.length > lim);
    setScans(data.slice(0, lim));
    setLoading(false);
  }, [qrIds]);

  useEffect(() => { load(30); }, [load]);

  const handleLoadMore = () => {
    const next = limit + 30;
    setLimit(next);
    load(next);
  };

  const handleViewIp = async (scan: QRScan) => {
    if (!scan.encrypted_ip) return;
    setLoadingIp((prev) => ({ ...prev, [scan.id]: true }));
    const result = await adminDecryptIP(scan.encrypted_ip, scan.qr_id, scan.id);
    setLoadingIp((prev) => ({ ...prev, [scan.id]: false }));
    if ("ip" in result) {
      revealIp(scan.id, result.ip);
    } else {
      revealIp(scan.id, `Error: ${result.error}`);
    }
  };

  const getDeviceIcon = (device: string | null) => {
    if (device === "mobile") return <Smartphone className="w-3.5 h-3.5" />;
    return <Monitor className="w-3.5 h-3.5" />;
  };

  if (loading && scans.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm">Loading scans…</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Total Scans</p>
          <p className="text-xl font-black text-slate-800">{totalCount}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Requests Made</p>
          <p className="text-xl font-black text-slate-800">{scans.filter((s) => s.is_request_made).length}</p>
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <BarChart2 className="w-10 h-10 text-slate-200 mx-auto" />
          <p className="text-sm text-slate-400">No scans recorded yet</p>
          <p className="text-xs text-slate-300">Scans are recorded when someone opens a QR tag link</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scans.map((scan) => {
            const ts = new Date(scan.created_at).toLocaleString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            });
            const location = [scan.city, scan.state, scan.country].filter(Boolean).join(", ");
            const flag = countryFlag(scan.country);
            const qrName = qrNameMap[scan.qr_id];
            const revealedIp = revealedIps[scan.id];
            const isLoadingThisIp = loadingIp[scan.id];
            return (
              <div key={scan.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
                    {getDeviceIcon(scan.device)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-700" title={ts}>
                        {formatRelativeTime(scan.created_at)}
                      </p>
                      {qrName && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <QrCode className="w-2.5 h-2.5" /> {qrName}
                        </span>
                      )}
                      {scan.is_request_made && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                          Request made
                        </span>
                      )}
                      {scan.intent && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getIntentColor(scan.intent)}`}>
                          {getIntentLabel(scan.intent)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {(scan.browser || scan.os) && (
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {[scan.browser, scan.os].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {location && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          {flag && <span className="text-sm leading-none">{flag}</span>}
                          {!flag && <MapPin className="w-3 h-3 text-slate-400 shrink-0" />}
                          {location}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {scan.masked_ip && (
                        <span className="text-[11px] font-mono text-slate-500">
                          {revealedIp ? (
                            <span className="text-primary font-semibold">{revealedIp}</span>
                          ) : (
                            scan.masked_ip
                          )}
                        </span>
                      )}
                      {isSuperAdmin && scan.encrypted_ip && (
                        <button
                          onClick={() => handleViewIp(scan)}
                          disabled={isLoadingThisIp || !!revealedIp}
                          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          title="View full IP (visible for 10 seconds)"
                        >
                          {isLoadingThisIp ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : revealedIp ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          {revealedIp ? "Hiding…" : "View Full IP 🔐"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="w-full py-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
          Load more scans
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   USER DETAIL MODAL — true full-page overlay
   ───────────────────────────────────────────────── */
type TabKey = "profile" | "qrcodes" | "activity" | "sessions" | "scans";

function UserDetailModal({ user, onRefresh, onClose }: {
  user: UserRow; onRefresh: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const [qrs, setQrs] = useState<QRRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [localUser, setLocalUser] = useState<UserRow>(user);

  const handleUserUpdated = useCallback((updates: Partial<UserRow>) => {
    setLocalUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const loadUserData = useCallback(async () => {
    setLoadingData(true);
    const [userQrs, allContacts, count] = await Promise.all([
      adminGetUserQRCodes(user.id) as Promise<QRRow[]>,
      adminGetAllContactRequestsForUser(user.id) as Promise<ContactRow[]>,
      adminGetUserActivityLogCount(user.id),
    ]);
    setQrs(userQrs);
    setContacts(allContacts);
    setSessionCount(count);
    // Fetch scan count from qr_scans using these user's QR IDs
    const qrIds = userQrs.map((q) => q.id);
    if (qrIds.length > 0) {
      const sc = await adminGetScanCountByQRIds(qrIds);
      setScanCount(sc);
    }
    setLoadingData(false);
  }, [user.id]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  // Determine if current admin is a super-admin (checks env list + admin_users table)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const uid = session.user.id;
      const allowedIds = (import.meta.env.VITE_ADMIN_USER_IDS ?? "")
        .split(",").map((id: string) => id.trim()).filter(Boolean);
      if (allowedIds.includes(uid)) { setIsSuperAdmin(true); return; }
      // Fall back to checking admin_users table
      const { data } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", uid)
        .single();
      if (data?.role === "super_admin") setIsSuperAdmin(true);
    }).catch(() => {});
  }, []);

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
    { key: "sessions", label: "Sessions", icon: <Clock className="w-4 h-4" />, badge: sessionCount },
    { key: "scans", label: "Scans", icon: <BarChart2 className="w-4 h-4" />, badge: scanCount },
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
              {tab === "sessions" && <SessionsTab userId={user.id} totalCount={sessionCount} />}
              {tab === "scans" && <ScansTab qrs={qrs} totalCount={scanCount} isSuperAdmin={isSuperAdmin} />}
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
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await adminGetAllUsers()) as UserRow[];
      setUsers(u);
      if (u.length > 0) {
        const ids = u.map((x) => x.id);
        const [counts, lastSeen] = await Promise.all([
          adminGetQRCountsByUser(ids),
          adminGetLastSeenByUsers(ids),
        ]);
        setQrCounts(counts);
        setLastSeenMap(lastSeen);
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
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Last Seen</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
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
                    <td className="px-4 py-3 hidden xl:table-cell text-xs">
                      {lastSeenMap[u.id] ? (
                        <span className="text-slate-600 font-medium" title={new Date(lastSeenMap[u.id]).toLocaleString("en-IN")}>
                          {formatRelativeTime(lastSeenMap[u.id])}
                        </span>
                      ) : (
                        <span className="text-slate-300">Never</span>
                      )}
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
