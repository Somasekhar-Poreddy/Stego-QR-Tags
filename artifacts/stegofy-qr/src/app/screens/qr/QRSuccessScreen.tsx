import { useEffect, useRef, useState } from "react";
import { Download, Share2, ShoppingBag, Plus, CheckCircle, Copy, QrCode } from "lucide-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { useQR } from "@/app/context/QRContext";
import { cn } from "@/lib/utils";

export function QRSuccessScreen() {
  const [, navigate] = useLocation();
  const { profiles } = useQR();
  const latest = profiles[0];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const qrUrl = latest?.qrUrl ?? `${window.location.origin}/qr/${latest?.qrId ?? "preview"}`;

  useEffect(() => {
    if (!qrUrl) return;
    QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [qrUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `stegofy-qr-${latest?.name?.replace(/\s+/g, "-") ?? "code"}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Stegofy QR — ${latest?.name}`,
          text: "Scan this QR code to contact me safely",
          url: qrUrl,
        });
      } catch (_) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white flex flex-col items-center px-6 pt-10 pb-8">
      {/* Success icon */}
      <div className="relative mb-5">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow">
          <QrCode className="w-4 h-4 text-white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">QR Generated!</h1>
      <p className="text-sm text-slate-500 text-center mb-7">
        Your QR code is ready. Share or download it.
      </p>

      {/* QR code card */}
      <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200 border border-slate-100 mb-6 w-full max-w-xs">
        <div className="flex flex-col items-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR Code"
              className="w-48 h-48 rounded-2xl"
            />
          ) : (
            <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center animate-pulse">
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm font-bold text-slate-900">{latest?.name ?? "My QR Profile"}</p>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{latest?.type} · Stegofy</p>
          </div>

          {/* Link pill */}
          <button
            onClick={handleCopyLink}
            className={cn(
              "mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              copied ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full max-w-xs mb-3">
        <button
          onClick={handleDownload}
          disabled={!dataUrl}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-100 text-slate-700 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary/10 text-primary rounded-2xl text-sm font-semibold active:scale-95 transition-all"
        >
          <Share2 className="w-4 h-4" />
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => navigate("/shop")}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <ShoppingBag className="w-4 h-4" />
          Order Physical Tag
        </button>

        <button
          onClick={() => navigate("/qr/create")}
          className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Another Profile
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full text-sm text-slate-400 py-2 text-center"
        >
          Back to Home
        </button>
      </div>

      {/* Hidden canvas for reference */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
