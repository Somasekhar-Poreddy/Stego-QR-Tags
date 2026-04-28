import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, X, ChevronLeft, ChevronRight, Trash2, PauseCircle,
  Eye, Edit3, Save, RefreshCw, Phone, Key, ShieldCheck, Settings,
  Download, ExternalLink, Copy, Check, Share2,
  Lock, MessageCircle, Video, Zap,
} from "lucide-react";
import QRCodeLib from "qrcode";
import jsPDF from "jspdf";
import {
  adminGetAllQRCodes, adminDisableQRCode, adminDeleteQRCode,
  adminGetAllUsers, adminEnableQRCode, adminUpdateQRCode,
} from "@/services/adminService";
import { useReauthGuard } from "@/admin/components/useReauthGuard";
import { useToast } from "@/hooks/use-toast";

/* ─────────────────────────────────────────────────
   DATA FIELD LABEL MAP (human-readable keys)
   ───────────────────────────────────────────────── */
const DATA_FIELD_LABELS: Record<string, string> = {
  vehicle_number: "Vehicle Number", license_plate: "License Plate",
  make: "Make", model: "Model", color: "Color", year: "Year",
  rc_owner: "RC Owner", fuel_type: "Fuel Type", chassis_number: "Chassis No.",
  pet_name: "Pet Name", breed: "Breed", pet_color: "Color", pet_age: "Age",
  microchip: "Microchip No.", vet_name: "Vet Name", vet_phone: "Vet Phone",
  child_name: "Child Name", parent_name: "Parent Name", school: "School",
  blood_group: "Blood Group", allergies: "Allergies", medications: "Medications",
  doctor_name: "Doctor Name", hospital: "Hospital",
  owner_name: "Owner Name", address: "Address", city: "City",
  company: "Company", designation: "Designation", website: "Website",
  email: "Email", notes: "Notes", description: "Description",
  event_name: "Event Name", event_date: "Event Date", venue: "Venue",
  luggage_type: "Luggage Type", bag_color: "Bag Color",
  item_name: "Item Name", item_type: "Item Type",
  elder_name: "Elder Name", caregiver: "Caregiver", caregiver_phone: "Caregiver Phone",
  emergency_info: "Emergency Info",
};

/* ─────────────────────────────────────────────────
   PRIVACY SETTING DEFINITIONS (icon + label + desc)
   ───────────────────────────────────────────────── */
const PRIVACY_SETTING_DEFS = [
  { key: "allow_contact",   label: "Allow Contact",       desc: "Finders can request to contact the owner",       Icon: Phone,         color: "text-blue-500" },
  { key: "strict_mode",     label: "Strict Mode",         desc: "Only verified users can view contact info",      Icon: Lock,          color: "text-slate-500" },
  { key: "maskPhone",       label: "Mask Phone Number",   desc: "Phone calls routed via anonymous bridge",        Icon: Eye,           color: "text-indigo-500" },
  { key: "whatsappOnly",    label: "WhatsApp Only",       desc: "Finders can only send WhatsApp messages",        Icon: MessageCircle, color: "text-green-500" },
  { key: "videoCall",       label: "Allow Video Call",    desc: "Finder can request a live video call",           Icon: Video,         color: "text-violet-500" },
  { key: "emergencyPriority", label: "Emergency Priority", desc: "Immediate priority connection when scanned",    Icon: Zap,           color: "text-amber-500" },
] as const;

const PAGE_SIZE = 15;

