import { useState } from "react";
import { ShoppingBag, Plus, CheckCircle, Copy, QrCode, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQR } from "@/app/context/QRContext";
import { QRCardDesign } from "@/app/components/QRCardDesign";
import { downloadSingleStickerPdf } from "@/admin/utils/inventoryPdfGenerator";
import { cn } from "@/lib/utils";

export function QRSuccessScreen() {
  const [, navigate] = useLocation();
  const { profiles } = useQR();
  const latest = profiles[0];
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const qrUrl = latest?.qrUrl ?? `${window.location.origin}/qr/${latest?.qrId ?? "preview"}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSticker = async () => {
    if (!latest) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadSingleStickerPdf({
        id: latest.qrId ?? latest.id,
        qr_code: latest.qrId ?? latest.id,
        type: latest.type,
        category: null,
        status: "assigned",
        created_at: latest.createdAt,
        display_code: latest.displayCode ?? null,
        pin_code: latest.pinCode ?? null,
        qr_url: latest.qrUrl ?? null,
      });
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "PDF generation failed.");
    } finally {
      setDownloading(false);
    }
  };

  const canDownloadSticker = !!(latest?.displayCode && latest?.pinCode);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white flex flex-col items-center px-4 pt-8 pb-8">
      {/* Success badge */}
      <div className="relative mb-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow">
          <QrCode className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">QR Activated!</h1>
      <p className="text-sm text-slate-500 text-center mb-6">
        Your QR card is ready — download the sticker or share the link.
      </p>

      {/* Premium QR Card + download */}
      {latest ? (
        <div className="w-full max-w-2xl mb-6">
          <QRCardDesign profile={latest} qrUrl={qrUrl} showActions={true} />
        </div>
      ) : (
        <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-6 flex flex-col items-center">
          <div className="w-40 h-40 bg-slate-100 rounded-2xl flex items-center justify-center animate-pulse mb-4">
            <QrCode className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">Loading your card…</p>
        </div>
      )}

      {/* Copy link */}
      <button
        onClick={handleCopyLink}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all mb-4",
          copied ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        )}
      >
        <Copy className="w-3.5 h-3.5" />
        {copied ? "Link Copied!" : "Copy QR link"}
      </button>

      {/* Sticker PDF download — shown when the QR has a display code + PIN */}
      {canDownloadSticker && (
        <div className="w-full max-w-sm mb-6">
          <button
            onClick={handleDownloadSticker}
            disabled={downloading}
            className="w-full py-3 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generating PDF…" : "Download sticker PDF"}
          </button>
          {downloadError && (
            <p className="text-xs text-red-600 text-center mt-2">{downloadError}</p>
          )}
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Print and stick this on your item — it matches the physical Stegofy sticker layout.
          </p>
        </div>
      )}

      {/* Next actions */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => navigate("/app/shop")}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <ShoppingBag className="w-4 h-4" />
          Order Physical Tag
        </button>

        <button
          onClick={() => navigate("/app/qr/create")}
          className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Another Profile
        </button>

        <button
          onClick={() => navigate("/app")}
          className="w-full text-sm text-slate-400 py-2 text-center"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
