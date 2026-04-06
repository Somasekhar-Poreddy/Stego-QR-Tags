import { useState } from "react";
import { ChevronLeft, Camera, User, Phone, AlertCircle, FileText, Check, QrCode, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useQR, QRType } from "@/app/context/QRContext";
import { cn } from "@/lib/utils";

interface TypeDef {
  id: QRType;
  label: string;
  emoji: string;
  desc: string;
  bg: string;
  ring: string;
}

const PRIMARY_TYPES: TypeDef[] = [
  { id: "vehicle",    label: "Vehicle",     emoji: "🚗", desc: "Car, bike, truck",    bg: "bg-blue-50",   ring: "ring-blue-400" },
  { id: "pet",        label: "Pet",         emoji: "🐾", desc: "Dog, cat, bird",      bg: "bg-rose-50",   ring: "ring-rose-400" },
  { id: "child",      label: "Child",       emoji: "👦", desc: "School bag, ID card", bg: "bg-green-50",  ring: "ring-green-400" },
  { id: "medical",    label: "Medical",     emoji: "🏥", desc: "Health records, ID",  bg: "bg-red-50",    ring: "ring-red-400" },
  { id: "belongings", label: "Belongings",  emoji: "🎒", desc: "Bag, gadget, item",   bg: "bg-amber-50",  ring: "ring-amber-400" },
  { id: "home",       label: "Home",        emoji: "🏠", desc: "Gate, door, mailbox", bg: "bg-teal-50",   ring: "ring-teal-400" },
];

const SECONDARY_TYPES: TypeDef[] = [
  { id: "luggage", label: "Luggage",      emoji: "🧳", desc: "Travel bags, cases",  bg: "bg-indigo-50",  ring: "ring-indigo-400" },
  { id: "wallet",  label: "Wallet / Key", emoji: "👛", desc: "Wallet, keys, purse",  bg: "bg-violet-50",  ring: "ring-violet-400" },
  { id: "event",   label: "Event / NFC",  emoji: "🎫", desc: "Events, NFC tags",    bg: "bg-fuchsia-50", ring: "ring-fuchsia-400" },
];

const PRIVACY_OPTIONS = [
  { id: "show", label: "Show Number", desc: "Number visible to finder" },
  { id: "mask", label: "Mask Number", desc: "Call via masked bridge" },
  { id: "whatsapp", label: "WhatsApp Only", desc: "Message only, no call" },
  { id: "emergency", label: "Emergency Priority", desc: "Immediate connection" },
];

export function CreateQRScreen() {
  const [, navigate] = useLocation();
  const { addProfile } = useQR();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<QRType | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({ name: "", primaryContact: "", emergencyContact: "", notes: "" });
  const [privacy, setPrivacy] = useState<string>("mask");

  const handleFinish = () => {
    if (!type) return;
    const profile = addProfile({
      name: form.name || `My ${type} tag`,
      type,
      status: "active",
      primaryContact: form.primaryContact,
      emergencyContact: form.emergencyContact,
      notes: form.notes,
      privacyMode: privacy as any,
    });
    navigate("/app/qr/success");
  };

  return (
    <div className="min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
        <button onClick={() => step === 1 ? navigate("/app/qr") : setStep(s => s - 1)} className="p-1.5 rounded-xl hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-900">Create QR Profile</h1>
          <p className="text-xs text-slate-400">Step {step} of 4</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 px-4 py-3">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all", s <= step ? "bg-primary" : "bg-slate-100")} />
        ))}
      </div>

      <div className="flex-1 px-4 pt-2 pb-6 overflow-y-auto">
        {/* Step 1: Select type */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">What are you protecting?</h2>
            <p className="text-sm text-slate-500 mb-5">Choose the type that best fits your item</p>

            {/* Primary 6 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {PRIMARY_TYPES.map((t) => {
                const selected = type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 pt-4 pb-3.5 px-2 rounded-2xl border-2 transition-all active:scale-95 text-left",
                      selected
                        ? `border-primary bg-primary/5 ring-2 ring-primary/20`
                        : "border-slate-100 bg-white shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all",
                      selected ? "bg-primary/10" : t.bg
                    )}>
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
              })}
            </div>

            {/* More toggle */}
            <button
              onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
            >
              {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMore ? "Show less" : "More types"}
            </button>

            {/* Secondary 3 — expandable */}
            {showMore && (
              <div className="grid grid-cols-3 gap-3 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {SECONDARY_TYPES.map((t) => {
                  const selected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 pt-4 pb-3.5 px-2 rounded-2xl border-2 transition-all active:scale-95",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-slate-100 bg-white shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl",
                        selected ? "bg-primary/10" : t.bg
                      )}>
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
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Profile Details</h2>
              <p className="text-sm text-slate-500 mb-5">Fill in the details for this QR profile.</p>
            </div>

            {/* Photo */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                <Camera className="w-7 h-7 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500">Upload photo (optional)</span>
            </div>

            {[
              { key: "name", label: "Name / Title", icon: User, placeholder: "e.g. Bruno, Honda City" },
              { key: "primaryContact", label: "Primary Contact", icon: Phone, placeholder: "+91 98765 43210" },
              { key: "emergencyContact", label: "Emergency Contact", icon: AlertCircle, placeholder: "+91 98765 43210" },
              { key: "notes", label: "Notes", icon: FileText, placeholder: "Any additional info..." },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{f.label}</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <f.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {f.key === "notes" ? (
                    <textarea
                      placeholder={f.placeholder}
                      rows={2}
                      className="flex-1 bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400 resize-none"
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      className="flex-1 bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Privacy */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Privacy Settings</h2>
            <p className="text-sm text-slate-500 mb-5">How should finders contact you?</p>
            <div className="space-y-3">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPrivacy(opt.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                    privacy === opt.id ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50"
                  )}
                >
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", privacy === opt.id ? "border-primary bg-primary" : "border-slate-300")}>
                    {privacy === opt.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", privacy === opt.id ? "text-primary" : "text-slate-700")}>{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {step === 4 && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Ready to Generate!</h2>
            <p className="text-sm text-slate-500 mb-6">Your QR profile is configured. Tap below to generate your unique QR code.</p>
            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Type</span><span className="font-semibold text-slate-700 capitalize">{type}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Name</span><span className="font-semibold text-slate-700">{form.name || `My ${type} tag`}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Privacy</span><span className="font-semibold text-slate-700 capitalize">{privacy}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-4 border-t border-slate-100 bg-white">
        <button
          onClick={() => step < 4 ? setStep(s => s + 1) : handleFinish()}
          disabled={step === 1 && !type}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          {step === 4 ? "Generate QR Code" : "Continue"}
        </button>
      </div>
    </div>
  );
}
