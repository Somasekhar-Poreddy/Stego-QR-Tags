import { useState, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Bell, MapPin, PhoneOff, PauseCircle,
  Phone, UserRound, Download, MessageSquare, PhoneCall, Upload,
  Video, WifiOff, CreditCard, RefreshCw, Pencil, Trash2, Check,
  AlertTriangle, QrCode, Eye, X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { QRCardDesign, QRCardDesignHandle } from "@/app/components/QRCardDesign";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ─── Supabase column map ────────────────────────────────────────────────── */
const COL: Partial<Record<keyof QRProfile, string>> = {
  isActive:               "is_active",
  allowContact:           "allow_contact",
  strictMode:             "strict_mode",
  whatsappEnabled:        "whatsapp_enabled",
  allowVideoCall:         "allow_video_call",
  secondaryPhone:         "secondary_phone",
  manageEmergencyContact: "emergency_contact",
  callMaskingDisabled:    "call_masking_disabled",
  status:                 "status",
};

/* ─── Per-type gradient ──────────────────────────────────────────────────── */
const TYPE_GRADIENT: Record<string, string> = {
  pet:        "from-rose-500 to-pink-600",
  vehicle:    "from-blue-600 to-cyan-600",
  child:      "from-green-500 to-emerald-600",
  medical:    "from-red-500 to-rose-600",
  luggage:    "from-indigo-500 to-purple-600",
  wallet:     "from-amber-500 to-orange-500",
  home:       "from-teal-500 to-cyan-600",
  event:      "from-fuchsia-500 to-purple-600",
  business:   "from-slate-600 to-slate-700",
  belongings: "from-amber-500 to-yellow-600",
};

/* ─── Primitive row components ───────────────────────────────────────────── */

function IconBox({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
      <span className={color}>{children}</span>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "w-12 h-6 rounded-full transition-all flex items-center px-1 flex-shrink-0",
        value ? "bg-primary justify-end" : "bg-slate-200 justify-start"
      )}
    >
      <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
    </button>
  );
}

function NewBadge() {
  return (
    <span className="text-[10px] font-extrabold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">
      New!
    </span>
  );
}

