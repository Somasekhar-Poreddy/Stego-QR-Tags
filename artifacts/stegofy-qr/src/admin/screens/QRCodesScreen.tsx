import { useEffect, useState } from "react";
import {
  Search, X, ChevronLeft, ChevronRight, Trash2, PauseCircle,
  Edit3, Save, RefreshCw, Phone, Key, ShieldCheck, Settings,
  Download, ExternalLink,
} from "lucide-react";
import QRCodeLib from "qrcode";
import {
  adminGetAllQRCodes, adminDisableQRCode, adminDeleteQRCode,
  adminGetAllUsers, adminEnableQRCode, adminUpdateQRCode,
} from "@/services/adminService";

const PAGE_SIZE = 15;

interface QRPrivacy {
  maskPhone?: boolean; whatsappOnly?: boolean; videoCall?: boolean;
  emergencyPriority?: boolean; strictMode?: boolean;
}
interface QRRow {
  id: string; user_id: string; name: string; type: string; status: string;
  display_code: string | null; is_active: boolean | null; created_at: string;
  qr_url?: string | null;
  primary_contact?: string | null; secondary_phone?: string | null;
  emergency_contact?: string | null; allow_contact?: boolean | null;
  strict_mode?: boolean | null; whatsapp_enabled?: boolean | null;
  allow_video_call?: boolean | null; privacy?: QRPrivacy | null;
  privacy_mode?: string | null; pin_code?: string | null;
  scans?: number | null; [key: string]: unknown;
}

/* ─────────────────────────────────────────────────
   QR CODE IMAGE COMPONENT
   ───────────────────────────────────────────────── */
function QRImage({ url, size = 180 }: { url: string; size?: number }) {
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
    <div style={{ width: size, height: size }} className="bg-slate-100 rounded-xl flex items-center justify-center">
      <span className="text-xs text-slate-400">Error</span>
    </div>
  );
  if (!dataUrl) return (
    <div style={{ width: size, height: size }} className="bg-slate-100 rounded-xl animate-pulse" />
  );
  return (
    <img src={dataUrl} alt="QR Code" style={{ width: size, height: size }}
      className="rounded-xl shadow-md" />
  );
}

interface OwnerRow { id: string; sgy_id?: string | null; first_name: string | null; last_name: string | null; email: string | null; }

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${color}`}>{label}</span>;
}

function SettingToggle({ label, value, onChange, disabled }: {
  label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${value ? "bg-primary" : "bg-slate-200"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-[18px]" : "translate-x-0"}`} />
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

function getTypeEmoji(type: string) {
  const map: Record<string, string> = {
    vehicle: "🚗", pet: "🐾", child: "👶", elder: "🧓", medical: "💊",
    home: "🏠", travel: "✈️", business: "💼", personal: "👤",
  };
  return map[type] ?? "🔖";
}

/* ─────────────────────────────────────────────────
   QR EDIT MODAL — view + edit + actions
   ───────────────────────────────────────────────── */
function maskContact(val: string | null | undefined): string {
  if (!val) return "—";
  const digits = val.replace(/\D/g, "");
  if (digits.length >= 4) return "•".repeat(digits.length - 4) + digits.slice(-4);
  return "••••";
}

function OwnerAvatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials || "?"}
    </div>
  );
}

