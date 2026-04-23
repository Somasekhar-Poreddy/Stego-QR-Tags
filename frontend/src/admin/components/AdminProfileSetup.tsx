import { useState } from "react";
import { User, Phone, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { updateAdminUser } from "@/services/adminService";

interface Props {
  adminId: string;
  currentName: string | null;
  currentEmail: string;
  onComplete: (name: string) => void;
}

export function AdminProfileSetup({ adminId, currentName, currentEmail, onComplete }: Props) {
  const [firstName, setFirstName] = useState(() => {
    if (!currentName) return "";
    return currentName.split(" ")[0] ?? "";
  });
  const [lastName, setLastName] = useState(() => {
    if (!currentName) return "";
    return currentName.split(" ").slice(1).join(" ") ?? "";
  });
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const { error: updateErr } = await updateAdminUser(adminId, { name: fullName });
      if (updateErr) throw updateErr;

      if (mobile.trim()) {
        await supabase.auth.updateUser({
          data: { mobile: mobile.trim() },
        });
      }

      onComplete(fullName);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Complete Your Profile</h2>
          <p className="text-sm text-slate-500 mt-1">
            Set up your admin profile to get started
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                placeholder="John"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setError(null); }}
                placeholder="Doe"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
            <input
              type="email"
              value={currentEmail}
              disabled
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Mobile Number</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors">
              <div className="flex items-center gap-1 border-r border-slate-200 pr-2 flex-shrink-0">
                <span className="text-sm">🇮🇳</span>
                <span className="text-xs font-bold text-slate-700">+91</span>
              </div>
              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Optional — used for emergency contact and notifications</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            <X className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-rose-600">{error}</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60 transition-all active:scale-[0.98]"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile
            </>
          )}
        </button>
      </div>
    </div>
  );
}
