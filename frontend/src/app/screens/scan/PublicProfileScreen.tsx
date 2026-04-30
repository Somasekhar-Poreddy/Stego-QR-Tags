import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, Shield, AlertTriangle, AlertOctagon,
  Lightbulb, Truck, Wind, MapPin, HeartPulse, Navigation,
  HelpCircle, Phone, MessageCircle, X, Check, QrCode,
  PenLine, Video, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/sessionId";
import { apiUrl } from "@/lib/apiUrl";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface QRPublicData {
  id: string;
  type: string;
  data: Record<string, string | boolean>;
  pin_code: string | null;
  is_active: boolean;
  allow_contact: boolean;
  strict_mode: boolean;
  emergency_contact: string | null;
  name: string | null;
  privacy?: Record<string, boolean>;
}

interface IntentItem {
  id: string;
  label: string;
  Icon: React.ElementType;
}

/* ─── Intent lists ──────────────────────────────────────────────────────────── */
const EMERGENCY_INTENT: IntentItem = {
  id: "emergency",
  label: "Emergency 🚨",
  Icon: AlertOctagon,
};

const OTHERS_INTENT: IntentItem = {
  id: "others",
  label: "Others ✏️",
  Icon: PenLine,
};

/* Resolve a display noun from the dropdown value stored in data.vehicle_type */
function vehicleNoun(vehicleType: string | undefined): string {
  const t = (vehicleType || "").toLowerCase();
  if (t === "car") return "car";
  if (t === "bike") return "bike";
  if (t === "scooter") return "scooter";
  if (t === "auto rickshaw") return "auto";
  if (t === "truck") return "truck";
  if (t === "bus") return "bus";
  return "vehicle";
}

function getVehicleIntents(vehicleType: string | undefined): IntentItem[] {
  const noun = vehicleNoun(vehicleType);
  return [
    { id: "lights_on",       label: `The lights of this ${noun} are on.`,  Icon: Lightbulb },
    { id: "wrong_parking",   label: `The ${noun} is in no parking.`,        Icon: MapPin },
    { id: "getting_towed",   label: `The ${noun} is getting towed.`,        Icon: Truck },
    { id: "window_open",     label: `The window or ${noun} is open.`,       Icon: Wind },
    { id: "something_wrong", label: `Something wrong with this ${noun}.`,   Icon: AlertTriangle },
    OTHERS_INTENT,
    EMERGENCY_INTENT,
  ];
}

const PET_INTENTS: IntentItem[] = [
  { id: "found_pet",   label: "I found your pet.",          Icon: MapPin },
  { id: "pet_injured", label: "Pet appears to be injured.", Icon: HeartPulse },
  { id: "pet_roaming", label: "Pet is roaming alone.",      Icon: Navigation },
  OTHERS_INTENT,
  EMERGENCY_INTENT,
];

const CHILD_INTENTS: IntentItem[] = [
  { id: "found_child", label: "I found this child.", Icon: MapPin },
  { id: "needs_help",  label: "Child needs help.",   Icon: HelpCircle },
  OTHERS_INTENT,
  EMERGENCY_INTENT,
];

