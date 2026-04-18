import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Loader2, KeyRound, ArrowRight, ArrowLeft, Shield, Sparkles,
  LogIn, UserPlus, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQR, type QRType } from "@/app/context/QRContext";
import { cn } from "@/lib/utils";
import {
  FORM_SCHEMA, type FieldDef, getNameKey, getFormLabel,
} from "@/app/lib/qrFormSchema";

type Step = "auth" | "verify" | "details" | "privacy" | "review" | "submitting";

type PrivacyKey = "show" | "mask" | "whatsapp" | "emergency";

const PRIVACY_OPTIONS: { key: PrivacyKey; label: string; hint: string }[] = [
  { key: "mask",      label: "Masked contact",   hint: "Finder can request to contact — your number stays private." },
  { key: "show",      label: "Show contact",     hint: "Display your phone number directly on the public page." },
  { key: "whatsapp",  label: "WhatsApp only",    hint: "Open a WhatsApp chat with you when scanned." },
  { key: "emergency", label: "Emergency only",   hint: "Contact visible only when the finder marks it an emergency." },
];

const CONTACT_KEYS = ["primary_phone", "owner_phone", "parent_phone", "emergency_contact", "contact_number", "phone"];

function readQueryParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key)?.trim() ?? "";
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function extractNameAndContact(type: QRType, formData: Record<string, string | boolean>) {
  const nameKey = getNameKey(type);
  const name = (formData[nameKey] as string | undefined)?.trim() || `My ${type} tag`;
  const contact = (CONTACT_KEYS.map((k) => formData[k]).find(Boolean) as string | undefined) ?? "";
  return { name, contact };
}

function progressLabel(step: Step): { current: number; total: number; label: string } {
  const map: Record<Step, { current: number; label: string }> = {
    auth:       { current: 0, label: "Sign in" },
    verify:     { current: 1, label: "Verify sticker" },
    details:    { current: 2, label: "Fill in details" },
    privacy:    { current: 3, label: "Privacy" },
    review:     { current: 4, label: "Review" },
    submitting: { current: 4, label: "Activating…" },
  };
  return { total: 4, ...map[step] };
}

