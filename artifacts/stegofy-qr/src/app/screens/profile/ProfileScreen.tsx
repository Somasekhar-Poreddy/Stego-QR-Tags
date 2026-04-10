import { useState, useEffect } from "react";
import {
  User, Phone, Mail, Shield, Bell, Lock, HelpCircle, LogOut,
  ChevronRight, ChevronDown, Pencil, Trash2, Plus, X, Check,
  MapPin, Instagram, Twitter, Facebook, Save, Copy,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { AppHeader } from "@/app/components/AppHeader";
import { cn } from "@/lib/utils";
import { getUserProfile, updateUserProfile, type Address, type SocialLinks } from "@/services/userService";

const AGE_GROUPS = ["Under 18", "18–25", "26–35", "36–45", "46–55", "56 and above"];
const GENDERS    = ["Male", "Female", "Non-binary", "Prefer not to say"];
const ADDRESS_LABELS = ["Home", "Work", "Other"];

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-400 block">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", disabled, prefix }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; prefix?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      {prefix}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-400"
      />
    </div>
  );
}

function SelectInput({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-slate-900 outline-none appearance-none cursor-pointer"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 pointer-events-none" />
    </div>
  );
}

/* ─── Address Modal ────────────────────────────────────────────────────────── */

const EMPTY_ADDR: Omit<Address, "id"> = {
  label: "Home", street: "", city: "", state: "", pincode: "", country: "India", isDefault: false,
};

function AddressModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Address;
  onSave: (addr: Address) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Address, "id">>(
    initial ? { label: initial.label, street: initial.street, city: initial.city, state: initial.state, pincode: initial.pincode, country: initial.country, isDefault: initial.isDefault }
             : { ...EMPTY_ADDR }
  );
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.street.trim() || !form.city.trim()) return;
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-5 space-y-4 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-slate-900">{initial ? "Edit Address" : "Add Address"}</p>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        {/* Label picker */}
        <div className="flex gap-2">
          {ADDRESS_LABELS.map((l) => (
            <button
              key={l}
              onClick={() => set("label", l)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                form.label === l
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              )}
            >{l}</button>
          ))}
          {!ADDRESS_LABELS.includes(form.label) && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 border border-primary text-primary">{form.label}</span>
          )}
        </div>

        <Field label="Street / Flat No.">
          <TextInput value={form.street} onChange={(v) => set("street", v)} placeholder="123, Main Street, Apt 4B" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <TextInput value={form.city} onChange={(v) => set("city", v)} placeholder="Chennai" />
          </Field>
          <Field label="State">
            <TextInput value={form.state} onChange={(v) => set("state", v)} placeholder="Tamil Nadu" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pincode">
            <TextInput value={form.pincode} onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))} placeholder="600001" />
          </Field>
          <Field label="Country">
            <TextInput value={form.country} onChange={(v) => set("country", v)} placeholder="India" />
          </Field>
        </div>

        {/* Default toggle */}
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-3">
          <p className="text-sm font-semibold text-slate-700">Set as default address</p>
          <button
            onClick={() => set("isDefault", !form.isDefault)}
            className={cn("w-10 h-5 rounded-full relative transition-all", form.isDefault ? "bg-primary" : "bg-slate-300")}
          >
            <span className={cn("w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-all", form.isDefault ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!form.street.trim() || !form.city.trim()}
          className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {initial ? "Update Address" : "Save Address"}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Screen ──────────────────────────────────────────────────────────── */

export function ProfileScreen() {
  const { user, logout } = useAuth();

  /* personal info state */
  const [sgyId,      setSgyId]      = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [mobile,     setMobile]     = useState("");
  const [ageGroup,   setAgeGroup]   = useState("");
  const [gender,     setGender]     = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg,    setInfoMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  /* addresses */
  const [addresses,     setAddresses]     = useState<Address[]>([]);
  const [editingAddr,   setEditingAddr]   = useState<Address | null | "new">(null);
  const [addrSaving,    setAddrSaving]    = useState(false);

  /* social links */
  const [social,        setSocial]        = useState<SocialLinks>({});
  const [socialSaving,  setSocialSaving]  = useState(false);
  const [socialMsg,     setSocialMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  /* settings */
  const [strictMode,    setStrictMode]    = useState(true);
  const [notifications, setNotifications] = useState(true);

  /* load profile */
  useEffect(() => {
    if (!user?.id) return;
    getUserProfile(user.id).then((p) => {
      if (!p) return;
      setSgyId(    p.sgy_id      ?? null);
      setFirstName(p.first_name  ?? "");
      setLastName( p.last_name   ?? "");
      setMobile(   p.mobile      ?? "");
      setAgeGroup( p.age_group   ?? "");
      setGender(   p.gender      ?? "");
      setAddresses((p.addresses  as Address[]) ?? []);
      setSocial(   (p.social_links as SocialLinks) ?? {});
    });
  }, [user?.id]);

  const copySgyId = () => {
    if (!sgyId) return;
    navigator.clipboard.writeText(sgyId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayEmail = user?.email || "Not linked";
  const initials = ((firstName[0] ?? user?.name?.[0] ?? "U") + (lastName[0] ?? "")).toUpperCase();

  /* ── save personal info ── */
  const saveInfo = async () => {
    if (!user?.id) return;
    setInfoSaving(true); setInfoMsg(null);
    const { error } = await updateUserProfile(user.id, {
      first_name: firstName, last_name: lastName,
      mobile, age_group: ageGroup, gender,
    });
    setInfoMsg(error ? { ok: false, text: error } : { ok: true, text: "Profile updated!" });
    setInfoSaving(false);
    setTimeout(() => setInfoMsg(null), 3000);
  };

  /* ── address helpers ── */
  const handleSaveAddr = async (addr: Address) => {
    setAddrSaving(true);
    let next: Address[];
    if (addr.isDefault) {
      next = addresses.map((a) => ({ ...a, isDefault: false }));
    } else {
      next = [...addresses];
    }
    const idx = next.findIndex((a) => a.id === addr.id);
    if (idx >= 0) next[idx] = addr; else next = [...next, addr];
    setAddresses(next);
    if (user?.id) await updateUserProfile(user.id, { addresses: next });
    setAddrSaving(false);
    setEditingAddr(null);
  };

  const handleDeleteAddr = async (id: string) => {
    const next = addresses.filter((a) => a.id !== id);
    setAddresses(next);
    if (user?.id) await updateUserProfile(user.id, { addresses: next });
  };

  /* ── save social links ── */
  const saveSocial = async () => {
    if (!user?.id) return;
    setSocialSaving(true); setSocialMsg(null);
    const { error } = await updateUserProfile(user.id, { social_links: social });
    setSocialMsg(error ? { ok: false, text: error } : { ok: true, text: "Social links saved!" });
    setSocialSaving(false);
    setTimeout(() => setSocialMsg(null), 3000);
  };

  const MENU_ITEMS = [
    { icon: Bell, label: "Notifications", toggle: true,  value: notifications, onToggle: () => setNotifications(!notifications) },
    { icon: Lock,         label: "Privacy & Security", toggle: false },
    { icon: HelpCircle,   label: "Help & Support",     toggle: false },
    { icon: Shield,       label: "Terms & Privacy",    toggle: false },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="Profile" showNotification={false} />

      <div className="px-4 pt-5 pb-6 space-y-4">

        {/* ── Avatar + name card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-extrabold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold text-slate-900 truncate">
                {[firstName, lastName].filter(Boolean).join(" ") || user?.name || "User"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{displayEmail}</p>

              {/* SGY Member ID */}
              {sgyId ? (
                <button
                  onClick={copySgyId}
                  className="mt-2 inline-flex items-center gap-1.5 bg-primary/8 hover:bg-primary/15 border border-primary/20 rounded-lg px-2.5 py-1 transition-all group"
                >
                  <span className="text-[11px] font-bold text-primary tracking-wide">{sgyId}</span>
                  {copied
                    ? <Check className="w-3 h-3 text-green-500" />
                    : <Copy className="w-3 h-3 text-primary/50 group-hover:text-primary transition-colors" />}
                </button>
              ) : (
                <div className="mt-2 h-5 w-24 bg-slate-100 rounded-lg animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* ── Personal Info ── */}
        <SectionCard title="Personal Info">
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name">
                <TextInput value={firstName} onChange={setFirstName} placeholder="First name" />
              </Field>
              <Field label="Last Name">
                <TextInput value={lastName}  onChange={setLastName}  placeholder="Last name" />
              </Field>
            </div>

            <Field label="Email">
              <TextInput
                value={displayEmail}
                onChange={() => {}}
                disabled
                prefix={<Mail className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              />
            </Field>

            <Field label="Mobile Number">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 flex-shrink-0">
                  <span className="text-sm">🇮🇳</span>
                  <span className="text-xs font-bold text-slate-700">+91</span>
                </div>
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </Field>

            <Field label="Age Group">
              <SelectInput value={ageGroup} onChange={setAgeGroup} options={AGE_GROUPS} placeholder="Select age group" />
            </Field>

            <Field label="Gender">
              <SelectInput value={gender} onChange={setGender} options={GENDERS} placeholder="Select gender" />
            </Field>

            {infoMsg && (
              <div className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold",
                infoMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              )}>
                {infoMsg.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {infoMsg.text}
              </div>
            )}

            <button
              onClick={saveInfo}
              disabled={infoSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {infoSaving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </SectionCard>

        {/* ── Addresses ── */}
        <SectionCard title="Saved Addresses">
          <div className="px-4 pb-4 space-y-2">
            {addresses.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3">No addresses saved yet</p>
            )}
            {addresses.map((addr) => (
              <div key={addr.id} className="flex items-start gap-3 bg-slate-50 rounded-xl px-3 py-3">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-700">{addr.label}</p>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditingAddr(addr)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteAddr(addr.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setEditingAddr("new")}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-400 hover:border-primary hover:text-primary transition-all"
            >
              <Plus className="w-4 h-4" /> Add Address
            </button>
          </div>
        </SectionCard>

        {/* ── Social Media ── */}
        <SectionCard title="Social Media">
          <div className="px-4 pb-4 space-y-3">
            {([
              { key: "instagram" as const, label: "Instagram", icon: Instagram,  placeholder: "@yourhandle", color: "text-pink-500"   },
              { key: "facebook"  as const, label: "Facebook",  icon: Facebook,   placeholder: "facebook.com/yourpage", color: "text-blue-600"  },
              { key: "twitter"   as const, label: "Twitter / X", icon: Twitter, placeholder: "@yourhandle", color: "text-sky-500"   },
            ] as const).map(({ key, label, icon: Icon, placeholder, color }) => (
              <Field key={key} label={label}>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Icon className={cn("w-4 h-4 flex-shrink-0", color)} />
                  <input
                    type="text"
                    value={social[key] ?? ""}
                    onChange={(e) => setSocial((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {social[key] && (
                    <button onClick={() => setSocial((s) => ({ ...s, [key]: "" }))} className="text-slate-300 hover:text-slate-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Field>
            ))}

            {socialMsg && (
              <div className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold",
                socialMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              )}>
                {socialMsg.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {socialMsg.text}
              </div>
            )}

            <button
              onClick={saveSocial}
              disabled={socialSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {socialSaving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><Save className="w-4 h-4" /> Save Social Links</>}
            </button>
          </div>
        </SectionCard>

        {/* ── Strict Mode ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Strict Mode</p>
                <p className="text-xs text-slate-400">Require code for all contacts</p>
              </div>
            </div>
            <button
              onClick={() => setStrictMode(!strictMode)}
              className={cn("w-12 h-6 rounded-full relative transition-colors", strictMode ? "bg-primary" : "bg-slate-200")}
            >
              <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow", strictMode ? "right-0.5" : "left-0.5")} />
            </button>
          </div>
          {strictMode && (
            <p className="mt-3 text-xs bg-primary/5 text-primary rounded-xl px-3 py-2 font-medium">
              ✓ Strict mode is active — all contacts require tag code verification
            </p>
          )}
        </div>

        {/* ── Settings menu ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {MENU_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                <item.icon className="w-4 h-4 text-slate-600" />
              </div>
              <p className="flex-1 text-sm font-semibold text-slate-700">{item.label}</p>
              {item.toggle ? (
                <button
                  onClick={item.onToggle}
                  className={cn("w-10 h-5 rounded-full relative transition-colors", item.value ? "bg-primary" : "bg-slate-200")}
                >
                  <div className={cn("w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", item.value ? "right-0.5" : "left-0.5")} />
                </button>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-300" />
              )}
            </div>
          ))}
        </div>

        {/* ── Sign Out ── */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-500 rounded-2xl font-semibold text-sm border border-red-100 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <p className="text-center text-[10px] text-slate-300">Stegofy v1.0.0</p>
      </div>

      {/* ── Address Modal ── */}
      {editingAddr !== null && (
        <AddressModal
          initial={editingAddr === "new" ? undefined : editingAddr}
          onSave={handleSaveAddr}
          onClose={() => setEditingAddr(null)}
        />
      )}

      {addrSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Saving…</p>
          </div>
        </div>
      )}
    </div>
  );
}
