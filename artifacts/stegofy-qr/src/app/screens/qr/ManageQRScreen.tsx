import { useState, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Shield, Phone, Bell,
  Video, Download, Trash2, ExternalLink, Check,
  AlertTriangle, PhoneCall, QrCode, Eye, Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ─── Column name map for Supabase updates ────────────────────────────────── */
const COL: Partial<Record<keyof QRProfile, string>> = {
  isActive:               "is_active",
  allowContact:           "allow_contact",
  strictMode:             "strict_mode",
  whatsappEnabled:        "whatsapp_enabled",
  allowVideoCall:         "allow_video_call",
  secondaryPhone:         "secondary_phone",
  manageEmergencyContact: "emergency_contact",
  status:                 "status",
};

/* ─── Gradient per type ───────────────────────────────────────────────────── */
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

/* ─── Reusable section wrapper ────────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">{label}</p>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
        {children}
      </div>
    </div>
  );
}

/* ─── Toggle row ──────────────────────────────────────────────────────────── */
function ToggleRow({
  icon, label, hint, value, onChange, iconBg = "bg-blue-50", iconColor = "text-blue-600",
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "w-12 h-6 rounded-full transition-all flex items-center px-1 flex-shrink-0",
          value ? "bg-primary justify-end" : "bg-slate-200 justify-start"
        )}
      >
        <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
      </button>
    </div>
  );
}

/* ─── Arrow row (navigation) ──────────────────────────────────────────────── */
function ArrowRow({
  icon, label, hint, onClick, iconBg = "bg-slate-100", iconColor = "text-slate-600", danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  iconBg?: string;
  iconColor?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold leading-snug", danger ? "text-red-500" : "text-slate-800")}>
          {label}
        </p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <ChevronRight className={cn("w-4 h-4 flex-shrink-0", danger ? "text-red-300" : "text-slate-300")} />
    </button>
  );
}

