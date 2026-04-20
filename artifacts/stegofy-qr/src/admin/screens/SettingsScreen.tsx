import { useEffect, useState } from "react";
import { Save, RotateCcw, Settings, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Key, Info, Send, Radio, Zap, DollarSign, CheckCircle2, AlertTriangle } from "lucide-react";
import { getSettings, upsertSetting, getConfigStatus, sendTestEmail, testCommsProvider, invalidateCommsCache } from "@/services/adminService";

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
  // ── Zavu (primary WhatsApp + OTP) ─────────────────────────────────────
  {
    key: "zavu_api_key",
    label: "Zavu API Key",
    hint: "Primary provider for WhatsApp messaging and OTP delivery.",
    placeholder: "Enter Zavu API key…",
  },
  {
    key: "zavu_account_id",
    label: "Zavu Account ID",
    hint: "Your Zavu account / business identifier.",
    placeholder: "zav_xxxxxxxx",
  },
  {
    key: "zavu_phone_number_id",
    label: "Zavu Phone Number ID",
    hint: "ID of the registered WhatsApp Business sender number in Zavu.",
    placeholder: "phn_xxxxxxxx",
  },
  {
    key: "zavu_otp_template_name",
    label: "Zavu OTP Template Name",
    hint: "Approved WhatsApp template used to deliver one-time codes.",
    placeholder: "stegofy_otp",
  },
  {
    key: "zavu_otp_template_lang",
    label: "Zavu OTP Template Language",
    hint: "Template language code (e.g. en, en_US, hi).",
    placeholder: "en",
  },
  {
    key: "zavu_webhook_secret",
    label: "Zavu Webhook Secret",
    hint: "Shared secret used to verify status webhook signatures.",
    placeholder: "Enter Zavu webhook secret…",
  },
  // ── Exotel (SMS + masked calls + WhatsApp fallback) ───────────────────
  {
    key: "exotel_api_key",
    label: "Exotel API Key",
    hint: "Used for SMS delivery, masked-call bridges, and WhatsApp fallback when Zavu is unavailable.",
    placeholder: "Enter Exotel API key…",
  },
  {
    key: "exotel_api_token",
    label: "Exotel API Token",
    hint: "Paired with the Exotel API key above.",
    placeholder: "Enter Exotel API token…",
  },
  {
    key: "exotel_sid",
    label: "Exotel Account SID",
    hint: "Public identifier for your Exotel account.",
    placeholder: "exotel_sid…",
  },
  {
    key: "exotel_subdomain",
    label: "Exotel Subdomain",
    hint: "e.g. api.exotel.com or your regional Exotel cluster.",
    placeholder: "api.exotel.com",
  },
  {
    key: "exotel_caller_id",
    label: "Exotel Caller ID",
    hint: "ExoPhone number used as the masked caller ID for outbound bridges.",
    placeholder: "+91XXXXXXXXXX",
  },
  {
    key: "exotel_webhook_secret",
    label: "Exotel Webhook Secret",
    hint: "Shared secret used to verify status webhook signatures.",
    placeholder: "Enter Exotel webhook secret…",
  },
];

const FEATURE_KEYS = ["allow_free_qr", "masked_call_enabled", "whatsapp_enabled", "video_call_enabled"];
const CONFIG_KEYS = ["max_qr_per_user", "emergency_notify_email", "support_email", "app_version"];

// Communications platform — feature flags, routing preferences, cost control.
// Key names below MUST match the keys read by the API server in
// commsCredentials.ts / commsRouter.ts. Renaming here without updating the
// backend silently disconnects the UI from runtime behaviour.
// Canonical spec keys live unprefixed; the legacy `feature_*` aliases are
// kept in DEFAULT_VALUES for backward compatibility with older deployments.
const COMMS_FLAG_KEYS = [
  "feature_otp_required",
  "masked_call_enabled",
  "whatsapp_enabled",
  "sms_enabled",
];
const COMMS_SETTINGS_KEYS = [
  "wa_delivery_timeout_sec",
  "comms_retry_attempts",
  "call_max_duration_sec",
  "call_cooldown_sec",
  "calls_per_qr_per_hour",
];
const COMMS_COST_KEYS = ["comms_cost_cap_inr_per_day", "comms_cost_warn_threshold_inr_per_day"];