/* ── Inline field renderer (mirrors CreateQRScreen — no photo support during claim) ── */
function ClaimField({
  def, value, onChange, error,
}: {
  def: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  error?: string;
}) {
  const base = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400";

  if (def.type === "photo") return null;

  if (def.type === "toggle") {
    const on = value as boolean;
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">{def.label}</p>
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

function FieldGroup({
  title, badge, fields, formData, setField, errors,
}: {
  title: string;
  badge?: string;
  fields: FieldDef[];
  formData: Record<string, string | boolean>;
  setField: (key: string, val: string | boolean) => void;
  errors: Record<string, string>;
}) {
  const visibleFields = fields.filter((f) => f.type !== "photo");
  if (visibleFields.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        {badge && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {visibleFields.map((f) => (
        <div key={f.key}>
          {f.type !== "toggle" && (
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">{f.label}</label>
              {!f.required && <span className="text-[10px] text-slate-400">Optional</span>}
            </div>
          )}
          <ClaimField
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

/* ── Header chip showing verified sticker code ── */
function VerifiedChip({ code, type }: { code: string; type: QRType }) {
  return (
    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide">Sticker verified</p>
          <p className="font-mono text-xs font-bold text-slate-800">{code.toUpperCase()}</p>
        </div>
      </div>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize">{type}</span>
    </div>
  );
}

/* ── Main component ── */
export function ClaimQRScreen() {
  const [, navigate] = useLocation();
  const { addProfile } = useQR();

  const [step, setStep] = useState<Step>("verify");
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayCode, setDisplayCode] = useState(() => readQueryParam("code").toUpperCase());
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [inventoryType, setInventoryType] = useState<QRType>("belongings");

  const [formData, setFormDataState] = useState<Record<string, string | boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showImportant, setShowImportant] = useState(true);

  const [privacy, setPrivacy] = useState<PrivacyKey>("mask");

  useEffect(() => {
    sessionStorage.removeItem("stegofy_pending_claim");
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        const pendingCode = readQueryParam("code");
        if (pendingCode) {
          sessionStorage.setItem("stegofy_pending_claim", JSON.stringify({ code: pendingCode }));
        }
        setStep("auth");
      }
      setAuthChecked(true);
    });
  }, []);

  const setField = (key: string, val: string | boolean) => {
    setFormDataState((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleVerify = async () => {
    setError(null);
    const code = displayCode.trim().toUpperCase();
    const p = pin.trim();
    if (!code || p.length < 4) { setError("Enter both the sticker code and the 4-digit PIN."); return; }
    setVerifying(true);
    try {
      const token = await getAccessToken();
      if (!token) { setStep("auth"); return; }
      const res = await fetch("/api/admin/inventory/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_code: code, pin_code: p }),
      });
      const body = (await res.json().catch(() => ({}))) as { type?: string | null; error?: string };
      if (!res.ok) { setError(body.error ?? `Verification failed (${res.status})`); return; }
      if (body.type) setInventoryType(body.type as QRType);
      setStep("details");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during verification.");
    } finally {
      setVerifying(false);
    }
  };

  const validateDetails = (): boolean => {
    const schema = FORM_SCHEMA[inventoryType];
    if (!schema) return true;
    const errs: Record<string, string> = {};
    schema.essential.filter((f) => f.type !== "photo").forEach((f) => {
      if (f.required && !formData[f.key]) errs[f.key] = `${f.label} is required`;
    });
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleDetailsNext = () => {
    if (validateDetails()) setStep("privacy");
  };

  const handleFinalize = async () => {
    setError(null);
    setStep("submitting");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("You need to sign in to complete the claim.");
      const { name, contact } = extractNameAndContact(inventoryType, formData);
      const res = await fetch("/api/admin/inventory/claim/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_code: displayCode.trim().toUpperCase(),
          pin_code: pin.trim(),
          profile: {
            name,
            type: inventoryType,
            privacy_mode: privacy,
            primary_contact: contact || undefined,
            data: formData,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { qr_id?: string; qr_url?: string; error?: string };
      if (!res.ok || !body.qr_id) throw new Error(body.error ?? `Claim failed (${res.status})`);

      addProfile({
        name,
        type: inventoryType,
        status: "active",
        primaryContact: contact,
        privacyMode: privacy,
        formData,
        qrId: body.qr_id,
        qrUrl: body.qr_url ?? `${window.location.origin}/qr/${body.qr_id}`,
        displayCode: displayCode.trim().toUpperCase(),
        pinCode: pin.trim(),
        isActive: true,
        allowContact: true,
        strictMode: false,
      });

      navigate("/app/qr/success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed.");
      setStep("review");
    }
  };

  const schema = FORM_SCHEMA[inventoryType];
  const progress = progressLabel(step);
  const { name: reviewName, contact: reviewContact } = step === "review" || step === "submitting"
    ? extractNameAndContact(inventoryType, formData)
    : { name: "", contact: "" };

  if (!authChecked) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white px-4 pt-6 pb-10">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Claim your Stegofy QR</h1>
            <p className="text-xs text-slate-500">Activate the sticker in front of you.</p>
          </div>
        </div>

        {/* Progress bar — hidden on auth step */}
        {step !== "auth" && (
          <div className="mb-5">
            <div className="flex gap-1.5 mb-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={cn("h-1.5 flex-1 rounded-full transition-all duration-300",
                    s <= progress.current ? "bg-primary" : "bg-slate-100")}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400">Step {progress.current} of {progress.total} · {progress.label}</p>
          </div>
        )}

        {/* ── Auth gate ── */}
        {step === "auth" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Sign in to claim</h2>
              <p className="text-sm text-slate-500">
                Create a free account or sign in to activate your sticker and link it to your profile.
              </p>
            </div>
            {displayCode && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600">
                Sticker code <span className="font-mono font-bold text-slate-800">{displayCode}</span> will be ready to claim right after you sign in.
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/app/signup")}
                className="w-full py-3 rounded-2xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Create account
              </button>
              <button
                onClick={() => navigate("/app/login")}
                className="w-full py-3 rounded-2xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Already have an account
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Verify code + PIN ── */}
        {step === "verify" && (
          <div className="space-y-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Enter the code and PIN printed on the right side of your sticker.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Sticker code</label>
              <input
                value={displayCode}
                onChange={(e) => setDisplayCode(e.target.value.toUpperCase())}
                placeholder="STG-XXXXXX"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm font-mono tracking-wider outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">4-digit PIN</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-center text-lg font-mono tracking-[0.5em] outline-none focus:border-primary"
              />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {verifying ? "Verifying…" : "Verify sticker"}
            </button>
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> Wrong PIN attempts are logged — please double-check before submitting.
            </p>
          </div>
        )}

        {/* ── Step 2: Type-specific details ── */}
        {step === "details" && schema && (
          <div className="space-y-5">
            <VerifiedChip code={displayCode} type={inventoryType} />
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">{getFormLabel(inventoryType)}</h2>
                <p className="text-xs text-slate-500">Fill in the key details — this is what a finder will see when they scan your sticker.</p>
              </div>

              <FieldGroup
                title="Required"
                fields={schema.essential}
                formData={formData}
                setField={setField}
                errors={fieldErrors}
              />

              {schema.important.filter((f) => f.type !== "photo").length > 0 && (
                <div>
                  <button
                    onClick={() => setShowImportant((v) => !v)}
                    className="w-full flex items-center justify-between py-2.5 border-t border-slate-100 mb-3"
                  >
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Helpful extras {showImportant ? "" : "(collapsed)"}
                    </span>
                    {showImportant ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {showImportant && (
                    <FieldGroup
                      title="Optional but useful"
                      fields={schema.important}
                      formData={formData}
                      setField={setField}
                      errors={fieldErrors}
                    />
                  )}
                </div>
              )}

              {Object.keys(fieldErrors).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                  Please fill in the required fields above.
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep("verify")}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleDetailsNext}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Privacy ── */}
        {step === "privacy" && (
          <div className="space-y-5">
            <VerifiedChip code={displayCode} type={inventoryType} />
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">Privacy Settings</h2>
                <p className="text-xs text-slate-500">Choose how a finder can contact you when this sticker is scanned.</p>
              </div>
              <div className="space-y-2">
                {PRIVACY_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors",
                      privacy === opt.key ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="radio"
                      checked={privacy === opt.key}
                      onChange={() => setPrivacy(opt.key)}
                      className="accent-primary mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">Your privacy is protected. Masked contacts are routed through Stegofy's secure bridge.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep("details")}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep("review")}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  Review <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Review + Activate ── */}
        {(step === "review" || step === "submitting") && (
          <div className="space-y-5">
            <VerifiedChip code={displayCode} type={inventoryType} />
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Review & Activate</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Name</span>
                  <span className="text-slate-800 font-semibold">{reviewName || "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Contact</span>
                  <span className="text-slate-800 font-semibold">{reviewContact || "Not provided"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Privacy</span>
                  <span className="text-slate-800 font-semibold capitalize">
                    {PRIVACY_OPTIONS.find((p) => p.key === privacy)?.label ?? privacy}
                  </span>
                </div>
                {Object.entries(formData)
                  .filter(([, v]) => v !== "" && v !== false && !CONTACT_KEYS.includes("") && typeof v === "string")
                  .filter(([k]) => !CONTACT_KEYS.includes(k) && k !== getNameKey(inventoryType))
                  .slice(0, 4)
                  .map(([k, v]) => {
                    const allFields = [...(schema?.essential ?? []), ...(schema?.important ?? [])];
                    const def = allFields.find((f) => f.key === k);
                    if (!def) return null;
                    return (
                      <div key={k} className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{def.label}</span>
                        <span className="text-slate-700 text-right max-w-[60%] truncate">{String(v)}</span>
                      </div>
                    );
                  })}
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep("privacy")}
                  disabled={step === "submitting"}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={step === "submitting"}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {step === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {step === "submitting" ? "Activating…" : "Activate QR"}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-400 text-center mt-6">
          After activation you can manage privacy, contacts, and media from the QR's Manage screen.
        </p>
      </div>
    </div>
  );
}
