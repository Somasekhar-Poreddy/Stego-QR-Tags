import { useState } from "react";
import { ScanLine, Flashlight, FlipHorizontal, ChevronLeft, QrCode } from "lucide-react";
import { useLocation } from "wouter";
import { AppHeader } from "@/app/components/AppHeader";

export function ScanScreen() {
  const [, navigate] = useLocation();
  const [scanned, setScanned] = useState(false);

  const simulateScan = () => {
    setScanned(true);
    setTimeout(() => navigate("/app/scan/profile"), 1000);
  };

  return (
    <div className="min-h-full bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app")} className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-bold text-white">Scan QR Code</h1>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-slate-900" style={{ minHeight: "70vh" }}>
        {/* Fake camera feed */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 flex items-center justify-center">
          <div className="opacity-10 text-slate-400 text-9xl">📷</div>
        </div>

        {/* Scan frame */}
        <div className="relative z-10 w-60 h-60">
          {/* Corners */}
          {[
            "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
            "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
            "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
            "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-10 h-10 border-primary ${cls}`} />
          ))}

          {/* Scan line animation */}
          {!scanned && (
            <div
              className="absolute left-2 right-2 h-0.5 bg-primary/70 blur-sm shadow-lg shadow-primary animate-[scanLine_2s_ease-in-out_infinite]"
              style={{ top: "50%", animation: "scanLine 2s ease-in-out infinite" }}
            />
          )}

          {scanned && (
            <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <div className="bg-green-500 rounded-2xl p-4 shadow-xl">
                <QrCode className="w-8 h-8 text-white" />
              </div>
            </div>
          )}
        </div>

        <p className="absolute bottom-24 left-0 right-0 text-center text-white/60 text-sm px-8">
          {scanned ? "QR code detected!" : "Point your camera at a Stegofy QR tag"}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="bg-black px-6 pt-5 pb-8 flex flex-col items-center gap-5">
        <div className="flex items-center gap-6">
          <button className="p-3 bg-white/10 rounded-2xl text-white">
            <Flashlight className="w-5 h-5" />
          </button>
          <button
            onClick={simulateScan}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          >
            <ScanLine className="w-7 h-7 text-slate-900" />
          </button>
          <button className="p-3 bg-white/10 rounded-2xl text-white">
            <FlipHorizontal className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/40 text-xs">Tap the scan button to simulate a scan</p>
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  );
}