/* ─── Editable input row ──────────────────────────────────────────────────── */
function InputRow({
  icon, label, placeholder, value, onSave, iconBg = "bg-slate-100", iconColor = "text-slate-600",
}: {
  icon: React.ReactNode;
  label: string;
  placeholder?: string;
  value: string;
  onSave: (v: string) => void;
  iconBg?: string;
  iconColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 mb-0.5">{label}</p>
        {editing ? (
          <input
            ref={inputRef}
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
      {!editing && (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="text-[11px] font-semibold text-primary"
        >
          {value ? "Edit" : "Add"}
        </button>
      )}
      {editing && (
        <button onClick={commit} className="text-[11px] font-semibold text-primary">
          Done
        </button>
      )}
    </div>
  );
}

/* ─── Delete confirmation dialog ──────────────────────────────────────────── */
function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
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
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-700 font-semibold text-sm active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Screen ─────────────────────────────────────────────────────────── */
export function ManageQRScreen({ profileId }: { profileId: string }) {
  const { profiles, updateProfile, deleteProfile } = useQR();
  const [, navigate] = useLocation();
  const [toast, setToast] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const profile = profiles.find((p) => p.id === profileId || p.qrId === profileId);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const isMock = !profile?.qrId || profile.qrId.startsWith("mock-");

  // Save a single field to Supabase + local context
  const save = async (field: keyof QRProfile, value: boolean | string) => {
    if (!profile) return;
    updateProfile(profile.id, { [field]: value } as Partial<QRProfile>);
    if (!isMock) {
      const col = COL[field];
      if (col) {
        const { error } = await supabase
          .from("qr_codes")
          .update({ [col]: value })
          .eq("id", profile.qrId!);
        if (error) { console.warn("Save failed:", error.message); return; }
      }
    }
    showToast("Saved");
  };

  const handleDelete = async () => {
    if (!profile) return;
    if (!isMock) {
      await supabase.from("qr_codes").delete().eq("id", profile.qrId!);
    }
    deleteProfile(profile.id);
    navigate("/app/qr");
  };

  const handleShareLink = async () => {
    const url = profile?.qrUrl ?? `${window.location.origin}/qr/${profile?.qrId}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Stegofy — ${profile?.name}`, url }); return; } catch (_) {}
    }
    await navigator.clipboard.writeText(url);
    showToast("Link copied!");
  };

  if (!profile) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-3">
        <QrCode className="w-10 h-10 text-slate-300" />
        <p className="text-slate-500 text-sm font-medium">QR profile not found</p>
        <button onClick={() => navigate("/app/qr")} className="text-primary text-sm font-semibold">
          Go back
        </button>
      </div>
    );
  }

  const gradient = TYPE_GRADIENT[profile.type] ?? TYPE_GRADIENT.belongings;
  const isActive = profile.isActive !== false;
  const allowContact = profile.allowContact !== false;

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
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

      <div className="flex-1 overflow-y-auto pb-8">
        {/* ── Hero card ───────────────────────────────────────────────── */}
        <div className={cn("bg-gradient-to-br px-6 py-7", gradient)}>
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

          <div className="flex items-center gap-3 mt-5">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-green-300" : "bg-white/50")} />
              <span className="text-white text-[11px] font-semibold">{isActive ? "Live" : "Paused"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
              <PhoneCall className="w-3 h-3 text-white/80" />
              <span className="text-white text-[11px] font-semibold">{allowContact ? "Calls active" : "Calls off"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
              <Eye className="w-3 h-3 text-white/80" />
              <span className="text-white text-[11px] font-semibold">{profile.scans} scans</span>
            </div>
          </div>
        </div>

        {/* ── Settings sections ────────────────────────────────────────── */}
        <div className="px-4 pt-5">

          {/* Quick controls */}
          <Section label="Quick Controls">
            <ToggleRow
              icon={<Zap className="w-4 h-4" />}
              label="QR Tag Active"
              hint={isActive ? "Tag is live and scannable" : "Tag is paused — not scannable"}
              value={isActive}
              onChange={(v) => save("isActive", v)}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
          </Section>

          {/* Contact & Access */}
          <Section label="Contact & Access">
            <ArrowRow
              icon={<ExternalLink className="w-4 h-4" />}
              label="View Contact Page"
              hint="How finders see your info"
              onClick={() => window.open(`${window.location.origin}/qr/${profile.qrId ?? profile.id}`, "_blank")}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <InputRow
              icon={<Phone className="w-4 h-4" />}
              label="Secondary Phone"
              placeholder="+91 99999 00000"
              value={profile.secondaryPhone ?? ""}
              onSave={(v) => save("secondaryPhone", v)}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
            <InputRow
              icon={<Shield className="w-4 h-4" />}
              label="Emergency Contact"
              placeholder="+91 99999 00000"
              value={profile.manageEmergencyContact ?? ""}
              onSave={(v) => save("manageEmergencyContact", v)}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
          </Section>

          {/* Safety settings */}
          <Section label="Safety Settings">
            <ToggleRow
              icon={<PhoneCall className="w-4 h-4" />}
              label="Allow Contact Requests"
              hint="Finders can call or message you"
              value={profile.allowContact !== false}
              onChange={(v) => save("allowContact", v)}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <ToggleRow
              icon={<Shield className="w-4 h-4" />}
              label="Strict Mode"
              hint="Only verified emergency requests allowed"
              value={!!profile.strictMode}
              onChange={(v) => save("strictMode", v)}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
            <ToggleRow
              icon={<Bell className="w-4 h-4" />}
              label="WhatsApp Notifications"
              hint="Get notified when QR is scanned"
              value={!!profile.whatsappEnabled}
              onChange={(v) => save("whatsappEnabled", v)}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <ToggleRow
              icon={<Video className="w-4 h-4" />}
              label="Enable Video Call"
              hint="Allow finders to start a video call"
              value={!!profile.allowVideoCall}
              onChange={(v) => save("allowVideoCall", v)}
              iconBg="bg-fuchsia-50"
              iconColor="text-fuchsia-600"
            />
          </Section>

          {/* QR Card */}
          <Section label="QR Card">
            <ArrowRow
              icon={<Download className="w-4 h-4" />}
              label="Download QR Card"
              hint="High-quality card for printing or digital use"
              onClick={() => navigate("/app/qr")}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
            />
            <ArrowRow
              icon={<ExternalLink className="w-4 h-4" />}
              label="Share QR Link"
              hint="Copy or share the scannable link"
              onClick={handleShareLink}
              iconBg="bg-primary/10"
              iconColor="text-primary"
            />
          </Section>

          {/* Danger zone */}
          <Section label="Danger Zone">
            <ArrowRow
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete This QR"
              hint="Permanently remove this profile"
              onClick={() => setShowDelete(true)}
              iconBg="bg-red-50"
              iconColor="text-red-500"
              danger
            />
          </Section>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-3.5 h-3.5 text-green-400" />
          {toast}
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      {showDelete && (
        <DeleteDialog
          name={profile.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
