import { useEffect, useState } from "react";
import { Save, RotateCcw, Settings, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Key } from "lucide-react";
import { getSettings, upsertSetting, getConfigStatus } from "@/services/adminService";

interface ApiKeyRowDef {
  key: string;
  label: string;
  hint: string;
  placeholder?: string;
}

const API_KEY_ROWS: ApiKeyRowDef[] = [
  {
    key: "ip2location_api_key",
    label: "IP2Location API Key",
    hint: "Used as fallback for geo-lookup on QR scans.",
    placeholder: "Enter IP2Location API key…",
  },
  {
    key: "twilio_auth_token",
    label: "Twilio Auth Token",
    hint: "For SMS / masked-call features. Pair with the Twilio Account SID below.",
    placeholder: "Enter Twilio auth token…",
  },
  {
    key: "twilio_account_sid",
    label: "Twilio Account SID",
    hint: "Public identifier for your Twilio account. Stored alongside the auth token.",
    placeholder: "ACxxxxxxxxxxxxxxxx",
  },
  {
    key: "sendgrid_api_key",
    label: "SendGrid API Key",
    hint: "Optional alternative to Resend for transactional email.",
    placeholder: "SG.xxxxxxxx",
  },
  {
    key: "stripe_secret_key",
    label: "Stripe Secret Key",
    hint: "Used for payment processing. Use a sk_test_ key while testing.",
    placeholder: "sk_test_… or sk_live_…",
  },
];

const FEATURE_KEYS = ["allow_free_qr", "masked_call_enabled", "whatsapp_enabled", "video_call_enabled"];
const CONFIG_KEYS = ["max_qr_per_user", "emergency_notify_email", "support_email", "app_version"];

const DEFAULT_VALUES: Record<string, string> = {
  allow_free_qr: "true",
  masked_call_enabled: "true",
  whatsapp_enabled: "true",
  video_call_enabled: "true",
  max_qr_per_user: "3",
  emergency_notify_email: "",
  support_email: "",
  app_version: "1.0.0",
};

function labelOf(key: string): string {
  return key.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

interface FaqItem { q: string; a: string; }

function parseFaqs(raw: string): FaqItem[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function ToggleSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const on = value === "true";
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <button onClick={() => onChange(on ? "false" : "true")} className={`w-11 h-6 rounded-full relative transition-all ${on ? "bg-primary" : "bg-slate-200"}`}>
        <span className="w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: on ? "calc(100% - 18px)" : "4px" }} />
      </button>
    </div>
  );
}

function ApiKeyRow({ def, initialValue, isLast }: { def: ApiKeyRowDef; initialValue: string; isLast: boolean }) {
  const [value, setValue] = useState(initialValue);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await upsertSetting(def.key, value);
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`py-3 ${isLast ? "" : "border-b border-slate-50"}`}>
      <label className="text-sm font-semibold text-slate-800 block mb-1">{def.label}</label>
      <p className="text-xs text-slate-400 mb-2">{def.hint}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={def.placeholder ?? "Enter API key…"}
            className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors font-mono"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${saved ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90"} disabled:opacity-60`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function TextSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <label className="text-sm font-semibold text-slate-800 block mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
    </div>
  );
}

export function SettingsScreen() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const [encryptionKeySet, setEncryptionKeySet] = useState<boolean | null>(null);
  const [resendKeySet, setResendKeySet] = useState<boolean | null>(null);

  useEffect(() => {
    getSettings().then((settings) => {
      const map: Record<string, string> = { ...DEFAULT_VALUES };
      settings.forEach((s) => { map[s.key] = s.value ?? ""; });
      setValues(map);
      setFaqs(parseFaqs(map["faq_list"] ?? "[]"));
      setLoading(false);
    });
    getConfigStatus()
      .then((status) => {
        setEncryptionKeySet(status.ip_encryption_key_set);
        setResendKeySet(status.resend_api_key_set);
      })
      .catch(() => {
        setEncryptionKeySet(false);
        setResendKeySet(false);
      });
  }, []);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const allValues = { ...values, faq_list: JSON.stringify(faqs) };
    await Promise.all(Object.entries(allValues).map(([k, v]) => upsertSetting(k, v)));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setValues({ ...DEFAULT_VALUES });
    setFaqs([]);
  };

  const addFaq = () => setFaqs((f) => [...f, { q: "", a: "" }]);
  const updateFaq = (i: number, field: "q" | "a", val: string) =>
    setFaqs((f) => f.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const deleteFaq = (i: number) => setFaqs((f) => f.filter((_, idx) => idx !== i));

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-5 max-w-xl">
      {/* Feature toggles */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Feature Toggles</p>
        </div>
        {FEATURE_KEYS.map((k) => (
          <ToggleSetting key={k} label={labelOf(k)} value={values[k] ?? "false"} onChange={(v) => set(k, v)} />
        ))}
      </div>

      {/* Config values */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-900 mb-4">Configuration</p>
        {CONFIG_KEYS.map((k) => (
          <TextSetting key={k} label={labelOf(k)} value={values[k] ?? ""} onChange={(v) => set(k, v)} />
        ))}
      </div>

      {/* FAQ editor */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-slate-900">FAQ List</p>
          <button onClick={addFaq} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors">
            <Plus className="w-4 h-4" /> Add FAQ
          </button>
        </div>
        {faqs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No FAQs yet. Click "Add FAQ" to create one.</p>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer" onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                  <p className="text-sm font-semibold text-slate-700 truncate">{faq.q || `FAQ #${i + 1}`}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); deleteFaq(i); }} className="p-1 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    {expandedFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandedFaq === i && (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Question</label>
                      <input value={faq.q} onChange={(e) => updateFaq(i, "q", e.target.value)} placeholder="Enter question…" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Answer</label>
                      <textarea value={faq.a} onChange={(e) => updateFaq(i, "a", e.target.value)} placeholder="Enter answer…" rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys & Integrations */}
      <div id="api-keys" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">API Keys &amp; Integrations</p>
        </div>

        <p className="text-xs text-slate-400 mb-2 -mt-2">
          These keys are stored in the <span className="font-mono">settings</span> table and read by the API server at request time.
          Keys that must live in environment variables are listed below as read-only status indicators.
        </p>

        {API_KEY_ROWS.map((def) => (
          <ApiKeyRow
            key={def.key}
            def={def}
            initialValue={values[def.key] ?? ""}
            isLast={false}
          />
        ))}

        {/* IP Encryption Key — read-only status */}
        <div className="py-3 border-b border-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">IP Encryption Key</p>
              <p className="text-xs text-slate-400 mt-0.5">Must be set as an environment variable (IP_ENCRYPTION_KEY). Cannot be stored in the database.</p>
            </div>
            {encryptionKeySet === null ? (
              <span className="text-xs text-slate-400 font-medium">Checking…</span>
            ) : encryptionKeySet ? (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Not set
              </span>
            )}
          </div>
        </div>

        {/* Resend API Key — read-only status */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Email Service (Resend)</p>
              <p className="text-xs text-slate-400 mt-0.5">Must be set as a secret (RESEND_API_KEY). Used to send vendor emails directly from the dashboard.</p>
            </div>
            {resendKeySet === null ? (
              <span className="text-xs text-slate-400 font-medium">Checking…</span>
            ) : resendKeySet ? (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Not set
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Save / Reset */}
      <div className="flex gap-3">
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
        <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90"} disabled:opacity-60`}>
          <Save className="w-4 h-4" /> {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
