import { useEffect, useState } from "react";
import { Save, RotateCcw, Settings } from "lucide-react";
import { getSettings, upsertSetting, type Setting } from "@/services/adminService";

const DEFAULT_SETTINGS: Setting[] = [
  { key: "allow_free_qr", value: "true", updated_at: "" },
  { key: "max_qr_per_user", value: "3", updated_at: "" },
  { key: "emergency_notify_email", value: "", updated_at: "" },
  { key: "masked_call_enabled", value: "true", updated_at: "" },
  { key: "whatsapp_enabled", value: "true", updated_at: "" },
  { key: "video_call_enabled", value: "true", updated_at: "" },
  { key: "support_email", value: "", updated_at: "" },
  { key: "app_version", value: "1.0.0", updated_at: "" },
];

type SettingValue = Record<string, string>;

function ToggleSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const on = value === "true";
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
      </div>
      <button onClick={() => onChange(on ? "false" : "true")} className={`w-12 h-6 rounded-full transition-all relative ${on ? "bg-primary" : "bg-slate-200"}`}>
        <span className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${on ? "left-6.5 translate-x-0.5" : "left-0.5"}`} style={{ left: on ? "calc(100% - 22px)" : "2px" }} />
      </button>
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

function labelOf(key: string): string {
  return key.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function SettingsScreen() {
  const [values, setValues] = useState<SettingValue>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      const map: SettingValue = {};
      DEFAULT_SETTINGS.forEach((d) => { map[d.key] = d.value || ""; });
      settings.forEach((s) => { map[s.key] = s.value ?? ""; });
      setValues(map);
      setLoading(false);
    });
  }, []);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(Object.entries(values).map(([k, v]) => upsertSetting(k, v)));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const map: SettingValue = {};
    DEFAULT_SETTINGS.forEach((d) => { map[d.key] = d.value || ""; });
    setValues(map);
  };

  const toggleKeys = ["allow_free_qr", "masked_call_enabled", "whatsapp_enabled", "video_call_enabled"];
  const textKeys = ["max_qr_per_user", "emergency_notify_email", "support_email", "app_version"];

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-primary" />
          <p className="font-bold text-slate-900">Feature Toggles</p>
        </div>
        {toggleKeys.map((k) => (
          <ToggleSetting key={k} label={labelOf(k)} value={values[k] ?? "false"} onChange={(v) => set(k, v)} />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-900 mb-4">Configuration</p>
        {textKeys.map((k) => (
          <TextSetting key={k} label={labelOf(k)} value={values[k] ?? ""} onChange={(v) => set(k, v)} />
        ))}
      </div>

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