const DEFAULT_VALUES: Record<string, string> = {
  allow_free_qr: "true",
  video_call_enabled: "true",
  max_qr_per_user: "3",
  emergency_notify_email: "",
  support_email: "",
  app_version: "1.0.0",
  // Comms defaults — tuned for "reliability first": Zavu primary for WhatsApp,
  // Exotel for SMS, OTP required, daily spend cap of ₹500. The canonical
  // spec keys are unprefixed (`masked_call_enabled` etc.); the legacy
  // `feature_*_enabled` aliases are written alongside so older readers
  // continue to see consistent values.
  feature_otp_required: "true",
  masked_call_enabled: "true",
  whatsapp_enabled: "true",
  sms_enabled: "true",
  // Legacy aliases — written so older API code paths continue to see "on".
  feature_calls_enabled: "true",
  feature_messages_enabled: "true",
  feature_whatsapp_enabled: "true",
  comms_routing_whatsapp: "zavu_first",
  comms_routing_sms: "exotel",
  comms_routing_call: "exotel",
  comms_cost_cap_inr_per_day: "500",
  comms_cost_warn_threshold_inr_per_day: "350",
  // Communication Settings (spec).
  wa_delivery_timeout_sec: "10",
  comms_retry_attempts: "1",
  call_max_duration_sec: "60",
  call_cooldown_sec: "60",
  calls_per_qr_per_hour: "2",
  // Cost Control — monthly budget stored in paise; UI shows ₹.
  monthly_budget_paise: "0",
  over_budget_behavior: "calls_only",
  zavu_otp_template_lang: "en",
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

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
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

/**
 * Hits the admin "test connection" endpoint for a single comms provider and
 * shows the result inline. Always invalidates the server-side credential cache
 * first so we test the freshest stored credentials, not the cached ones.
 */
function TestProviderButton({ provider }: { provider: "zavu" | "exotel" }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const label = provider === "zavu" ? "Zavu" : "Exotel";

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      // Drop the 30s credential cache so we test what was just saved.
      try { await invalidateCommsCache(); } catch { /* non-fatal */ }
      const res = await testCommsProvider(provider);
      setResult({
        ok: Boolean(res.ok),
        detail: res.ok
          ? "Connection successful."
          : (res.error ?? `Connection failed (HTTP ${res.status}).`),
      });
    } catch (err) {
      setResult({ ok: false, detail: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Test {label}</p>
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Send className="w-3 h-3" />
          {busy ? "Testing…" : "Test connection"}
        </button>
      </div>
      {result && (
        <div className={`mt-2 flex items-start gap-1.5 text-xs ${result.ok ? "text-green-600" : "text-red-500"}`}>
          {result.ok
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
          <span>{result.detail}</span>
        </div>
      )}
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
  const [resendFromEmail, setResendFromEmail] = useState<string>("");
  const [resendCustomDomain, setResendCustomDomain] = useState<boolean>(false);

  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<
    { ok: true; sentTo: string } | { ok: false; error: string } | null
  >(null);

  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const { sent_to } = await sendTestEmail();
      setTestEmailResult({ ok: true, sentTo: sent_to });
    } catch (err) {
      setTestEmailResult({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setTestEmailSending(false);
    }
  };

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
        setResendFromEmail(status.resend_from_email ?? "");
        setResendCustomDomain(Boolean(status.resend_custom_domain));
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
    // API key rows own their own state and have per-row Save buttons.
    // Excluding them here prevents the global Save from clobbering a key
    // that the admin edited in a row but hasn't yet saved.
    const apiKeyKeys = new Set(API_KEY_ROWS.map((r) => r.key));
    await Promise.all(
      Object.entries(allValues)
        .filter(([k]) => !apiKeyKeys.has(k))
        .map(([k, v]) => upsertSetting(k, v)),
    );
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

      {/* ── Communications: Routing ─────────────────────────────────── */}
      <div id="comms-routing" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 scroll-mt-20">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Communication Settings</p>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Choose which provider is the primary for each channel. The system always falls back to the other provider if the primary fails — Zavu and Exotel are the two supported providers.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">WhatsApp routing</label>
            <select
              value={values.comms_routing_whatsapp ?? "zavu_first"}
              onChange={(e) => set("comms_routing_whatsapp", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-white"
            >
              <option value="zavu_first">Zavu first, fall back to Exotel (recommended)</option>
              <option value="exotel_first">Exotel first, fall back to Zavu</option>
              <option value="off">Disabled — do not send WhatsApp messages</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">SMS routing</label>
            <select
              value={values.comms_routing_sms ?? "exotel"}
              onChange={(e) => set("comms_routing_sms", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-white"
            >
              <option value="exotel">Exotel (recommended)</option>
              <option value="zavu">Zavu</option>
              <option value="off">Disabled — do not send SMS</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">Masked-call routing</label>
            <select
              value={values.comms_routing_call ?? "exotel"}
              onChange={(e) => set("comms_routing_call", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors bg-white"
            >
              <option value="exotel">Exotel (recommended)</option>
              <option value="off">Disabled — do not place masked calls</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <TestProviderButton provider="zavu" />
          <TestProviderButton provider="exotel" />
        </div>
      </div>

      {/* ── Communications: Feature Flags ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Feature Flags</p>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Master switches for each part of the contact flow. Disable a flag to immediately stop that channel without redeploying.
        </p>
        {COMMS_FLAG_KEYS.map((k) => (
          <ToggleSetting
            key={k}
            label={labelOf(k.replace(/^feature_/, ""))}
            value={values[k] ?? "false"}
            onChange={(v) => {
              set(k, v);
              // Keep the legacy aliases in lock-step so the API server's
              // historical readers stay consistent with the new keys.
              if (k === "masked_call_enabled") set("feature_calls_enabled", v);
              if (k === "sms_enabled") set("feature_messages_enabled", v);
              if (k === "whatsapp_enabled") set("feature_whatsapp_enabled", v);
            }}
          />
        ))}
      </div>

      {/* ── Communication Settings ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Communication Settings</p>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Reliability knobs for the messaging and call platform. Values are seconds (or attempts) — defaults are tuned for the spec (60s call cap, 60s cooldown, 2 calls per QR per hour).
        </p>
        {COMMS_SETTINGS_KEYS.map((k) => (
          <TextSetting key={k} label={labelOf(k)} value={values[k] ?? ""} onChange={(v) => set(k, v)} />
        ))}
      </div>

      {/* ── Communications: Cost Control ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Cost Control</p>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Set a monthly communications budget in rupees. When the budget is reached, the platform either blocks just masked calls (cheapest mitigation) or all paid comms, depending on the over-budget behavior. The daily cap and warn threshold below remain available as a secondary safety net.
        </p>
        <TextSetting
          label="Monthly Budget (₹)"
          value={String(Math.round((Number(values.monthly_budget_paise) || 0) / 100))}
          onChange={(v) => {
            const inr = Math.max(0, Math.floor(Number(v) || 0));
            set("monthly_budget_paise", String(inr * 100));
          }}
        />
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0">
          <span className="text-sm text-slate-700">Over Budget Behavior</span>
          <select
            value={values.over_budget_behavior ?? "calls_only"}
            onChange={(e) => set("over_budget_behavior", e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
          >
            <option value="calls_only">Block masked calls only</option>
            <option value="all_comms">Block all paid comms</option>
          </select>
        </div>
        {COMMS_COST_KEYS.map((k) => (
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

        {API_KEY_ROWS.map((def, idx) => (
          <ApiKeyRow
            key={def.key}
            def={def}
            initialValue={values[def.key] ?? ""}
            isLast={idx === API_KEY_ROWS.length - 1}
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

          {/* From address row */}
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-800">Sending Address</p>
                <span className="group relative inline-flex">
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 leading-relaxed">
                    <span className="font-semibold block mb-1">Use your own domain:</span>
                    1. In Resend, go to Domains → Add Domain (e.g. stegofy.com).<br />
                    2. Add the DNS records (SPF, DKIM, DMARC) shown by Resend to your DNS provider.<br />
                    3. Wait for verification, then set the <code className="font-mono">RESEND_FROM_EMAIL</code> secret to e.g. <code className="font-mono">admin@stegofy.com</code>.<br />
                    4. Restart the API server.
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate font-mono">
                {resendFromEmail || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              {resendKeySet && (
                <button
                  onClick={handleSendTestEmail}
                  disabled={testEmailSending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  <Send className="w-3 h-3" />
                  {testEmailSending ? "Sending…" : "Send test email"}
                </button>
              )}
              {resendFromEmail ? (
                resendCustomDomain ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Custom domain
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    Resend default
                  </span>
                )
              ) : (
                <span className="text-xs text-slate-400 font-medium">Checking…</span>
              )}
            </div>
          </div>

          {testEmailResult && (
            testEmailResult.ok ? (
              <p className="mt-2 text-xs text-green-600">
                Test email sent to <span className="font-mono">{testEmailResult.sentTo}</span>. Check your inbox (and spam folder).
              </p>
            ) : (
              <p className="mt-2 text-xs text-red-500">{testEmailResult.error}</p>
            )
          )}
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