const GENERIC_INTENTS: IntentItem[] = [
  { id: "contact_owner", label: "I need to contact the owner.", Icon: Phone },
  { id: "general",       label: "General query.",               Icon: MessageCircle },
  OTHERS_INTENT,
  EMERGENCY_INTENT,
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function getIntents(type: string, strict: boolean, data: Record<string, string | boolean>): IntentItem[] {
  if (strict) return [EMERGENCY_INTENT];
  if (type === "vehicle") return getVehicleIntents(data.vehicle_type as string | undefined);
  if (type === "pet") return PET_INTENTS;
  if (type === "child") return CHILD_INTENTS;
  return GENERIC_INTENTS;
}

function getPageTitle(type: string): string {
  const titles: Record<string, string> = {
    vehicle:    "Contact vehicle owner.",
    pet:        "Help this pet get home.",
    child:      "Contact child's parent.",
    medical:    "Medical emergency contact.",
    home:       "Contact property owner.",
    belongings: "Contact item owner.",
    luggage:    "Contact luggage owner.",
    wallet:     "Contact item owner.",
    event:      "Contact event organiser.",
    business:   "Contact business owner.",
  };
  return titles[type] ?? "Contact tag owner.";
}

function getMaskedLabel(type: string, data: Record<string, string | boolean>): string {
  switch (type) {
    case "vehicle": {
      const num = (data.vehicle_number as string) || "";
      if (!num) return "Vehicle";
      const prefix = num.slice(0, 4).toUpperCase();
      return `${prefix}****`;
    }
    case "pet":
      return (data.pet_name as string) || "Pet";
    case "child":
      return "Child Safety Profile";
    case "medical":
      return "Medical Emergency ID";
    default:
      return (data.name as string) || (data.item_name as string) || "Tag Owner";
  }
}

function getSubLabel(type: string, data: Record<string, string | boolean>): string {
  switch (type) {
    case "vehicle":
      return [(data.vehicle_type as string), (data.vehicle_name as string)].filter(Boolean).join(" · ") || "Vehicle";
    case "pet":
      return [(data.breed as string), (data.gender as string)].filter(Boolean).join(" · ") || "Pet";
    case "child":
      return [(data.school_name as string), (data.age as string) ? `Age ${data.age}` : ""].filter(Boolean).join(" · ") || "Child";
    default:
      return getPageTitle(type);
  }
}

/* ─── India helplines ────────────────────────────────────────────────────────── */
const HELPLINES = [
  { label: "National Emergency", number: "112" },
  { label: "Police",             number: "100" },
  { label: "Fire",               number: "101" },
  { label: "Ambulance",          number: "102" },
  { label: "Women Helpline",     number: "1091" },
];

/* ─── Vehicle plate UI ──────────────────────────────────────────────────────── */
function VehiclePlate({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center border-2 border-slate-700 rounded-md overflow-hidden shadow-sm bg-white">
      <div className="flex flex-col items-center justify-center px-2 py-1.5 bg-blue-700 min-w-[36px]">
        <span className="text-[10px] text-white leading-none">🇮🇳</span>
        <span className="text-[9px] font-bold text-white leading-none mt-0.5">IND</span>
      </div>
      <div className="px-3 py-1.5">
        <span className="text-base font-black text-slate-900 tracking-widest">{text}</span>
      </div>
    </div>
  );
}

/* ─── Loading / error / inactive states ──────────────────────────────────────── */
function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 gap-4">
      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
        <QrCode className="w-7 h-7 text-primary" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
        <AlertOctagon className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{message}</h2>
      <p className="text-sm text-slate-400">This QR tag may have been removed or is unavailable.</p>
    </div>
  );
}

/* ─── Claim Splash (shown when the scanned id is an unclaimed inventory row) ─ */
function ClaimSplash({ displayCode, type }: { displayCode: string; type: string | null }) {
  const handleClaim = () => {
    // Stash the code so the flow survives the login detour if the visitor
    // isn't signed in yet — AppRouter picks this up after `step === "app"`.
    sessionStorage.setItem("stegofy_pending_claim", JSON.stringify({ code: displayCode }));
    window.location.href = `/app/claim?code=${encodeURIComponent(displayCode)}`;
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 text-center max-w-lg mx-auto">
      <div className="w-20 h-20 bg-gradient-to-br from-primary to-violet-600 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">This StegoTags QR is ready to be activated</h1>
      <p className="text-sm text-slate-500 mb-6">
        Claim it now to turn this sticker into your personal {type ?? "StegoTags"} tag. You'll need the 4-digit PIN printed next to the code.
      </p>
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-6 w-full max-w-xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Sticker code</p>
        <p className="font-mono text-lg font-bold text-slate-800">{displayCode}</p>
      </div>
      <button
        onClick={handleClaim}
        className="w-full max-w-xs bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
      >
        Claim it now
      </button>
      <p className="text-[11px] text-slate-400 mt-4">
        Already claimed? Refresh this page — the owner's public details will load.
      </p>
    </div>
  );
}

