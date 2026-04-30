import { useState } from "react";
import {
  ChevronLeft, Check, ChevronDown, ChevronUp,
  Camera, Phone, Shield, Eye, MessageCircle, Zap, Lock, Video,
} from "lucide-react";
import { useLocation } from "wouter";
import { v4 as uuidv4 } from "uuid";
import { useQR, QRType } from "@/app/context/QRContext";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  FORM_SCHEMA, FieldDef, getFormLabel, getNameKey,
} from "@/app/lib/qrFormSchema";

/* ─── Type picker data ─── */
interface TypeDef {
  id: QRType; label: string; emoji: string; desc: string; bg: string;
}

const PRIMARY_TYPES: TypeDef[] = [
  { id: "vehicle",    label: "Vehicle",    emoji: "🚗", desc: "Car, bike, truck",     bg: "bg-blue-50" },
  { id: "pet",        label: "Pet",        emoji: "🐾", desc: "Dog, cat, bird",       bg: "bg-rose-50" },
  { id: "child",      label: "Child",      emoji: "👦", desc: "School bag, ID card",  bg: "bg-green-50" },
  { id: "medical",    label: "Medical",    emoji: "🏥", desc: "Health records",       bg: "bg-red-50" },
  { id: "belongings", label: "Belongings", emoji: "🎒", desc: "Bag, gadget, item",    bg: "bg-amber-50" },
  { id: "home",       label: "Home",       emoji: "🏠", desc: "Gate, door, mailbox",  bg: "bg-teal-50" },
];

const SECONDARY_TYPES: TypeDef[] = [
  { id: "luggage",  label: "Luggage",      emoji: "🧳", desc: "Travel bags, cases",  bg: "bg-indigo-50" },
  { id: "wallet",   label: "Wallet / Key", emoji: "👛", desc: "Wallet, keys, purse", bg: "bg-violet-50" },
  { id: "event",    label: "Event",        emoji: "🎫", desc: "Events, souvenirs",   bg: "bg-fuchsia-50" },
  { id: "business", label: "NFC Card",     emoji: "💼", desc: "Business / contact",  bg: "bg-slate-50" },
];

/* ─── Privacy toggle config ─── */
interface PrivacyToggle {
  key: string; label: string; desc: string; icon: React.ElementType; color: string;
}
const PRIVACY_TOGGLES: PrivacyToggle[] = [
  { key: "maskPhone",         label: "Mask Phone Number",   desc: "Finder calls via anonymous bridge",      icon: Eye,           color: "text-blue-500 bg-blue-50" },
  { key: "whatsappOnly",      label: "WhatsApp Only",       desc: "Finder can only message, not call",      icon: MessageCircle, color: "text-green-500 bg-green-50" },
  { key: "videoCall",         label: "Allow Video Call",    desc: "Finder can request a live video call",   icon: Video,         color: "text-violet-500 bg-violet-50" },
  { key: "emergencyPriority", label: "Emergency Priority",  desc: "Immediate connection when scanned",      icon: Zap,           color: "text-amber-500 bg-amber-50" },
  { key: "strictMode",        label: "Strict Mode",         desc: "Only verified users can view info",      icon: Lock,          color: "text-slate-500 bg-slate-50" },
];

