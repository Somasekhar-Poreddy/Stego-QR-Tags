import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, Shield, AlertTriangle, AlertOctagon,
  Lightbulb, Truck, Wind, MapPin, HeartPulse, Navigation,
  HelpCircle, Phone, MessageCircle, X, Check, QrCode,
  PenLine, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/sessionId";

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

/* ─── Verify Modal ────────────────────────────────────────────────────────────── */
interface VerifyModalProps {
  qrType: string;
  vehicleNumberHint: string;
  onClose: () => void;
  /** Returns null on success, or an error message string on failure */
  onVerified: (phone: string) => Promise<string | null>;
  pinCode: string | null;
  vehicleNumber: string;
}

function VerifyModal({ qrType, vehicleNumberHint, onClose, onVerified, pinCode, vehicleNumber }: VerifyModalProps) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [last4, setLast4] = useState("");
  const [phone, setPhone] = useState("");
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

  const handleSubmit = async () => {
    const enteredPin = pin.join("");
    if (enteredPin.length < 4) {
      setError("Please enter all 4 digits of the PIN.");
      return;
    }
    if (pinCode && enteredPin !== pinCode) {
      setError("Incorrect PIN. Please check the PIN printed on the tag.");
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
    const insertError = await onVerified(phone);
    if (insertError) {
      setError(insertError);
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

        {/* PIN input */}
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

        {/* Vehicle last-4 field */}
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

        {/* Phone number */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your Phone Number</p>
          <p className="text-xs text-slate-400 mb-2">We need this to set up a masked call between you and the owner.</p>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full h-12 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || pin.some((d) => !d)}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all mb-3"
        >
          {submitting ? "Verifying..." : "Submit Request"}
        </button>
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
function SuccessScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
        <Check className="w-10 h-10 text-green-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Owner has been notified</h2>
      <p className="text-sm text-slate-500 mb-8">
        Your contact request has been sent. The owner will reach out soon if they accept your request.
      </p>
      <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">What happens next?</p>
        <p className="text-xs text-blue-600">The owner will receive a notification and can choose to accept or decline your contact request. You may be contacted via your provided phone number.</p>
      </div>
    </div>
  );
}

/* ─── Main Public Contact Page ────────────────────────────────────────────────── */
export function PublicProfileScreen() {
  const [qrData, setQrData] = useState<QRPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [actionType, setActionType] = useState<"contact" | "message" | "video">("contact");
  const [showEmergencyWarning, setShowEmergencyWarning] = useState(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  // Session-guard + retry: PublicProfileScreen is an *anon* screen so there is
  // no user JWT to refresh. Instead we guard against the brief window after page
  // load where the Supabase anon session hasn't established yet (RLS returns an
  // error/empty before the client is fully initialised).
  //
  // Strategy:
  //  1. On any Supabase error or empty result, wait 800 ms and try once more.
  //  2. If both attempts fail, only show "not found" if no good data is cached in
  //     `qrDataRef` — otherwise the last-good state is preserved silently.
  const fetchQrData = useCallback(async (retries = 1): Promise<void> => {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("id, type, data, pin_code, is_active, allow_contact, strict_mode, emergency_contact, name, privacy")
      .eq("id", qrId)
      .single();

    if (error || !data) {
      if (retries > 0) {
        await new Promise<void>((r) => setTimeout(r, 800));
        return fetchQrData(retries - 1);
      }
      // Both attempts failed — only show "not found" if no good data was loaded previously
      if (!qrDataRef.current) setNotFound(true);
      setLoading(false);
      return;
    }

    qrDataRef.current = data as QRPublicData;
    setQrData(data as QRPublicData);
    setLoading(false);

    // Fire-and-forget: record this QR scan; setScanId triggers pending intent effect
    fetch("/api/track-scan", {
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
    fetch(`/api/track-scan/${scanId}/intent`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: selectedIntent }),
    }).catch(() => {});
  }, [selectedIntent, scanId]);

  // Fire-and-forget: mark is_request_made when contact request was submitted.
  // Fires when scanId arrives late (user submitted before POST returned).
  useEffect(() => {
    if (!pendingRequestMade || !scanId) return;
    fetch(`/api/track-scan/${scanId}/intent`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: selectedIntent, is_request_made: true }),
    }).catch(() => {});
  }, [pendingRequestMade, scanId, selectedIntent]);

  /** Returns null on success, or an error message on DB failure */
  const handleVerified = async (phone: string): Promise<string | null> => {
    if (qrData) {
      let ip_address: string | null = null;
      let location: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const geoRes = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
        if (geoRes.ok) {
          const geo = await geoRes.json() as { ip?: string; city?: string; country_name?: string; latitude?: number; longitude?: number };
          ip_address = geo.ip ?? null;
          const parts = [geo.city, geo.country_name].filter(Boolean);
          location = parts.length > 0 ? parts.join(", ") : null;
          latitude = geo.latitude ?? null;
          longitude = geo.longitude ?? null;
        }
      } catch { /* silently skip geo — don't block submission */ }

      const { error } = await supabase.from("contact_requests").insert({
        qr_id: qrData.id,
        intent: selectedIntent,
        message: selectedIntent === "others" ? (customMessage || null) : null,
        action_type: actionType,
        requester_phone: phone || null,
        ip_address,
        location,
        latitude,
        longitude,
        status: "pending",
      });
      if (error) {
        console.error("contact_requests insert failed:", error);
        return "Failed to send request. Please check your connection and try again.";
      }
      // Signal that contact request was submitted; effect sends is_request_made update
      // (handles both fast path where scanId exists, and late-arriving scanId race)
      setPendingRequestMade(true);
    }
    setShowVerify(false);
    setSubmitted(true);
    return null;
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
  if (notFound) return <ErrorState message="QR tag not found" />;
  if (!qrData) return <ErrorState message="Something went wrong" />;
  if (!qrData.is_active) return <ErrorState message="This QR is inactive" />;
  if (submitted) return <SuccessScreen />;

  const intents = getIntents(qrData.type, qrData.strict_mode, qrData.data);
  const maskedLabel = getMaskedLabel(qrData.type, qrData.data);
  const subLabel = getSubLabel(qrData.type, qrData.data);
  const pageTitle = getPageTitle(qrData.type);
  const vehicleNumber = (qrData.data?.vehicle_number as string) || "";
  const vehicleHint = vehicleNumber ? `${vehicleNumber.slice(0, 4).toUpperCase()}####` : "";
  const contactAllowed = qrData.allow_contact;
  const videoCallEnabled = qrData.privacy?.videoCall === true;

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
            <span className="text-sm font-black text-slate-900">Stegofy</span>
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
            <div className={cn("grid gap-3", videoCallEnabled ? "grid-cols-3" : "grid-cols-2")}>
              {/* Masked Call — always enabled, no message selection required */}
              <button
                onClick={() => handleCTA("contact")}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-amber-400 text-amber-600 font-semibold text-sm active:scale-[0.97] transition-all hover:bg-amber-50"
              >
                <Phone className="w-6 h-6" />
                Masked Call
              </button>

              {/* Message — requires intent selection */}
              <button
                onClick={() => handleCTA("message")}
                disabled={!selectedIntent && intents.length > 0}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-blue-400 text-blue-600 font-semibold text-sm disabled:opacity-40 active:scale-[0.97] transition-all hover:bg-blue-50"
              >
                <MessageCircle className="w-6 h-6" />
                Message
              </button>

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
            <a
              href={`https://wa.me/919999999999?text=Urgent%20-%20QR%20ID%3A%20${qrId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              💬 Urgent — Stegofy us
            </a>
            <span>·</span>
            <button className="hover:text-primary transition-colors">Report wrong info</button>
            <span>·</span>
            <button
              onClick={() => navigator.share?.({ title: "Stegofy QR", url: window.location.href })}
              className="hover:text-primary transition-colors"
            >
              Share
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-3">Protected by Stegofy · Privacy-first QR tagging</p>
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