/* ─── Verify Modal ────────────────────────────────────────────────────────────── */
interface VerifyModalProps {
  qrType: string;
  vehicleNumberHint: string;
  onClose: () => void;
  /** Returns null on success, or an error message string on failure */
  onVerified: (args: { phone: string; pin: string; vehicleLast4: string }) => Promise<string | null>;
  pinCode: string | null;
  vehicleNumber: string;
}

type Step = "phone" | "otp" | "details";

function VerifyModal({ qrType, vehicleNumberHint, onClose, onVerified, pinCode, vehicleNumber }: VerifyModalProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChannel, setOtpChannel] = useState<string | null>(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [last4, setLast4] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePinChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...pin];
    next[i] = val.slice(-1);
    setPin(next);
    setError("");
    if (val && i < 3) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const requestOtp = async () => {
    if (!/^[+0-9 \-]{8,}$/.test(phone)) {
      setError("Please enter a valid mobile number.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/otp/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not send verification code. Please try again.");
        setSubmitting(false);
        return;
      }
      setOtpChannel(body.channel ?? "WhatsApp/SMS");
      // Dev convenience: prefill the code so local testing works without a real send.
      if (body.dev_code) setOtp(String(body.dev_code));
      setStep("otp");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{4,8}$/.test(otp)) {
      setError("Enter the verification code we just sent.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Code is incorrect or expired.");
        setSubmitting(false);
        return;
      }
      setStep("details");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const enteredPin = pin.join("");
    if (pinCode && enteredPin.length < 4) {
      setError("Please enter all 4 digits of the PIN.");
      return;
    }
    if (qrType === "vehicle" && vehicleNumber) {
      const last4Expected = vehicleNumber.slice(-4).toUpperCase();
      if (last4.toUpperCase() !== last4Expected) {
        setError("Vehicle number last 4 digits don't match. Please check and try again.");
        return;
      }
    }
    setSubmitting(true);
    const err = await onVerified({ phone, pin: enteredPin, vehicleLast4: last4 });
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Verify to Continue</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Step 1: Phone number → request OTP */}
        {step === "phone" && (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your Mobile Number</p>
              <p className="text-xs text-slate-400 mb-2">We'll send a one-time verification code to this number on WhatsApp (or SMS as fallback).</p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                placeholder="+91 98765 43210"
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              onClick={requestOtp}
              disabled={submitting || phone.trim().length < 8}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all mb-3"
            >
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </>
        )}

        {/* Step 2: OTP entry */}
        {step === "otp" && (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Enter the code</p>
              <p className="text-xs text-slate-400 mb-3">
                Code sent to <span className="font-semibold text-slate-600">{phone}</span>
                {otpChannel ? <> via <span className="font-semibold capitalize">{otpChannel}</span></> : null}.
              </p>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={8}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="123456"
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-base font-mono tracking-widest text-center text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); }}
                className="text-xs text-primary font-semibold mt-2 hover:underline"
              >
                Change number
              </button>
            </div>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              onClick={verifyOtp}
              disabled={submitting || otp.length < 4}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all mb-3"
            >
              {submitting ? "Verifying…" : "Verify code"}
            </button>
          </>
        )}

        {/* Step 3: PIN + (vehicle) last-4 → submit */}
        {step === "details" && (
          <>
            {pinCode && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  4-Digit PIN <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-slate-400 mb-3">Enter the 4-digit PIN printed on the physical QR tag.</p>
                <div className="flex gap-3 justify-center">
                  {pin.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      className={cn(
                        "w-14 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all bg-slate-50 text-slate-900",
                        error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {qrType === "vehicle" && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Last 4 digits of vehicle number <span className="text-red-500">*</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-400">{vehicleNumberHint}</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={last4}
                    onChange={(e) => { setLast4(e.target.value.toUpperCase()); setError(""); }}
                    placeholder="Last 4 Digits"
                    className="flex-1 h-12 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            )}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || (Boolean(pinCode) && pin.some((d) => !d))}
              className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all mb-3"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full text-sm text-slate-500 py-2 rounded-2xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Emergency Warning Modal ─────────────────────────────────────────────────── */
function EmergencyWarningModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Emergency</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Using emergency info for spam or prank is a punishable offence. Please use this only in case of a real emergency (e.g. accident, medical need, or to reach the vehicle owner's family).
        </p>
        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <div
            onClick={() => setChecked((c) => !c)}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
              checked ? "border-red-500 bg-red-500" : "border-slate-300"
            )}
          >
            {checked && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm text-slate-700">
            I confirm this is a genuine emergency and I need to contact the owner or emergency services.
          </span>
        </label>
        <button
          onClick={onConfirm}
          disabled={!checked}
          className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          View emergency contacts
        </button>
      </div>
    </div>
  );
}

/* ─── Emergency Contacts Modal ────────────────────────────────────────────────── */
interface EmergencyContactsModalProps {
  emergencyContact: string | null;
  data: Record<string, string | boolean>;
  onBack: () => void;
}

function EmergencyContactsModal({ emergencyContact, data, onBack }: EmergencyContactsModalProps) {
  const ec1 = (data.emergency_contact_1 as string) || null;
  const ec2 = (data.emergency_contact_2 as string) || null;
  const hasOwnerContacts = !!(emergencyContact || ec1 || ec2);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Emergency contacts</h2>
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Owner's emergency contacts */}
        {hasOwnerContacts ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-green-700">Owner's Emergency Contacts</p>
            {emergencyContact && (
              <a
                href={`tel:${emergencyContact}`}
                className="flex items-center gap-2 text-green-800 font-bold text-base"
              >
                <Phone className="w-5 h-5 flex-shrink-0" />
                {emergencyContact}
              </a>
            )}
            {ec1 && (
              <a
                href={`tel:${ec1}`}
                className="flex items-center gap-2 text-green-800 font-bold text-base"
              >
                <Phone className="w-5 h-5 flex-shrink-0" />
                <span>{ec1}</span>
                <span className="text-xs text-green-600 font-normal">(Contact 1)</span>
              </a>
            )}
            {ec2 && (
              <a
                href={`tel:${ec2}`}
                className="flex items-center gap-2 text-green-800 font-bold text-base"
              >
                <Phone className="w-5 h-5 flex-shrink-0" />
                <span>{ec2}</span>
                <span className="text-xs text-green-600 font-normal">(Contact 2)</span>
              </a>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
            <p className="text-sm text-slate-500">No emergency contact added for this tag. Use the All India helplines below.</p>
          </div>
        )}

        {/* India helplines */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm mb-5">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="w-4 h-4 text-red-500" />
              <p className="text-sm font-bold text-slate-900">All India emergency helplines</p>
            </div>
            <p className="text-xs text-slate-400">Use these if the owner's contacts are not available.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {HELPLINES.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm text-slate-700">{h.label}</span>
                <span className="text-sm font-bold text-red-500">{h.number}</span>
              </a>
            ))}
          </div>
        </div>

        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-200 transition-colors">
          Back
        </button>
      </div>
    </div>
  );
}

/* ─── Success Screen ──────────────────────────────────────────────────────────── */
/** Three terminal screens for the contact flow. */
function CallingScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5 animate-pulse">
        <Phone className="w-9 h-9 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Connecting your call…</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        Your phone should ring in a moment. We'll bridge you to the owner using a privacy-masked number — neither side sees the other's real number.
      </p>
      <div className="w-full max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left">
        <p className="text-xs font-semibold text-blue-700 mb-1">If your phone doesn't ring</p>
        <p className="text-xs text-blue-600">Make sure you're available on the number you provided. The call window is open for about 3 minutes.</p>
      </div>
      <button onClick={onDone} className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-700">
        Close
      </button>
    </div>
  );
}

function NotifiedScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
        <Check className="w-10 h-10 text-green-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Owner has been notified</h2>
      <p className="text-sm text-slate-500 mb-8">
        We sent your message to the owner over WhatsApp (with SMS as backup). They'll reach out if they choose to respond.
      </p>
      <div className="w-full max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left">
        <p className="text-xs font-semibold text-blue-700 mb-1">What happens next?</p>
        <p className="text-xs text-blue-600">The owner can accept or decline. If they accept, you'll be contacted on the phone number you provided.</p>
      </div>
      <button onClick={onDone} className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-700">
        Done
      </button>
    </div>
  );
}

function TryAgainLaterScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-5">
        <AlertOctagon className="w-9 h-9 text-amber-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Please try again in a moment</h2>
      <p className="text-sm text-slate-500 mb-8 max-w-sm">
        We couldn't get through to our messaging partners just now, or you've made a few requests in a short time. Please wait a minute and try again.
      </p>
      <button
        onClick={onRetry}
        className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

// Escalating retry delays for anon-session initialisation guard (ms)
const SCAN_RETRY_DELAYS = [600, 1200, 2000];

/* ─── Main Public Contact Page ────────────────────────────────────────────────── */
export function PublicProfileScreen() {
  const [qrData, setQrData] = useState<QRPublicData | null>(null);
  // Public comms-flag snapshot. Used to hide CTAs for channels the admin
  // has globally turned off; the server still rejects, this is just UX.
  const [commsFlags, setCommsFlags] = useState<{
    masked_call_enabled: boolean;
    message_enabled: boolean;
  } | null>(null);
  useEffect(() => {
    fetch(apiUrl("/api/comms/public-flags"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setCommsFlags(j); })
      .catch(() => { /* leave defaults — buttons stay visible */ });
  }, []);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [claimable, setClaimable] = useState<{ displayCode: string; type: string | null } | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [actionType, setActionType] = useState<"contact" | "message" | "video">("contact");
  const [showEmergencyWarning, setShowEmergencyWarning] = useState(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  // Terminal state for the contact flow. `null` means the user is still on the
  // profile page; the others render full-screen feedback components.
  const [outcome, setOutcome] = useState<"calling" | "notified" | "try_again" | null>(null);

  // Reactive scan ID — triggers intent-update effect when it arrives after async POST
  const [scanId, setScanId] = useState<string | null>(null);
  // Tracks whether the visitor submitted a contact request (for replay when scanId arrives late)
  const [pendingRequestMade, setPendingRequestMade] = useState(false);

  // Extract QR id from path: /qr/<id>
  const qrId = (() => {
    const match = window.location.pathname.match(/^\/qr\/([^/?#]+)/);
    return match?.[1] ?? "";
  })();

  // Keep a ref to the last successfully loaded QR data so we never overwrite
  // good data with a transient error or empty response from Supabase.
  const qrDataRef = useRef<QRPublicData | null>(null);

  // Session-guard + retry: PublicProfileScreen is anon-only (no user JWT to
  // refresh), so we guard against the brief window after page load where the
  // Supabase anon session hasn't established yet and RLS may reject the read.
  // Up to 3 attempts with escalating delays (module-level constant).
  // If all attempts fail AND no previously-loaded data exists, show not-found.
  const fetchQrData = useCallback(async (attempt = 0): Promise<void> => {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("id, type, data, pin_code, is_active, allow_contact, strict_mode, emergency_contact, name, privacy")
      .eq("id", qrId)
      .single();

    if (error || !data) {
      if (attempt < SCAN_RETRY_DELAYS.length) {
        await new Promise<void>((r) => setTimeout(r, SCAN_RETRY_DELAYS[attempt]));
        return fetchQrData(attempt + 1);
      }
      // qr_codes lookup exhausted — fall back to the API's claim-info endpoint.
      // This uses the service-role key server-side and bypasses RLS, so it
      // reliably detects freshly-printed unclaimed stickers and shows the
      // "Activate your QR" splash instead of a generic not-found error.
      try {
        const infoRes = await fetch(apiUrl(`/api/qr/info/${encodeURIComponent(qrId)}`));
        if (infoRes.ok) {
          const info = await infoRes.json() as { claimable?: boolean; display_code?: string; type?: string | null };
          if (info.claimable && info.display_code) {
            setClaimable({ displayCode: info.display_code, type: info.type ?? null });
            setLoading(false);
            return;
          }
        }
      } catch {
        // Network error — fall through to not-found
      }
      // All attempts failed — only mark not-found if no cached data exists
      if (!qrDataRef.current) setNotFound(true);
      setLoading(false);
      return;
    }

    qrDataRef.current = data as QRPublicData;
    setQrData(data as QRPublicData);
    setLoading(false);

    // Fire-and-forget: record this QR scan; setScanId triggers pending intent effect
    fetch(apiUrl("/api/track-scan"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qr_id: data.id,
        session_id: getSessionId(),
        referrer: document.referrer || null,
      }),
    })
      .then((r) => r.json())
      .then((body: { id?: string }) => {
        if (body.id) setScanId(body.id);
      })
      .catch(() => {});
  }, [qrId]);

  useEffect(() => {
    if (!qrId) { setLoading(false); setNotFound(true); return; }
    fetchQrData();
  }, [qrId, fetchQrData]);

  // Fire-and-forget: update scan row with intent on selection or when scan ID arrives.
  // Depends on both so it replays if user selected intent before POST returned.
  useEffect(() => {
    if (!selectedIntent || !scanId) return;
    fetch(apiUrl(`/api/track-scan/${scanId}/intent`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: selectedIntent }),
    }).catch(() => {});
  }, [selectedIntent, scanId]);

  // Fire-and-forget: mark is_request_made when contact request was submitted.
  // Fires when scanId arrives late (user submitted before POST returned).
  useEffect(() => {
    if (!pendingRequestMade || !scanId) return;
    fetch(apiUrl(`/api/track-scan/${scanId}/intent`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: selectedIntent, is_request_made: true }),
    }).catch(() => {});
  }, [pendingRequestMade, scanId, selectedIntent]);

  /**
   * Returns null on success, or a user-facing error string on failure.
   * Calls the new server-side comms platform — no direct DB writes here.
   * The router decides which provider (Zavu / Exotel) to use, logs delivery
   * status, and (for calls) sets up a masked Exotel bridge.
   */
  const handleVerified = async (args: { phone: string; pin: string; vehicleLast4: string }): Promise<string | null> => {
    if (!qrData) return "Something went wrong. Please refresh and try again.";

    const intent = selectedIntent ?? "others";
    const message = selectedIntent === "others" ? (customMessage || null) : null;

    // Map our 3 CTA types onto the 2 server endpoints. "video" is currently
    // surfaced as a message until the video bridge is wired up.
    const endpoint = actionType === "contact" ? "call" : "message";

    try {
      const res = await fetch(apiUrl(`/api/qr/${encodeURIComponent(qrData.id)}/contact/${endpoint}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: args.phone,
          pin: args.pin || undefined,
          vehicle_last4: args.vehicleLast4 || undefined,
          intent,
          message,
        }),
      });
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        if (res.status === 429) {
          setOutcome("try_again");
          setShowVerify(false);
          return null;
        }
        return (body.error as string) || "Could not deliver your request. Please try again in a moment.";
      }

      // Tell the analytics pipeline that a request was submitted (when scanId arrives).
      setPendingRequestMade(true);
      setShowVerify(false);
      setOutcome(endpoint === "call" ? "calling" : "notified");
      return null;
    } catch {
      setOutcome("try_again");
      setShowVerify(false);
      return null;
    }
  };

  /** Opens Emergency flow or Verify modal based on selected intent */
  const handleCTA = (type: "contact" | "message" | "video") => {
    if (selectedIntent === "emergency") {
      setShowEmergencyWarning(true);
    } else {
      setActionType(type);
      setShowVerify(true);
    }
  };

  if (loading) return <LoadingState />;
  if (claimable) return <ClaimSplash displayCode={claimable.displayCode} type={claimable.type} />;
  if (notFound) return <ErrorState message="QR tag not found" />;
  if (!qrData) return <ErrorState message="Something went wrong" />;
  if (!qrData.is_active) return <ErrorState message="This QR is inactive" />;
  if (outcome === "calling") return <CallingScreen onDone={() => setOutcome(null)} />;
  if (outcome === "notified") return <NotifiedScreen onDone={() => setOutcome(null)} />;
  if (outcome === "try_again") return <TryAgainLaterScreen onRetry={() => setOutcome(null)} />;

  const intents = getIntents(qrData.type, qrData.strict_mode, qrData.data);
  const maskedLabel = getMaskedLabel(qrData.type, qrData.data);
  const subLabel = getSubLabel(qrData.type, qrData.data);
  const pageTitle = getPageTitle(qrData.type);
  const vehicleNumber = (qrData.data?.vehicle_number as string) || "";
  const vehicleHint = vehicleNumber ? `${vehicleNumber.slice(0, 4).toUpperCase()}####` : "";
  const contactAllowed = qrData.allow_contact;
  const videoCallEnabled = qrData.privacy?.videoCall === true;
  // Comms feature flags fetched from /api/comms/public-flags. The server
  // also rejects disabled channels at the API layer, but hiding the buttons
  // up front keeps the public scan UX consistent with admin's Settings →
  // Communication Settings switches.
  const callEnabled = commsFlags?.masked_call_enabled ?? true;
  const messageEnabled = commsFlags?.message_enabled ?? true;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-slate-100 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-primary to-violet-600 rounded-md flex items-center justify-center">
              <QrCode className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black text-slate-900">StegoTags</span>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-8">
        {/* Title */}
        <h1 className="text-xl font-bold text-slate-900 mb-4">{pageTitle}</h1>

        {/* Masked identifier */}
        <div className="mb-5">
          {qrData.type === "vehicle" ? (
            <VehiclePlate text={maskedLabel} />
          ) : (
            <div className="inline-flex items-center gap-2 bg-slate-100 rounded-2xl px-4 py-2.5">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-slate-800">{maskedLabel}</span>
            </div>
          )}
          {subLabel && (
            <p className="text-xs text-slate-400 mt-1.5 ml-1">{subLabel}</p>
          )}
        </div>

        {/* Strict mode notice */}
        {qrData.strict_mode && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5">
            <p className="text-sm font-semibold text-amber-800">Strict privacy mode is enabled</p>
            <p className="text-xs text-amber-600 mt-0.5">Only emergency contact is available for this tag.</p>
          </div>
        )}

        {/* Intent list */}
        {intents.length > 0 && (
          <div className="mb-5">
            <div className="space-y-2">
              {intents.map((intent) => (
                <button
                  key={intent.id}
                  onClick={() => {
                    setSelectedIntent(intent.id);
                    if (intent.id !== "others") setCustomMessage("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] text-left",
                    selectedIntent === intent.id
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <intent.Icon className={cn("w-5 h-5 flex-shrink-0", selectedIntent === intent.id ? "text-primary" : "text-slate-400")} />
                  <span className={cn("flex-1 text-sm", selectedIntent === intent.id ? "text-primary font-semibold" : "text-slate-700")}>
                    {intent.label}
                  </span>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                    selectedIntent === intent.id ? "border-primary bg-primary" : "border-slate-300"
                  )}>
                    {selectedIntent === intent.id && <div className="w-full h-full rounded-full bg-white scale-[0.4]" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom message input for "Others" */}
            {selectedIntent === "others" && (
              <div className="mt-3">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Describe your reason for contacting the owner..."
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-primary/30 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-slate-400"
                />
              </div>
            )}
          </div>
        )}

        {/* Contact disabled notice */}
        {!contactAllowed && !qrData.strict_mode && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-5">
            <p className="text-sm text-slate-500">Owner has disabled contact requests for this tag.</p>
          </div>
        )}

        {/* CTA buttons */}
        {contactAllowed && (
          <div className="mb-4">
            {!qrData.strict_mode && (
              <p className="text-sm text-slate-600 mb-3">Would you like to call or text the owner?</p>
            )}
            <div className={cn(
              "grid gap-3",
              [callEnabled, messageEnabled, videoCallEnabled].filter(Boolean).length === 3 ? "grid-cols-3" :
              [callEnabled, messageEnabled, videoCallEnabled].filter(Boolean).length === 2 ? "grid-cols-2" : "grid-cols-1",
            )}>
              {/* Masked Call — hidden if globally disabled in Communication Settings. */}
              {callEnabled && (
                <button
                  onClick={() => handleCTA("contact")}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-amber-400 text-amber-600 font-semibold text-sm active:scale-[0.97] transition-all hover:bg-amber-50"
                >
                  <Phone className="w-6 h-6" />
                  Masked Call
                </button>
              )}

              {/* Message — requires intent selection; hidden if both WA + SMS off. */}
              {messageEnabled && (
                <button
                  onClick={() => handleCTA("message")}
                  disabled={!selectedIntent && intents.length > 0}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-blue-400 text-blue-600 font-semibold text-sm disabled:opacity-40 active:scale-[0.97] transition-all hover:bg-blue-50"
                >
                  <MessageCircle className="w-6 h-6" />
                  Message
                </button>
              )}

              {/* Video Call — only shown if owner enabled it */}
              {videoCallEnabled && (
                <button
                  onClick={() => handleCTA("video")}
                  disabled={!selectedIntent && intents.length > 0}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-violet-400 text-violet-600 font-semibold text-sm disabled:opacity-40 active:scale-[0.97] transition-all hover:bg-violet-50"
                >
                  <Video className="w-6 h-6" />
                  Video Call
                </button>
              )}
            </div>
          </div>
        )}

        {/* Emergency section */}
        <div className="mt-2">
          {!qrData.strict_mode && (
            <p className="text-xs text-slate-500 mb-3">
              Do you think this vehicle has had an accident and needs to contact family members or emergency services?
            </p>
          )}
          <button
            onClick={() => setShowEmergencyWarning(true)}
            className="flex items-center gap-2 bg-red-500 text-white font-semibold text-sm px-5 py-2.5 rounded-2xl active:scale-[0.97] transition-all hover:bg-red-600 shadow-sm shadow-red-200"
          >
            <AlertOctagon className="w-4 h-4" />
            Emergency
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-1 flex-wrap text-xs text-slate-400">
            <button
              onClick={() => { setActionType("message"); setShowVerify(true); }}
              className="hover:text-primary transition-colors"
            >
              💬 Need urgent help?
            </button>
            <span>·</span>
            <button className="hover:text-primary transition-colors">Report wrong info</button>
            <span>·</span>
            <button
              onClick={() => navigator.share?.({ title: "StegoTags QR", url: window.location.href })}
              className="hover:text-primary transition-colors"
            >
              Share
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-3">Protected by StegoTags · Privacy-first QR tagging</p>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showVerify && (
        <VerifyModal
          qrType={qrData.type}
          vehicleNumberHint={vehicleHint}
          vehicleNumber={vehicleNumber}
          pinCode={qrData.pin_code}
          onClose={() => setShowVerify(false)}
          onVerified={handleVerified}
        />
      )}

      {showEmergencyWarning && (
        <EmergencyWarningModal
          onClose={() => setShowEmergencyWarning(false)}
          onConfirm={() => { setShowEmergencyWarning(false); setShowEmergencyContacts(true); }}
        />
      )}

      {showEmergencyContacts && (
        <EmergencyContactsModal
          emergencyContact={qrData.emergency_contact}
          data={qrData.data}
          onBack={() => setShowEmergencyContacts(false)}
        />
      )}
    </div>
  );
}
