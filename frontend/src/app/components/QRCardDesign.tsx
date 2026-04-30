import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { toPng } from "html-to-image";
import { Download, Share2, QrCode, Shield } from "lucide-react";
import QRCodeLib from "qrcode";
import { QRProfile } from "@/app/context/QRContext";
import { BrandIcon } from "@/components/Brand";
import { cn } from "@/lib/utils";

export interface QRCardDesignHandle {
  download: () => Promise<void>;
}

/* ─── Per-type card content ───────────────────────────────────────────────── */
const TYPE_CONTENT: Record<string, {
  heading: string;
  sub: string;
  icons: string[];
  iconLabel: string;
  gradient: string;
}> = {
  vehicle:    { heading: "Scan to contact\nthe vehicle owner.", sub: "Wrong parking, emergency contact,\nor any vehicle issue — scan the QR.", icons: ["🚗", "🚨", "📞", "⚠️"], iconLabel: "Wrong Parking, Emergency Contact, any issue with the vehicle, Scan the QR.", gradient: "from-blue-600 to-violet-700" },
  pet:        { heading: "Scan to help this\npet get home.", sub: "Lost pet? Scan to reach\nthe owner instantly.", icons: ["🐾", "🏠", "📞", "❤️"], iconLabel: "Lost pet? Scan to contact the owner and help them reunite.", gradient: "from-rose-500 to-pink-700" },
  child:      { heading: "Scan to contact\nthe parent.", sub: "Lost child? Scan to reach\na parent or guardian immediately.", icons: ["👦", "🏠", "📞", "🆘"], iconLabel: "Lost child? Scan to contact the parent or guardian.", gradient: "from-green-500 to-teal-700" },
  medical:    { heading: "Scan for emergency\nmedical info.", sub: "Critical health information\nfor first responders.", icons: ["🏥", "❤️", "📞", "🆘"], iconLabel: "Emergency medical info, blood group, allergies — scan now.", gradient: "from-red-500 to-rose-700" },
  luggage:    { heading: "Scan to return\nthis luggage.", sub: "Found this bag? Scan to reach\nthe owner and return it.", icons: ["🧳", "✈️", "📞", "🙏"], iconLabel: "Found this luggage? Scan to contact the owner.", gradient: "from-indigo-500 to-purple-700" },
  wallet:     { heading: "Scan to return\nthis lost item.", sub: "Found this wallet or keys? Scan\nto reach the owner.", icons: ["👛", "🔑", "📞", "🙏"], iconLabel: "Found this item? Scan to return it to the owner.", gradient: "from-amber-500 to-orange-700" },
  home:       { heading: "Scan to contact\nthe resident.", sub: "Delivery, visitor, or emergency —\nscan to reach the resident.", icons: ["🏠", "📦", "📞", "🔔"], iconLabel: "Delivery, visitor, or emergency — scan to contact resident.", gradient: "from-teal-500 to-cyan-700" },
  event:      { heading: "Scan to view\nevent details.", sub: "Get event info, schedule,\nand contact details instantly.", icons: ["🎫", "📅", "📞", "🎉"], iconLabel: "Scan to get event details, schedule, and contact info.", gradient: "from-fuchsia-500 to-purple-700" },
  business:   { heading: "Scan to connect\nwith us.", sub: "Get contact details, portfolio,\nand business info instantly.", icons: ["💼", "🌐", "📞", "🤝"], iconLabel: "Scan to get business contact details and portfolio.", gradient: "from-slate-600 to-slate-800" },
  belongings: { heading: "Scan to return\nthis item.", sub: "Found this item? Scan to reach\nthe owner and return it.", icons: ["🎒", "🔍", "📞", "🙏"], iconLabel: "Found this item? Scan to contact the owner.", gradient: "from-amber-500 to-yellow-700" },
};

/* ─── The actual printable card (fixed 680 × 360) ────────────────────────── */
interface CardInnerProps {
  profile: QRProfile;
  qrDataUrl: string | null;
  cardRef: React.RefObject<HTMLDivElement>;
}