/* ─── Toggle card ────────────────────────────────────────────────────────── */
function ToggleCard({
  icon, label, hint, value, onChange,
  iconBg = "bg-blue-50", iconColor = "text-blue-600",
}: {
  icon: React.ReactNode; label: string; hint?: string; value: boolean;
  onChange: () => void; iconBg?: string; iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5">
      <IconBox bg={iconBg} color={iconColor}>{icon}</IconBox>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

/* ─── Arrow card ─────────────────────────────────────────────────────────── */
function ArrowCard({
  icon, label, hint, badge, onClick,
  iconBg = "bg-slate-100", iconColor = "text-slate-600", danger = false,
}: {
  icon: React.ReactNode; label: string; hint?: string; badge?: boolean;
  onClick: () => void; iconBg?: string; iconColor?: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
    >
      <IconBox bg={iconBg} color={iconColor}>{icon}</IconBox>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold leading-snug", danger ? "text-red-500" : "text-slate-800")}>
          {label}
        </p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {badge && <NewBadge />}
      <ChevronRight className={cn("w-4 h-4 flex-shrink-0", danger ? "text-red-300" : "text-slate-300")} />
    </button>
  );
}

/* ─── Inline-editable input card ─────────────────────────────────────────── */
function InputCard({
  icon, label, placeholder, value, onSave,
  iconBg = "bg-slate-100", iconColor = "text-slate-600",
}: {
  icon: React.ReactNode; label: string; placeholder?: string;
  value: string; onSave: (v: string) => void; iconBg?: string; iconColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5">
      <IconBox bg={iconBg} color={iconColor}>{icon}</IconBox>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 mb-0.5">{label}</p>
        {editing ? (
          <input
            autoFocus
            type="tel"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder={placeholder}
            className="w-full text-sm text-slate-900 bg-transparent outline-none border-b border-primary pb-0.5"
          />
        ) : (
          <p
            className={cn("text-sm leading-snug cursor-pointer", value ? "text-slate-800 font-medium" : "text-slate-400")}
            onClick={() => { setDraft(value); setEditing(true); }}
          >
            {value || placeholder || "Tap to add"}
          </p>
        )}
      </div>
      {!editing ? (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="text-[11px] font-semibold text-primary flex-shrink-0"
        >
          {value ? "Edit" : "Add"}
        </button>
      ) : (
        <button onClick={commit} className="text-[11px] font-semibold text-primary flex-shrink-0">Done</button>
      )}
    </div>
  );
}

/* ─── Empty-state bottom sheet ───────────────────────────────────────────── */
function EmptySheet({
  title, subtitle, icon, onClose,
}: {
  title: string; subtitle: string; icon: React.ReactNode; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              {icon}
            </div>
            <p className="text-sm font-semibold text-slate-700">No scan events yet</p>
            <p className="text-xs text-slate-400 text-center max-w-xs">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-2xl font-semibold text-sm active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete confirm sheet ───────────────────────────────────────────────── */
function DeleteSheet({
  name, onConfirm, onCancel,
}: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-base">Delete QR Profile?</p>
            <p className="text-xs text-slate-400">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          <span className="font-semibold">{name}</span> will be permanently deleted.
          The QR code will stop working immediately.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-700 font-semibold text-sm active:scale-95 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────────── */
export function ManageQRScreen({ profileId }: { profileId: string }) {
  const { profiles, updateProfile, deleteProfile } = useQR();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"manage" | "more">("manage");
  const [toast, setToast] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const qrCardRef = useRef<QRCardDesignHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = profiles.find((p) => p.id === profileId || p.qrId === profileId);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const isMock = !profile?.qrId || profile.qrId.startsWith("mock-");

  const save = async (field: keyof QRProfile, value: boolean | string) => {
    if (!profile) return;
    updateProfile(profile.id, { [field]: value } as Partial<QRProfile>);
    if (!isMock) {
      const col = COL[field];
      if (col) {
        const { error } = await supabase.from("qr_codes").update({ [col]: value }).eq("id", profile.qrId!);
        if (error) { console.warn("Save failed:", error.message); return; }
      }
    }
    showToast("Saved");
  };

  const handleDelete = async () => {
    if (!profile) return;
    if (!isMock) await supabase.from("qr_codes").delete().eq("id", profile.qrId!);
    deleteProfile(profile.id);
    navigate("/app/qr");
  };

  const handleDownloadETag = async () => {
    if (qrCardRef.current) {
      showToast("Preparing download…");
      await qrCardRef.current.download();
    } else {
      showToast("Card not ready yet");
    }
  };

  const handleUploadFiles = () => fileInputRef.current?.click();
  const handleFileSelected = () => showToast("File upload coming soon!");

  const handleFasTag = () => window.open("https://fastag.ihmcl.com/", "_blank");

  const handleReplacement = () => {
    const email = "support@stegofy.com";
    const subject = encodeURIComponent(`Tag replacement request — ${profile?.displayCode ?? profile?.name}`);
    const body = encodeURIComponent(`Hi,\n\nI'd like to request a replacement for my QR tag.\n\nTag: ${profile?.name}\nCode: ${profile?.displayCode ?? "—"}\n\nPlease let me know the next steps.\n\nThank you.`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    showToast("Replacement email opened!");
  };

  // Navigate to My QR and auto-open the EditModal for this profile via query param
  const handleEditTag = () => navigate(`/app/qr?edit=${profile?.id ?? ""}`);

  if (!profile) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-3">
        <QrCode className="w-10 h-10 text-slate-300" />
        <p className="text-slate-500 text-sm font-medium">QR profile not found</p>
        <button onClick={() => navigate("/app/qr")} className="text-primary text-sm font-semibold">Go back</button>
      </div>
    );
  }

  const gradient  = TYPE_GRADIENT[profile.type] ?? TYPE_GRADIENT.belongings;
  const isActive  = profile.isActive !== false;
  const callsOn   = profile.allowContact !== false;

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center px-4 py-3 gap-2">
        <button
          onClick={() => navigate("/app/qr")}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors -ml-1"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <p className="flex-1 text-center font-bold text-slate-900 text-base">Manage QR</p>
        <div className={cn(
          "px-2.5 py-1 rounded-full text-[11px] font-bold",
          isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        )}>
          {isActive ? "ACTIVE" : "INACTIVE"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* ── Hero card ────────────────────────────────────────────────── */}
        <div className={cn("bg-gradient-to-br px-6 py-6", gradient)}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-lg leading-tight truncate">{profile.name}</p>
              <p className="text-white/70 text-xs font-medium capitalize mt-0.5">{profile.type} tag</p>
              {profile.displayCode && (
                <p className="text-white/60 text-[11px] font-mono mt-1 tracking-widest">{profile.displayCode}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-green-300" : "bg-white/50")} />
              <span className="text-white text-[11px] font-semibold">{isActive ? "Live" : "Paused"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1.5">
              <PhoneCall className="w-3 h-3 text-white/80" />
              <span className="text-white text-[11px] font-semibold">{callsOn ? "Calls on" : "Calls off"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1.5">
              <Eye className="w-3 h-3 text-white/80" />
              <span className="text-white text-[11px] font-semibold">{profile.scans} scans</span>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-100 flex">
          <button
            onClick={() => setActiveTab("manage")}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-all",
              activeTab === "manage"
                ? "text-primary border-b-2 border-primary"
                : "text-slate-400 border-b-2 border-transparent"
            )}
          >
            Manage Tag
          </button>
          <button
            onClick={() => setActiveTab("more")}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-all",
              activeTab === "more"
                ? "text-primary border-b-2 border-primary"
                : "text-slate-400 border-b-2 border-transparent"
            )}
          >
            More
          </button>
        </div>

        {/* ── Tab content ──────────────────────────────────────────────── */}
        <div className="px-4 pt-4 space-y-3">

          {/* ═══ MANAGE TAG tab ═══════════════════════════════════════════ */}
          {activeTab === "manage" && (
            <>
              {/* 1. View Contact Page */}
              <ArrowCard
                icon={<MessageSquare className="w-4 h-4" />}
                label="View Contact Page"
                hint="How finders see your information"
                onClick={() => window.open(`${window.location.origin}/qr/${profile.qrId ?? profile.id}`, "_blank")}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />

              {/* 2. View Notifications */}
              <ArrowCard
                icon={<Bell className="w-4 h-4" />}
                label="View Notifications"
                hint="Recent alerts and scan events"
                onClick={() => setShowNotifs(true)}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />

              {/* 3. Check Scan Locations */}
              <ArrowCard
                icon={<MapPin className="w-4 h-4" />}
                label="Check Scan Locations"
                hint="See where your QR was scanned"
                onClick={() => setShowLocations(true)}
                iconBg="bg-rose-50"
                iconColor="text-rose-500"
              />

              {/* 4. Disable Calls — inverted toggle (ON = calls disabled) */}
              <ToggleCard
                icon={<PhoneOff className="w-4 h-4" />}
                label="Disable Calls"
                hint={callsOn ? "Finders can currently call you" : "All incoming calls are blocked"}
                value={!callsOn}
                onChange={() => save("allowContact", callsOn ? false : true)}
                iconBg="bg-red-50"
                iconColor="text-red-500"
              />

              {/* 5. Disable the Tag — inverted toggle (ON = tag disabled) */}
              <ToggleCard
                icon={<PauseCircle className="w-4 h-4" />}
                label="Disable the Tag"
                hint={isActive ? "Tag is live and scannable" : "Tag is paused — scanning disabled"}
                value={!isActive}
                onChange={() => save("isActive", isActive ? false : true)}
                iconBg="bg-slate-100"
                iconColor="text-slate-600"
              />

              {/* 6. Add Secondary Number */}
              <InputCard
                icon={<Phone className="w-4 h-4" />}
                label="Add Secondary Number"
                placeholder="+91 99999 00000"
                value={profile.secondaryPhone ?? ""}
                onSave={(v) => save("secondaryPhone", v)}
                iconBg="bg-green-50"
                iconColor="text-green-600"
              />

              {/* 7. Add Emergency Contact */}
              <InputCard
                icon={<UserRound className="w-4 h-4" />}
                label="Add Emergency Contact"
                placeholder="+91 99999 00000"
                value={profile.manageEmergencyContact ?? ""}
                onSave={(v) => save("manageEmergencyContact", v)}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
              />

              {/* 8. Download eTag */}
              <button
                onClick={handleDownloadETag}
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
              >
                <IconBox bg="bg-primary/10" color="text-primary">
                  <Download className="w-4 h-4" />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Download eTag</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">High-quality card for print or digital use</p>
                </div>
                <NewBadge />
                <Download className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            </>
          )}

          {/* ═══ MORE tab ═════════════════════════════════════════════════ */}
          {activeTab === "more" && (
            <>
              {/* 1. Enable WhatsApp Notifications */}
              <ToggleCard
                icon={<MessageSquare className="w-4 h-4" />}
                label="Enable WhatsApp Notifications"
                hint="Get notified on WhatsApp when QR is scanned"
                value={!!profile.whatsappEnabled}
                onChange={() => save("whatsappEnabled", !profile.whatsappEnabled)}
                iconBg="bg-green-50"
                iconColor="text-green-600"
              />

              {/* 2. Disable Call Masking */}
              <ToggleCard
                icon={<PhoneCall className="w-4 h-4" />}
                label="Disable Call Masking"
                hint={profile.callMaskingDisabled ? "Your number is visible to finders" : "Your number is hidden from finders"}
                value={!!profile.callMaskingDisabled}
                onChange={() => save("callMaskingDisabled", !profile.callMaskingDisabled)}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
              />

              {/* 3. Upload Files */}
              <button
                onClick={handleUploadFiles}
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
              >
                <IconBox bg="bg-violet-50" color="text-violet-600">
                  <Upload className="w-4 h-4" />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Upload Files</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Attach documents or photos to this tag</p>
                </div>
                <Upload className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

              {/* 4. Enable Video Call */}
              <ToggleCard
                icon={<Video className="w-4 h-4" />}
                label="Enable Video Call"
                hint="Allow finders to start a video call with you"
                value={!!profile.allowVideoCall}
                onChange={() => save("allowVideoCall", !profile.allowVideoCall)}
                iconBg="bg-fuchsia-50"
                iconColor="text-fuchsia-600"
              />

              {/* 5. Offline QR Download */}
              <button
                onClick={handleDownloadETag}
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
              >
                <IconBox bg="bg-amber-50" color="text-amber-600">
                  <WifiOff className="w-4 h-4" />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Offline QR Download</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Download the QR code for offline usage of your business card.</p>
                </div>
                <NewBadge />
                <Download className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>

              {/* 6. FasTag Recharge */}
              <ArrowCard
                icon={<CreditCard className="w-4 h-4" />}
                label="FasTag Recharge"
                hint="Recharge your vehicle FasTag via IHMCL"
                onClick={handleFasTag}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />

              {/* 7. Get a Tag Replacement */}
              <ArrowCard
                icon={<RefreshCw className="w-4 h-4" />}
                label="Get a Tag Replacement"
                hint="Request a physical tag replacement"
                onClick={handleReplacement}
                iconBg="bg-slate-100"
                iconColor="text-slate-600"
              />

              {/* 8. Edit and Rewrite Tag */}
              <ArrowCard
                icon={<Pencil className="w-4 h-4" />}
                label="Edit and Rewrite Tag"
                hint="Change the information stored on this tag"
                onClick={handleEditTag}
                iconBg="bg-red-50"
                iconColor="text-red-500"
                danger
              />

              {/* 9. Delete QR */}
              <ArrowCard
                icon={<Trash2 className="w-4 h-4" />}
                label="Delete This QR"
                hint="Permanently remove this profile"
                onClick={() => setShowDelete(true)}
                iconBg="bg-red-50"
                iconColor="text-red-500"
                danger
              />
            </>
          )}
        </div>

        {/* Hidden QRCardDesign for triggering downloads */}
        <div style={{ position: "absolute", left: -9999, top: -9999, pointerEvents: "none", opacity: 0 }}>
          <QRCardDesign ref={qrCardRef} profile={profile} showActions={false} />
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 whitespace-nowrap">
          <Check className="w-3.5 h-3.5 text-green-400" />
          {toast}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showNotifs && (
        <EmptySheet
          title="Notifications"
          subtitle="You'll see alerts here when someone scans your QR or tries to contact you."
          icon={<Bell className="w-8 h-8 text-slate-300" />}
          onClose={() => setShowNotifs(false)}
        />
      )}
      {showLocations && (
        <EmptySheet
          title="Scan Locations"
          subtitle="Locations will appear here each time your QR is scanned from a new place."
          icon={<MapPin className="w-8 h-8 text-slate-300" />}
          onClose={() => setShowLocations(false)}
        />
      )}
      {showDelete && (
        <DeleteSheet
          name={profile.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
