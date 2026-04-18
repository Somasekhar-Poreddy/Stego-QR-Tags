import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, KeyRound, ArrowRight, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQR, type QRType } from "@/app/context/QRContext";
import { cn } from "@/lib/utils";

type Step = "verify" | "profile" | "submitting";

const PRIVACY_OPTIONS: { key: "show" | "mask" | "whatsapp" | "emergency"; label: string; hint: string }[] = [
  { key: "mask",      label: "Masked contact",   hint: "Finder can request to contact — your number stays private." },
  { key: "show",      label: "Show contact",     hint: "Display your phone number directly on the public page." },
  { key: "whatsapp",  label: "WhatsApp only",    hint: "Open a WhatsApp chat with you when scanned." },
  { key: "emergency", label: "Emergency only",   hint: "Contact visible only when the finder marks it an emergency." },
];

function readQueryParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key)?.trim() ?? "";
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function ClaimQRScreen() {
  const [, navigate] = useLocation();
  const { addProfile } = useQR();

  const [step, setStep] = useState<Step>("verify");
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Verify
  const [displayCode, setDisplayCode] = useState(readQueryParam("code").toUpperCase());
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [inventoryType, setInventoryType] = useState<QRType>("belongings");

  // Step 2 — Profile
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [privacy, setPrivacy] = useState<"show" | "mask" | "whatsapp" | "emergency">("mask");
  const [notes, setNotes] = useState("");

  // Clear any stashed pending claim — we're now running it.
  useEffect(() => {
    sessionStorage.removeItem("stegofy_pending_claim");
  }, []);

  const handleVerify = async () => {
    setError(null);
    const code = displayCode.trim().toUpperCase();
    const p = pin.trim();
    if (!code || !p) { setError("Enter both the sticker code and the 4-digit PIN."); return; }
    setVerifying(true);
    try {
      const token = await getAccessToken();
      if (!token) { setError("You need to sign in to claim a QR."); return; }
      const res = await fetch("/api/admin/inventory/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_code: code, pin_code: p }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        type?: string | null;
        error?: string;
      };
      if (!res.ok) { setError(body.error ?? `Verification failed (${res.status})`); return; }
      if (body.type) setInventoryType(body.type as QRType);
      setStep("profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during verification.");
    } finally {
      setVerifying(false);
    }
  };

  const handleFinalize = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    setStep("submitting");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("You need to sign in to complete the claim.");
      const res = await fetch("/api/admin/inventory/claim/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_code: displayCode.trim().toUpperCase(),
          pin_code: pin.trim(),
          profile: {
            name: name.trim(),
            type: inventoryType,
            privacy_mode: privacy,
            primary_contact: contact.trim() || undefined,
            notes: notes.trim() || undefined,
            data: {},
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { qr_id?: string; error?: string };
      if (!res.ok || !body.qr_id) throw new Error(body.error ?? `Claim failed (${res.status})`);

      // Add the new profile to the QR context so QRSuccessScreen has something
      // to render and MyQRScreen picks it up without a full reload.
      addProfile({
        name: name.trim(),
        type: inventoryType,
        status: "active",
        primaryContact: contact.trim(),
        notes: notes.trim() || undefined,
        privacyMode: privacy,
        qrId: body.qr_id,
        qrUrl: `${window.location.origin}/qr/${body.qr_id}`,
        displayCode: displayCode.trim().toUpperCase(),
        pinCode: pin.trim(),
        isActive: true,
        allowContact: true,
        strictMode: false,
      });

      navigate("/app/qr/success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed.");
      setStep("profile");
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white px-4 pt-6 pb-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Claim your Stegofy QR</h1>
            <p className="text-xs text-slate-500">Activate the sticker in front of you.</p>
          </div>
        </div>

        {step === "verify" && (
          <div className="space-y-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Enter the code and PIN printed on your sticker. They're on the right side of the label.
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

        {(step === "profile" || step === "submitting") && (
          <div className="space-y-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Verified</p>
                <p className="font-mono text-sm font-bold text-slate-800">{displayCode.toUpperCase()}</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize">
                {inventoryType}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={inventoryType === "pet" ? "Pet's name" : inventoryType === "vehicle" ? "Nickname for this vehicle" : "A name for this tag"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Primary contact number</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+91 ..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Privacy</label>
              <div className="space-y-2">
                {PRIVACY_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors",
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
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything a finder should know — medical details, reward, preferred language…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep("verify")}
                disabled={step === "submitting"}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleFinalize}
                disabled={step === "submitting"}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {step === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {step === "submitting" ? "Finalizing…" : "Activate QR"}
              </button>
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