function CardInner({ profile, qrDataUrl, cardRef }: CardInnerProps) {
  const content = TYPE_CONTENT[profile.type] ?? TYPE_CONTENT.belongings;
  const displayCode = profile.displayCode ?? "STG---------";
  const pinCode = profile.pinCode ?? "----";

  return (
    <div
      ref={cardRef}
      style={{ width: 680, height: 360, fontFamily: "'Poppins', sans-serif" }}
      className="flex rounded-[20px] overflow-hidden shadow-2xl flex-shrink-0 bg-white"
    >
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between px-9 py-8 bg-[#F8FAFC]" style={{ width: 374 }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <BrandIcon size={36} alt="StegoTags" />
          <div>
            <span className="text-lg font-extrabold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent leading-none">
              StegoTags
            </span>
            <p className="text-[9px] text-slate-400 leading-none mt-0.5 font-medium tracking-wide">SECURE QR IDENTITY</p>
          </div>
        </div>

        {/* Middle text */}
        <div className="flex-1 flex flex-col justify-center mt-4 mb-2">
          <p className="text-[11px] text-slate-500 font-medium mb-2 leading-relaxed">
            {profile.type === "vehicle" && profile.formData?.vehicle_number
              ? `StegoTags QR tag · ${profile.name}.\nContact owner, help in emergency, or wrong parking.`
              : `StegoTags QR tag · ${profile.name}.`}
          </p>

          <h2
            className="font-extrabold text-slate-900 leading-tight"
            style={{ fontSize: 22, whiteSpace: "pre-line" }}
          >
            {content.heading}
          </h2>
        </div>

        {/* Bottom */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">
            SCAN USING PHONE CAMERA, GOOGLE LENS OR ANY QR SCANNER APP.
          </p>

          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-blue-500" />
            <span className="text-[9px] font-semibold text-blue-500 tracking-wide">Privacy protected by StegoTags</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div
        className={cn("flex flex-col items-center justify-between py-7 px-6 bg-gradient-to-br flex-1", content.gradient)}
      >
        {/* QR code on white bg */}
        <div className="bg-white rounded-2xl p-3 shadow-lg">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" style={{ width: 148, height: 148 }} className="block" />
          ) : (
            <div style={{ width: 148, height: 148 }} className="bg-slate-100 rounded-xl flex items-center justify-center">
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>

        {/* Display code */}
        <div className="text-center">
          <p className="text-white font-extrabold tracking-widest text-sm leading-none">{displayCode}</p>
          <p className="text-white/70 text-[10px] font-semibold mt-1 tracking-wider">PIN: {pinCode}</p>
        </div>

        {/* Type-specific icons */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center gap-2">
            {content.icons.map((icon, i) => (
              <div key={i} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base backdrop-blur-sm">
                {icon}
              </div>
            ))}
          </div>
          <p className="text-white/80 text-[8px] font-medium text-center leading-relaxed px-2">
            {content.iconLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Public component with download + share ─────────────────────────────── */
export interface QRCardDesignProps {
  profile: QRProfile;
  /** If provided, used as the QR URL; otherwise falls back to profile.qrUrl */
  qrUrl?: string;
  showActions?: boolean;
}

export const QRCardDesign = forwardRef<QRCardDesignHandle, QRCardDesignProps>(function QRCardDesignInner({ profile, qrUrl, showActions = true }, imperativeRef) {
  const cardRef = useRef<HTMLDivElement>(null!);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolvedQrUrl = qrUrl ?? profile.qrUrl ?? `${window.location.origin}/qr/${profile.qrId ?? profile.id}`;

  useEffect(() => {
    QRCodeLib.toDataURL(resolvedQrUrl, {
      width: 296,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [resolvedQrUrl]);

  const handleDownloadPng = async () => {
    if (!cardRef.current || !qrDataUrl) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `stegotags-qr-${profile.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `StegoTags QR — ${profile.name}`,
          text: "Scan this QR code to contact me safely",
          url: resolvedQrUrl,
        });
        return;
      } catch (_) {}
    }
    await navigator.clipboard.writeText(resolvedQrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useImperativeHandle(imperativeRef, () => ({
    download: handleDownloadPng,
  }));

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Scrollable card preview */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="flex justify-start md:justify-center" style={{ minWidth: 680 }}>
          <CardInner profile={profile} qrDataUrl={qrDataUrl} cardRef={cardRef} />
        </div>
      </div>

      {/* PIN callout */}
      {profile.pinCode && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 w-full max-w-lg">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800">Security PIN</p>
            <p className="text-lg font-extrabold text-amber-900 tracking-widest">{profile.pinCode}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-amber-600 font-medium">Code</p>
            <p className="text-xs font-bold text-amber-800">{profile.displayCode}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-3 w-full max-w-lg">
          <button
            onClick={handleDownloadPng}
            disabled={downloading || !qrDataUrl}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 shadow-sm"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Preparing…" : "Download PNG"}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary/10 text-primary rounded-2xl text-sm font-semibold active:scale-95 transition-all"
          >
            <Share2 className="w-4 h-4" />
            {copied ? "Copied!" : "Share Link"}
          </button>
        </div>
      )}
    </div>
  );
});
