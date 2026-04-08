import { useState } from "react";
import { Plus, QrCode, Eye, Edit, Share2, Trash2, X, Check, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { FORM_SCHEMA, FieldDef, getFormLabel, getNameKey } from "@/app/lib/qrFormSchema";
import { QRCardDesign } from "@/app/components/QRCardDesign";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  pet: "from-rose-400 to-pink-400",
  vehicle: "from-blue-400 to-cyan-400",
  child: "from-green-400 to-emerald-400",
  medical: "from-red-400 to-orange-400",
  luggage: "from-indigo-400 to-purple-400",
  wallet: "from-amber-400 to-yellow-400",
  home: "from-teal-400 to-cyan-400",
  event: "from-fuchsia-400 to-pink-400",
  business: "from-slate-500 to-slate-400",
  belongings: "from-amber-400 to-orange-400",
};

const INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400";

/* ─── Reusable field renderer ─────────────────────────────────────────────── */
function EditField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (def.type === "photo") {
    return null;
  }

  if (def.type === "toggle") {
    const on = !!value;
    return (
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-800">{def.label}</p>
          {def.hint && <p className="text-xs text-slate-400 mt-0.5">{def.hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(!on)}
          className={cn(
            "w-12 h-6 rounded-full transition-all flex items-center px-1 flex-shrink-0",
            on ? "bg-primary justify-end" : "bg-slate-200 justify-start"
          )}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
        </button>
      </div>
    );
  }

  if (def.type === "dropdown") {
    return (
      <select
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLASS, "appearance-none cursor-pointer")}
      >
        <option value="">Select {def.label}</option>
        {def.options?.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (def.type === "textarea") {
    return (
      <textarea
        placeholder={def.placeholder}
        rows={3}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLASS, "resize-none")}
      />
    );
  }

  return (
    <input
      type={def.type === "tel" ? "tel" : def.type === "email" ? "email" : "text"}
      placeholder={def.placeholder}
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    />
  );
}

