import { useState } from "react";
import { X, Save, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  FORM_SCHEMA,
  type FieldDef,
  getFormLabel,
  getNameKey,
} from "@/app/lib/qrFormSchema";
import type { QRProfile } from "@/app/context/QRContext";

const INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400";

const CONTACT_KEYS = [
  "primary_phone",
  "owner_phone",
  "parent_phone",
  "emergency_contact",
  "contact_number",
  "phone",
];

function EditField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (def.type === "photo") return null;

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
            on ? "bg-primary justify-end" : "bg-slate-200 justify-start",
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
          <option key={o} value={o}>
            {o}
          </option>
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

export function EditQRModal({
  profile,
  onSave,
  onClose,
  showStatusToggle = true,
}: {
  profile: QRProfile;
  onSave: (updates: Partial<QRProfile>) => void;
  onClose: () => void;
  showStatusToggle?: boolean;
}) {
  const schema = FORM_SCHEMA[profile.type];
  const [formData, setFormData] = useState<Record<string, string | boolean>>(
    profile.formData ?? {},
  );
  const [status, setStatus] = useState<"active" | "inactive">(profile.status);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, val: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const nameKey = getNameKey(profile.type);
      const derivedName = (formData[nameKey] as string) || profile.name;
      const derivedContact =
        (CONTACT_KEYS.map((k) => formData[k]).find(Boolean) as string) ??
        profile.primaryContact;

      const updates: Partial<QRProfile> = {
        formData,
        ...(showStatusToggle ? { status } : {}),
        name: derivedName,
        primaryContact: derivedContact,
      };

      const rowId = profile.qrId ?? profile.id;
      if (rowId && !rowId.startsWith("mock-")) {
        const payload: Record<string, unknown> = {
          name: derivedName,
          primary_contact: derivedContact,
          notes: (formData.notes as string) || null,
          data: formData,
        };
        if (showStatusToggle) payload.status = status;
        const { error: upErr } = await supabase
          .from("qr_codes")
          .update(payload)
          .eq("id", rowId);
        if (upErr) {
          setError(upErr.message);
          return;
        }
      }

      onSave(updates);
      onClose();
    } finally {
      setSaving(false);
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
              {!f.required && (
                <span className="text-[10px] text-slate-400">Optional</span>
              )}
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
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">{getFormLabel(profile.type)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors -mr-1"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {schema ? (
            <>
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Essential
                </p>
                {renderFields(schema.essential)}
              </div>

              {schema.important.filter((f) => f.type !== "photo").length > 0 && (
                <div className="space-y-4 pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Additional Info{" "}
                    <span className="text-slate-300 font-normal normal-case">Optional</span>
                  </p>
                  {renderFields(schema.important)}
                </div>
              )}

              {schema.advanced.filter((f) => f.type !== "photo").length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="w-full flex items-center justify-between py-3 border-t border-slate-100"
                  >
                    <span className="text-sm font-semibold text-slate-600">
                      {showAdvanced ? "Hide advanced details" : "Show advanced details"}
                    </span>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  {showAdvanced && (
                    <div className="space-y-4 mt-2">{renderFields(schema.advanced)}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">
              No fields available for this type.
            </p>
          )}

          {showStatusToggle && (
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
                  status === "active" ? "bg-green-500 justify-end" : "bg-slate-200 justify-start",
                )}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

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