interface QRPrivacy {
  maskPhone?: boolean; whatsappOnly?: boolean; videoCall?: boolean;
  emergencyPriority?: boolean; strictMode?: boolean;
}
interface QRRow {
  id: string; user_id: string; name: string; type: string; status: string;
  display_code: string | null; is_active: boolean | null; created_at: string;
  qr_url?: string | null; data?: Record<string, unknown> | null;
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
  const [urlCopied, setUrlCopied] = useState(false);

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
    let saveError: string | null = null;
    try {
      await adminUpdateQRCode(qr.id, updates);
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Unknown error";
    }
    setSaving(false);
    if (saveError) {
      setSaveMsg({ ok: false, text: `Failed to save: ${saveError}` });
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
      const fname = qr.display_code ? `stegofy-${qr.display_code}` : (qr.name || qr.id);
      a.download = `${fname}.png`;
      a.click();
    } catch { /* ignore */ }
  };

  const handleDownloadPDF = async () => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(qrPageUrl, {
        width: 512, margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const qrSize = 80;
      const qrX = (pageW - qrSize) / 2;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(0, 0, pageW, 297, 0, 0, "F");
      doc.addImage(dataUrl, "PNG", qrX, 40, qrSize, qrSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(qr.name || "QR Code", pageW / 2, 135, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(qrPageUrl, pageW / 2, 145, { align: "center", maxWidth: pageW - 40 });
      if (qr.display_code) {
        doc.setFontSize(8);
        doc.text(`Code: ${qr.display_code}`, pageW / 2, 155, { align: "center" });
      }
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by Stegofy — stegotags.stegofy.com", pageW / 2, 280, { align: "center" });
      const fname = qr.display_code ? `stegofy-${qr.display_code}` : (qr.name || qr.id);
      doc.save(`${fname}.pdf`);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: qr.name, url: qrPageUrl, text: `QR: ${qr.name}` });
        return;
      } catch { /* fall through */ }
    }
    navigator.clipboard.writeText(qrPageUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }).catch(() => { /* ignore */ });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrPageUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }).catch(() => { /* ignore */ });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-4xl max-h-[94vh] flex flex-col"
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

        {/* Two-column body */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

          {/* ── LEFT COLUMN (40%) — QR Visual ── */}
          <div className="sm:w-[40%] shrink-0 overflow-y-auto p-5 border-b sm:border-b-0 sm:border-r border-slate-100 flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white">
            {/* QR Image */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100">
                <QRImage url={qrPageUrl} size={160} />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Stegofy QR</p>
            </div>

            {/* URL chip — opens page on click + copy icon */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">QR Page URL</p>
              <div className="flex items-start gap-1 bg-white rounded-xl border border-slate-200 px-2 py-1.5 group">
                <a
                  href={qrPageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-xs font-mono text-primary break-all hover:underline"
                  title={qrPageUrl}
                >
                  {qrPageUrl}
                </a>
                <button
                  onClick={handleCopyUrl}
                  title="Copy URL"
                  className="shrink-0 p-0.5 rounded hover:bg-slate-100 transition-colors"
                >
                  {urlCopied
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <Copy className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  }
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleShare}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm flex-1 justify-center">
                <Share2 className="w-3 h-3" /> Share
              </button>
              <button onClick={handleDownloadQR}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm flex-1 justify-center">
                <Download className="w-3 h-3" /> PNG
              </button>
              <button onClick={handleDownloadPDF}
                className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl hover:bg-red-100 transition-colors flex-1 justify-center">
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>

            {/* Scan / code info */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400">Scans:</span>
              <span className="font-bold text-slate-700">{qr.scans ?? 0}</span>
              {qr.display_code && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{qr.display_code}</span>
                </>
              )}
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{qr.created_at ? new Date(qr.created_at).toLocaleDateString("en-IN") : "—"}</span>
            </div>
          </div>

          {/* ── RIGHT COLUMN (60%) — Details ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Section 1: Identity */}
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Identity</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{getTypeEmoji(qr.type)}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{qr.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{qr.type} QR Code</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  <Badge label={inactive ? "Inactive" : "Active"}
                    color={inactive ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"} />
                  <span className="text-[10px] text-slate-400">{qr.scans ?? 0} scans</span>
                </div>
              </div>
              {qr.display_code && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-200 px-2 py-0.5 rounded-lg">{qr.display_code}</span>
              )}
            </div>

            {/* Section 2: Owner */}
            {owner && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Owner</p>
                <div className="flex items-center gap-3">
                  <OwnerAvatar name={ownerName} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{ownerName}</p>
                    {owner.email && <p className="text-xs text-slate-500 truncate">{owner.email}</p>}
                    {owner.sgy_id && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">{owner.sgy_id}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(owner.sgy_id!)}
                          title="Copy SGY ID"
                          className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                        >
                          <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Contacts (view/edit) */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact Numbers</p>
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
                      <span className="text-sm font-semibold text-slate-800 font-mono">{val}</span>
                    </div>
                  ) : null)}
                  {!qr.primary_contact && !qr.secondary_phone && !qr.emergency_contact && (
                    <p className="text-xs text-slate-400 italic">No contact numbers set</p>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Privacy Settings */}
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
                <div className="space-y-2">
                  {PRIVACY_SETTING_DEFS.map(({ key, label, desc, Icon, color }) => {
                    const val = key === "allow_contact" ? qr.allow_contact
                      : key === "strict_mode" ? qr.strict_mode
                      : key === "maskPhone" ? (qr.privacy?.maskPhone)
                      : key === "whatsappOnly" ? (qr.privacy?.whatsappOnly ?? qr.whatsapp_enabled)
                      : key === "videoCall" ? (qr.privacy?.videoCall ?? qr.allow_video_call)
                      : qr.privacy?.emergencyPriority;
                    return (
                      <div key={key} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${val ? "bg-slate-100" : "bg-slate-50"}`}>
                          <Icon className={`w-3.5 h-3.5 ${val ? color : "text-slate-300"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${val ? "text-slate-800" : "text-slate-400"}`}>{label}</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${val ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                          {val ? "ON" : "OFF"}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-400">Privacy Mode:</span>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {({ show: "Show", mask: "Masked", whatsapp: "WhatsApp Only", emergency: "Emergency" } as Record<string, string>)[qr.privacy_mode || "show"] ?? (qr.privacy_mode || "Show")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: PIN Management */}
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">PIN Code</p>
                  <span className={`text-[11px] font-semibold font-mono ${qr.pin_code ? "text-green-600" : "text-slate-400"}`}>
                    {qr.pin_code ? qr.pin_code : "None"}
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

            {/* Section 6: QR Data Fields — dynamic key-value pairs from data JSONB */}
            {(() => {
              const data = qr.data;
              if (!data || typeof data !== "object") return null;
              const SKIP_KEYS = new Set(["photo", "image", "mask_phone", "whatsapp_only", "video_call",
                "emergency_priority", "strict_mode", "allow_contact", "maskPhone", "whatsappOnly",
                "videoCall", "emergencyPriority", "strictMode"]);
              const isPhone = (k: string) => /phone|contact|mobile|number/.test(k.toLowerCase());
              const entries = Object.entries(data).filter(([k, v]) =>
                !SKIP_KEYS.has(k) && v !== "" && v !== null && v !== undefined && typeof v !== "boolean"
              );
              if (entries.length === 0) return null;
              return (
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">QR Data Fields</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {entries.map(([key, value]) => {
                      const label = DATA_FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      const strVal = String(value);
                      const displayVal = strVal;
                      return (
                        <div key={key} className="col-span-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                          <p className="text-xs text-slate-700 font-medium truncate" title={strVal}>{displayVal}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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

            {/* Actions row (always visible, view mode) */}
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
                  onClick={() => { onDelete(qr.id); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Delete QR
                </button>
              </div>
            )}
          </div>
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
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<QRRow | null>(null);

  const hasLoaded = useRef(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([adminGetAllQRCodes(), adminGetAllUsers()])
      .then(([codes, users]) => {
        if (codes && (codes as QRRow[]).length > 0) setQrs(codes as QRRow[]);
        const map: Record<string, OwnerRow> = {};
        (users as OwnerRow[]).forEach((u) => { map[u.id] = u; });
        setUserMap(map);
      })
      .catch((err: unknown) => {
        console.error("[QRCodesScreen] Failed to load QR codes:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    reload();
  }, [reload]);

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

  const { toast } = useToast();
  const handleDisable = async (id: string) => {
    try {
      await adminDisableQRCode(id);
      toast({ title: "QR code disabled." });
      reload();
    } catch (e) {
      toast({
        title: "Disable failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };
  const handleEnable = async (id: string) => {
    try {
      await adminEnableQRCode(id);
      toast({ title: "QR code enabled." });
      reload();
    } catch (e) {
      toast({
        title: "Enable failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };
  const reauth = useReauthGuard();

  const handleDelete = (id: string) => {
    reauth.guard({
      title: "Delete QR code",
      description:
        "This permanently deletes the QR code and all its scan history. This cannot be undone.",
      confirmLabel: "Delete QR code",
      variant: "danger",
      successMessage: "QR code deleted.",
      run: async () => {
        await adminDeleteQRCode(id);
        reload();
      },
    });
  };
  const handleUpdated = (qrId: string, updates: Partial<QRRow>) => {
    setQrs((prev) => prev.map((q) => q.id === qrId ? { ...q, ...updates } : q));
  };

  return (
    <>
    {reauth.modal}
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, code, or owner…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} codes</span>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
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
                  ? [owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.email || "Unknown"
                  : "Unknown";
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
                          <Eye className="w-3.5 h-3.5" />
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
    </>
  );
}
