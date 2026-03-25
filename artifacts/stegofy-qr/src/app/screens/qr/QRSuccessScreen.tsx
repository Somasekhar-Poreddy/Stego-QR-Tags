import { QrCode, Download, Share2, ShoppingBag, Plus, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQR } from "@/app/context/QRContext";

export function QRSuccessScreen() {
  const [, navigate] = useLocation();
  const { profiles } = useQR();
  const latest = profiles[0];

  return (
    <div className="min-h-full bg-white flex flex-col items-center px-6 pt-12 pb-8">
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <QrCode className="w-4 h-4 text-white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">QR Generated!</h1>
      <p className="text-sm text-slate-500 text-center mb-8">
        Your QR code is ready. Share or download it to use.
      </p>

      {/* Mock QR code */}
      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-6 shadow-sm">
        <div className="w-48 h-48 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 relative overflow-hidden">
          {/* Fake QR grid */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {Array.from({ length: 49 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: Math.random() > 0.4 ? "#0F172A" : "transparent" }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-1 rounded-lg">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3 font-medium">{latest?.name || "My QR Profile"}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full mb-4">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-2xl text-sm font-semibold active:scale-95 transition-transform">
          <Download className="w-4 h-4" /> Download
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-2xl text-sm font-semibold active:scale-95 transition-transform">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={() => navigate("/app/shop")}
          className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <ShoppingBag className="w-4 h-4" /> Order Physical Tag
        </button>
        <button
          onClick={() => navigate("/app/qr/create")}
          className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" /> Add Another Profile
        </button>
        <button onClick={() => navigate("/app")} className="w-full text-sm text-slate-400 py-2 text-center">
          Back to Home
        </button>
      </div>
    </div>
  );
}