/* ─── View Modal ─────────────────────────────────────────────────────────── */
function ViewModal({ profile, onClose }: { profile: QRProfile; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
            <p className="text-xs text-slate-400 capitalize mt-0.5">
              {profile.type} · {profile.scans} scans · Created {profile.createdAt}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors -mr-1">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable content — premium card + download */}
        <div className="overflow-y-auto flex-1 px-4 py-5">
          <QRCardDesign profile={profile} showActions={true} />
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─────────────────────────────────────────────────────────── */
function EditModal({
  profile,
  onSave,
  onClose,
}: {
  profile: QRProfile;
  onSave: (updates: Partial<QRProfile>) => void;
  onClose: () => void;
}) {
  const schema = FORM_SCHEMA[profile.type];
  const [formData, setFormData] = useState<Record<string, string | boolean>>(profile.formData ?? {});
  const [status, setStatus] = useState<"active" | "inactive">(profile.status);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setField = (key: string, val: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nameKey = getNameKey(profile.type);
      const derivedName = (formData[nameKey] as string) || profile.name;

      const contactKeys = ["primary_phone", "owner_phone", "parent_phone", "emergency_contact", "contact_number", "phone"];
      const derivedContact = (contactKeys.map((k) => formData[k]).find(Boolean) as string) ?? profile.primaryContact;

      const updates: Partial<import("@/app/context/QRContext").QRProfile> = {
        formData,
        status,
        name: derivedName,
        primaryContact: derivedContact,
      };

      onSave(updates);

      // Persist to Supabase if this profile was synced from the server.
      // Skip only explicit mock placeholders; numeric Date.now() ids are harmless no-ops.
      const rowId = profile.qrId ?? profile.id;
      if (rowId && !rowId.startsWith("mock-")) {
        const { error } = await supabase.from("qr_codes").update({
          name: derivedName,
          status,
          primary_contact: derivedContact,
          notes: (formData.notes as string) || null,
          data: formData,
        }).eq("id", rowId);
        if (error) console.warn("Supabase update failed:", error.message);
      }
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const renderFields = (fields: FieldDef[]) =>
    fields
      .filter((f) => f.type !== "photo")
      .map((f) => (
        <div key={f.key}>
          {f.type !== "toggle" && (
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">{f.label}</label>
              {!f.required && <span className="text-[10px] text-slate-400">Optional</span>}
            </div>
          )}
          <EditField
            def={f}
            value={formData[f.key] ?? (f.type === "toggle" ? false : "")}
            onChange={(v) => setField(f.key, v)}
          />
        </div>
      ));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">{getFormLabel(profile.type)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors -mr-1">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {schema ? (
            <>
              {/* Essential fields */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Essential</p>
                {renderFields(schema.essential)}
              </div>

              {/* Important fields */}
              {schema.important.filter((f) => f.type !== "photo").length > 0 && (
                <div className="space-y-4 pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Additional Info <span className="text-slate-300 font-normal normal-case">Optional</span>
                  </p>
                  {renderFields(schema.important)}
                </div>
              )}

              {/* Advanced — collapsible */}
              {schema.advanced.filter((f) => f.type !== "photo").length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="w-full flex items-center justify-between py-3 border-t border-slate-100"
                  >
                    <span className="text-sm font-semibold text-slate-600">
                      {showAdvanced ? "Hide advanced details" : "Show advanced details"}
                    </span>
                    {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {showAdvanced && (
                    <div className="space-y-4 mt-2">
                      {renderFields(schema.advanced)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No fields available for this type.</p>
          )}

          {/* Status toggle — always shown */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">QR Status</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {status === "active" ? "Live and scannable" : "Paused — not scannable"}
              </p>
            </div>
            <button
              onClick={() => setStatus((s) => (s === "active" ? "inactive" : "active"))}
              className={cn(
                "w-12 h-6 rounded-full transition-all flex items-center px-1 flex-shrink-0",
                status === "active" ? "bg-green-500 justify-end" : "bg-slate-200 justify-start"
              )}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        </div>

        {/* Sticky Save button */}
        <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── QR Card ────────────────────────────────────────────────────────────── */
function QRCard({
  profile,
  onDelete,
  onUpdate,
}: {
  profile: QRProfile;
  onDelete: () => void;
  onUpdate: (updates: Partial<QRProfile>) => void;
}) {
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const qrUrl = profile.qrUrl ?? `${window.location.origin}/qr/${profile.qrId ?? profile.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Stegofy QR — ${profile.name}`, text: "Scan to contact me safely", url: qrUrl });
        return;
      } catch (_) {}
    }
    await navigator.clipboard.writeText(qrUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className={cn("bg-gradient-to-br h-16 relative flex items-center px-4", TYPE_COLORS[profile.type] || "from-slate-400 to-slate-300")}>
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-bold text-white">{profile.name}</p>
            <p className="text-xs text-white/70 capitalize">{profile.type}</p>
          </div>
          <div className={cn("ml-auto w-2 h-2 rounded-full", profile.status === "active" ? "bg-green-300" : "bg-white/50")} />
        </div>

        <div className="px-4 py-2.5 flex items-center gap-4 border-b border-slate-50">
          <div>
            <p className="text-[10px] text-slate-400">Scans</p>
            <p className="text-sm font-bold text-slate-800">{profile.scans}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Privacy</p>
            <p className="text-xs font-semibold text-slate-700 capitalize">{profile.privacyMode}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Created</p>
            <p className="text-xs font-semibold text-slate-700">{profile.createdAt}</p>
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setShowView(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={handleShare}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform",
              shareCopied ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
            )}
          >
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {shareCopied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={onDelete}
            className="p-2 bg-red-50 text-red-500 rounded-xl active:scale-95 transition-transform"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showView && <ViewModal profile={profile} onClose={() => setShowView(false)} />}
      {showEdit && (
        <EditModal
          profile={profile}
          onSave={onUpdate}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export function MyQRScreen() {
  const { profiles, deleteProfile, updateProfile } = useQR();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="My QR Profiles" showNotification={false} />

      <div className="px-4 pt-4 pb-4 space-y-3">
        {profiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <p className="text-slate-700 font-semibold mb-1">No QR profiles yet</p>
            <p className="text-xs text-slate-400 mb-5">Create your first QR profile to get started</p>
          </div>
        ) : (
          profiles.map((p) => (
            <QRCard
              key={p.id}
              profile={p}
              onDelete={() => deleteProfile(p.id)}
              onUpdate={(updates) => updateProfile(p.id, updates)}
            />
          ))
        )}

        <button
          onClick={() => navigate("/app/qr/create")}
          className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-4 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> Create New QR
        </button>
      </div>
    </div>
  );
}