/* ─── Reusable input field ─── */
function Field({
  def, value, onChange, error,
}: {
  def: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  error?: string;
}) {
  const base = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400";

  if (def.type === "photo") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 cursor-pointer active:scale-95 transition-transform">
          <Camera className="w-7 h-7 text-slate-400" />
        </div>
        <span className="text-xs text-slate-400">Tap to upload photo</span>
      </div>
    );
  }

  if (def.type === "toggle") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">{def.label}</p>
          {def.hint && <p className="text-xs text-slate-400 mt-0.5">{def.hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            "w-12 h-6 rounded-full transition-all flex items-center px-1",
            value ? "bg-primary justify-end" : "bg-slate-200 justify-start"
          )}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
        </button>
      </div>
    );
  }

  if (def.type === "dropdown") {
    return (
      <div>
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={cn(base, "appearance-none cursor-pointer")}
        >
          <option value="">Select {def.label}</option>
          {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  if (def.type === "textarea") {
    return (
      <div>
        <textarea
          placeholder={def.placeholder}
          rows={3}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={cn(base, "resize-none")}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <input
        type={def.type === "tel" ? "tel" : def.type === "email" ? "email" : "text"}
        placeholder={def.placeholder}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/* ─── Section of form fields ─── */
function FieldSection({
  title, badge, fields, formData, setField, errors,
}: {
  title: string;
  badge?: string;
  fields: FieldDef[];
  formData: Record<string, string | boolean>;
  setField: (key: string, val: string | boolean) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        {badge && (
          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      {fields.map((f) => (
        <div key={f.key}>
          {f.type !== "toggle" && f.type !== "photo" && (
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">{f.label}</label>
              {!f.required && <span className="text-[10px] text-slate-400">Optional</span>}
            </div>
          )}
          <Field
            def={f}
            value={formData[f.key] ?? (f.type === "toggle" ? false : "")}
            onChange={(v) => setField(f.key, v)}
            error={errors[f.key]}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Type card ─── */
function TypeCard({
  t, selected, onSelect,
}: {
  t: TypeDef; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-2 pt-4 pb-3.5 px-2 rounded-2xl border-2 transition-all active:scale-95",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-slate-100 bg-white shadow-sm"
      )}
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl", selected ? "bg-primary/10" : t.bg)}>
        {t.emoji}
      </div>
      <div className="text-center">
        <p className={cn("text-xs font-bold leading-tight", selected ? "text-primary" : "text-slate-800")}>{t.label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.desc}</p>
      </div>
      {selected && (
        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

/* ─── Main screen ─── */
export function CreateQRScreen() {
  const [, navigate] = useLocation();
  const { addProfile } = useQR();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [type, setType] = useState<QRType | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({
    maskPhone: true,
    whatsappOnly: false,
    videoCall: false,
    emergencyPriority: false,
    strictMode: false,
  });
  const [saving, setSaving] = useState(false);

  const setField = (key: string, val: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const schema = type ? FORM_SCHEMA[type] : null;

  const validate = (): boolean => {
    if (!schema) return false;
    const newErrors: Record<string, string> = {};
    schema.essential.forEach((f) => {
      if (f.required && !formData[f.key]) {
        newErrors[f.key] = `${f.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 2 && !validate()) return;
    setStep((s) => s + 1);
  };

  const handleFinish = async () => {
    if (!type || !schema) return;
    setSaving(true);
    try {
      const qrId = uuidv4();
      const qrUrl = `${window.location.origin}/qr/${qrId}`;
      const nameKey = getNameKey(type);
      const displayName = (formData[nameKey] as string) || `My ${type} tag`;

      const contactKeys = ["primary_phone", "owner_phone", "parent_phone", "emergency_contact", "contact_number", "phone"];
      const primaryContact = (contactKeys.map((k) => formData[k]).find(Boolean) as string) ?? "";

      const privacyMode = privacy.emergencyPriority
        ? "emergency"
        : privacy.whatsappOnly
        ? "whatsapp"
        : privacy.maskPhone
        ? "mask"
        : "show";

      // Generate unique display code and 4-digit security PIN
      const pinCode = String(Math.floor(1000 + Math.random() * 9000));
      const displayCode = "STG-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      const profile = addProfile({
        name: displayName,
        type,
        status: "active",
        primaryContact,
        notes: (formData.notes as string) || undefined,
        privacyMode: privacyMode as "show" | "mask" | "whatsapp" | "emergency",
        formData,
        qrUrl,
        qrId,
        pinCode,
        displayCode,
      });

      void profile;

      if (user) {
        await supabase.from("qr_codes").insert({
          id: qrId,
          user_id: user.id,
          name: displayName,
          type,
          status: "active",
          primary_contact: primaryContact,
          privacy_mode: privacyMode,
          pin_code: pinCode,
          display_code: displayCode,
          data: formData,
          qr_url: qrUrl,
          privacy,
        }).then(({ error }) => {
          if (error) console.warn("Supabase save failed:", error.message);
        });
      }

      navigate("/app/qr/success");
    } finally {
      setSaving(false);
    }
  };

  const canContinue = step === 1 ? !!type : true;

  return (
    <div className="min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
        <button
          onClick={() => (step === 1 ? navigate("/app/qr") : setStep((s) => s - 1))}
          className="p-1.5 rounded-xl hover:bg-slate-100 active:scale-90 transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-900">Create QR Profile</h1>
          <p className="text-xs text-slate-400">Step {step} of 4</p>
        </div>
        {type && (
          <div className="text-xl">{[...PRIMARY_TYPES, ...SECONDARY_TYPES].find((t) => t.id === type)?.emoji}</div>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-4 pt-3 pb-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn("h-1.5 flex-1 rounded-full transition-all duration-300", s <= step ? "bg-primary" : "bg-slate-100")}
          />
        ))}
      </div>

      <div className="flex-1 px-4 pt-2 pb-6 overflow-y-auto">

        {/* ─── Step 1: Type picker ─── */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">What are you protecting?</h2>
            <p className="text-sm text-slate-500 mb-5">Choose the type that best fits your item</p>

            <div className="grid grid-cols-3 gap-3 mb-3">
              {PRIMARY_TYPES.map((t) => (
                <TypeCard key={t.id} t={t} selected={type === t.id} onSelect={() => setType(t.id)} />
              ))}
            </div>

            <button
              onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
            >
              {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMore ? "Show less" : "More types"}
            </button>

            {showMore && (
              <div className="grid grid-cols-4 gap-2 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {SECONDARY_TYPES.map((t) => (
                  <TypeCard key={t.id} t={t} selected={type === t.id} onSelect={() => setType(t.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Dynamic form ─── */}
        {step === 2 && schema && (
          <div className="space-y-7">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-0.5">
                {getFormLabel(type!)}
              </h2>
              <p className="text-sm text-slate-500">Fill in the details for this QR profile</p>
            </div>

            {/* Essential */}
            <FieldSection
              title="Essential"
              fields={schema.essential}
              formData={formData}
              setField={setField}
              errors={errors}
            />

            {/* Important */}
            {schema.important.length > 0 && (
              <FieldSection
                title="Important"
                badge="Optional"
                fields={schema.important}
                formData={formData}
                setField={setField}
                errors={errors}
              />
            )}

            {/* Advanced — collapsible */}
            {schema.advanced.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between py-3 border-t border-slate-100"
                >
                  <span className="text-sm font-semibold text-slate-600">
                    {showAdvanced ? "Hide additional details" : "Add more details"}
                  </span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {showAdvanced && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <FieldSection
                      title="Advanced"
                      badge="Optional"
                      fields={schema.advanced}
                      formData={formData}
                      setField={setField}
                      errors={errors}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 3: Privacy ─── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-0.5">Privacy Settings</h2>
              <p className="text-sm text-slate-500">Control how finders contact you</p>
            </div>

            <div className="space-y-3">
              {PRIVACY_TOGGLES.map((pt) => {
                const Icon = pt.icon;
                const on = !!privacy[pt.key];
                return (
                  <div
                    key={pt.key}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                      on ? "border-primary/30 bg-primary/5" : "border-slate-100 bg-slate-50"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", pt.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", on ? "text-slate-900" : "text-slate-700")}>{pt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{pt.desc}</p>
                    </div>
                    <button
                      onClick={() => setPrivacy((prev) => ({ ...prev, [pt.key]: !on }))}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all flex items-center px-1 flex-shrink-0",
                        on ? "bg-primary justify-end" : "bg-slate-200 justify-start"
                      )}
                    >
                      <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Your privacy is protected</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Masked numbers are routed through StegoTags' secure bridge. Finders see only what you allow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 4: Review & Generate ─── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-violet-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">
                  {[...PRIMARY_TYPES, ...SECONDARY_TYPES].find((t) => t.id === type)?.emoji}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Ready to Generate!</h2>
              <p className="text-sm text-slate-500">Review your profile before generating</p>
            </div>

            <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100 overflow-hidden border border-slate-100">
              {[
                { label: "Type", value: type?.charAt(0).toUpperCase() + (type?.slice(1) ?? "") },
                { label: "Name", value: (formData[getNameKey(type!)] as string) || `My ${type} tag` },
                {
                  label: "Privacy",
                  value: privacy.emergencyPriority
                    ? "Emergency Priority"
                    : privacy.whatsappOnly
                    ? "WhatsApp Only"
                    : privacy.maskPhone
                    ? "Masked Number"
                    : "Show Number",
                },
                {
                  label: "Mask Phone",
                  value: privacy.maskPhone ? "Yes" : "No",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-bold text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex gap-3 items-start">
                <Phone className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  A unique QR code and secure link will be created. Anyone who scans it can contact you safely — no personal info exposed unless you choose to share it.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-4 border-t border-slate-100 bg-white">
        <button
          onClick={step < 4 ? handleNext : handleFinish}
          disabled={!canContinue || saving}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : step === 4 ? (
            "Generate QR Code"
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}