function QREditModal({ qr: initialQr, owner, onClose, onUpdated, onEnable, onDisable, onDelete }: {
  qr: QRRow; owner: OwnerRow | undefined;
  onClose: () => void; onUpdated: (id: string, updates: Partial<QRRow>) => void;
  onEnable: (id: string) => void; onDisable: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [qr, setQr] = useState<QRRow>(initialQr);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPinChange, setShowPinChange] = useState(false);

  const [form, setForm] = useState({
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
    newPin: "",
  });

  const resetForm = (q: QRRow) => {
    setForm({
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
      newPin: "",
    });
    setShowPinChange(false);
  };

  const handleCancel = () => { setEditing(false); setSaveMsg(null); resetForm(qr); };

  const handleSave = async () => {
    if (form.newPin && form.newPin.length !== 4) {
      setSaveMsg({ ok: false, text: "PIN must be exactly 4 digits." });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    const privacy: QRPrivacy = {
      maskPhone: form.maskPhone, whatsappOnly: form.whatsappOnly,
      videoCall: form.videoCall, emergencyPriority: form.emergencyPriority,
      strictMode: form.strict_mode,
    };
    const pinToSave = showPinChange ? (form.newPin || null) : qr.pin_code;
    const updates: Record<string, unknown> = {
      name: form.name || qr.name,
      primary_contact: form.primary_contact || null,
      secondary_phone: form.secondary_phone || null,
      emergency_contact: form.emergency_contact || null,
      allow_contact: form.allow_contact,
      strict_mode: form.strict_mode,
      whatsapp_enabled: form.whatsappOnly,
      allow_video_call: form.videoCall,
      privacy,
      privacy_mode: computePrivacyMode(privacy),
      pin_code: pinToSave,
    };
    const { error } = await adminUpdateQRCode(qr.id, updates);
    setSaving(false);
    if (error) {
      setSaveMsg({ ok: false, text: "Failed to save. Please try again." });
    } else {
      const updated: QRRow = { ...qr, ...updates as Partial<QRRow>, pin_code: pinToSave };
      setQr(updated);
      onUpdated(qr.id, updates as Partial<QRRow>);
      setEditing(false);
      setSaveMsg({ ok: true, text: "QR settings saved!" });
      setShowPinChange(false);
      setForm((f) => ({ ...f, newPin: "" }));
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const inactive = qr.is_active === false || qr.status === "inactive";
  const ownerName = owner ? ([owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.email || "Unknown") : "Unknown";
  const qrPageUrl = qr.qr_url || `${window.location.origin}/qr/${qr.id}`;

  const handleDownloadQR = async () => {
    try {
      const highRes = await QRCodeLib.toDataURL(qrPageUrl, {
        width: 512, margin: 3,
        color: { dark: "#1e293b", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      const a = document.createElement("a");
      a.href = highRes;
      a.download = `${qr.name || qr.display_code || qr.id}.png`;
      a.click();
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getTypeEmoji(qr.type)}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900">{editing ? form.name || qr.name : qr.name}</h3>
                <Badge label={inactive ? "inactive" : qr.status}
                  color={inactive ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"} />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{qr.type} · {ownerName}</p>
              {qr.display_code && <p className="text-[11px] font-mono text-slate-400">{qr.display_code}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button onClick={() => { setEditing(true); setSaveMsg(null); }}
                className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-colors">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <button onClick={handleCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2">Cancel</button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* QR Code Image Panel */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="bg-white p-2 rounded-xl shadow-sm">
                <QRImage url={qrPageUrl} size={140} />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Stegofy QR</p>
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">QR Page URL</p>
              <p className="text-xs font-mono text-slate-600 break-all leading-relaxed bg-white rounded-lg px-2 py-1.5 border border-slate-200">
                {qrPageUrl}
              </p>
              <div className="flex gap-2 flex-wrap">
                <a href={qrPageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-colors">
                  <ExternalLink className="w-3 h-3" /> Open QR Page
                </a>
                <button onClick={handleDownloadQR}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                  <Download className="w-3 h-3" /> Download PNG
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Scans:</span>
                <span className="text-xs font-bold text-slate-700">{qr.scans ?? 0}</span>
                {qr.display_code && (
                  <>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{qr.display_code}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Basic Info</p>
            {editing ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">QR Name</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="QR Code name"
                    className="w-full mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Primary Contact</label>
                  <input value={form.primary_contact} onChange={(e) => setForm((f) => ({ ...f, primary_contact: e.target.value }))}
                    placeholder="+91 phone"
                    className="w-full mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Secondary Phone</label>
                  <input value={form.secondary_phone} onChange={(e) => setForm((f) => ({ ...f, secondary_phone: e.target.value }))}
                    placeholder="+91 phone"
                    className="w-full mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Emergency Contact</label>
                  <input value={form.emergency_contact} onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))}
                    placeholder="+91 phone"
                    className="w-full mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {[
                  { label: "Primary Contact", val: qr.primary_contact },
                  { label: "Secondary Phone", val: qr.secondary_phone },
                  { label: "Emergency Contact", val: qr.emergency_contact },
                ].map(({ label, val }) => val ? (
                  <div key={label} className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] text-slate-500">{label}:</span>
                    <span className="text-sm font-semibold text-slate-800 font-mono">{maskContact(val)}</span>
                  </div>
                ) : null)}
                {!qr.primary_contact && !qr.secondary_phone && !qr.emergency_contact && (
                  <p className="text-xs text-slate-400 italic">No contact numbers set</p>
                )}
              </div>
            )}
          </div>

          {/* Privacy Settings */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" /> Privacy Settings
            </p>
            {editing ? (
              <div className="divide-y divide-slate-100">
                <SettingToggle label="Allow Contact" value={form.allow_contact} onChange={(v) => setForm((f) => ({ ...f, allow_contact: v }))} />
                <SettingToggle label="Strict Mode" value={form.strict_mode} onChange={(v) => setForm((f) => ({ ...f, strict_mode: v }))} />
                <SettingToggle label="Mask Phone Number" value={form.maskPhone} onChange={(v) => setForm((f) => ({ ...f, maskPhone: v }))} />
                <SettingToggle label="WhatsApp Only" value={form.whatsappOnly} onChange={(v) => setForm((f) => ({ ...f, whatsappOnly: v }))} />
                <SettingToggle label="Allow Video Call" value={form.videoCall} onChange={(v) => setForm((f) => ({ ...f, videoCall: v }))} />
                <SettingToggle label="Emergency Priority" value={form.emergencyPriority} onChange={(v) => setForm((f) => ({ ...f, emergencyPriority: v }))} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Allow Contact", val: qr.allow_contact },
                  { label: "Strict Mode", val: qr.strict_mode },
                  { label: "Mask Phone", val: qr.privacy?.maskPhone },
                  { label: "WhatsApp Only", val: qr.privacy?.whatsappOnly ?? qr.whatsapp_enabled },
                  { label: "Video Call", val: qr.privacy?.videoCall ?? qr.allow_video_call },
                  { label: "Emergency Priority", val: qr.privacy?.emergencyPriority },
                ].map(({ label, val }) => (
                  <span key={label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${val ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                    {val ? "✓" : "✗"} {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* PIN Management */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">PIN Code</p>
                <span className={`text-[11px] font-semibold ${qr.pin_code ? "text-green-600" : "text-slate-400"}`}>
                  {qr.pin_code ? "•••• (set)" : "Not set"}
                </span>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPinChange((s) => !s)}
                    className="text-[11px] font-semibold text-primary hover:underline">
                    {showPinChange ? "Cancel" : "Change PIN"}
                  </button>
                  {qr.pin_code && !showPinChange && (
                    <button onClick={() => { setForm((f) => ({ ...f, newPin: "" })); setShowPinChange(true); }}
                      className="text-[11px] font-semibold text-red-500 hover:underline">Remove</button>
                  )}
                </div>
              )}
            </div>
            {editing && showPinChange && (
              <div className="mt-2">
                <input
                  type="text"
                  maxLength={4}
                  value={form.newPin}
                  onChange={(e) => setForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="Enter new 4-digit PIN (leave blank to remove)"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-primary outline-none font-mono tracking-widest"
                />
              </div>
            )}
          </div>

          {/* Owner Info */}
          {owner && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Owner</p>
              <div className="flex items-center gap-3">
                <OwnerAvatar name={ownerName} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{ownerName}</p>
                  {owner.email && <p className="text-xs text-slate-500 truncate">{owner.email}</p>}
                  {owner.sgy_id && (
                    <p className="text-[10px] font-mono text-slate-400 bg-slate-200 rounded px-1.5 py-0.5 mt-0.5 inline-block">{owner.sgy_id}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status info */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">QR Details</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">Mode:</span> <span className="font-semibold text-slate-700 capitalize">{qr.privacy_mode || "show"}</span></div>
              <div><span className="text-slate-400">Scans:</span> <span className="font-semibold text-slate-700">{qr.scans ?? 0}</span></div>
              <div><span className="text-slate-400">Code:</span> <span className="font-mono text-slate-700">{qr.display_code || "—"}</span></div>
              <div><span className="text-slate-400">Created:</span> <span className="font-semibold text-slate-700">{qr.created_at ? new Date(qr.created_at).toLocaleDateString("en-IN") : "—"}</span></div>
            </div>
          </div>

          {/* Save row (edit mode) */}
          {editing && (
            <div className="flex items-center gap-3 pb-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Settings
              </button>
              <button onClick={handleCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          )}
          {saveMsg && (
            <p className={`text-xs font-semibold ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>{saveMsg.text}</p>
          )}

          {/* Actions row (always visible) */}
          {!editing && (
            <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
              {inactive ? (
                <button onClick={() => { onEnable(qr.id); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enable QR
                </button>
              ) : (
                <button onClick={() => { onDisable(qr.id); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors">
                  <PauseCircle className="w-3.5 h-3.5" /> Disable QR
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete "${qr.name}"? This cannot be undone.`)) { onDelete(qr.id); onClose(); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Delete QR
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   QR CODES SCREEN (main export)
   ───────────────────────────────────────────────── */
export function QRCodesScreen() {
  const [qrs, setQrs] = useState<QRRow[]>([]);
  const [filtered, setFiltered] = useState<QRRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, OwnerRow>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<QRRow | null>(null);

  const reload = () => {
    setLoading(true);
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
  const handleEnable = async (id: string) => { await adminEnableQRCode(id); reload(); };
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this QR code? This cannot be undone.")) return;
    await adminDeleteQRCode(id); reload();
  };
  const handleUpdated = (qrId: string, updates: Partial<QRRow>) => {
    setQrs((prev) => prev.map((q) => q.id === qrId ? { ...q, ...updates } : q));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, code, or owner…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
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
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span>{getTypeEmoji(qr.type)}</span>
                        <span className="truncate">{qr.name}</span>
                      </div>
                    </td>
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
                        <button onClick={() => setViewing(qr)} title="View / Edit" className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {inactive ? (
                          <button onClick={() => handleEnable(qr.id)} title="Enable" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleDisable(qr.id)} title="Disable" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors">
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(qr.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
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

      {viewing && (
        <QREditModal
          qr={viewing}
          owner={userMap[viewing.user_id]}
          onClose={() => setViewing(null)}
          onUpdated={(id, updates) => { handleUpdated(id, updates); setViewing((v) => v ? { ...v, ...updates } : null); }}
          onEnable={(id) => { handleEnable(id); }}
          onDisable={(id) => { handleDisable(id); }}
          onDelete={(id) => { handleDelete(id); }}
        />
      )}
    </div>
  );
}
