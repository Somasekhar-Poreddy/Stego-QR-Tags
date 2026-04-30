import { Shield, Phone, MessageCircle, AlertOctagon, User } from "lucide-react";
import { useLocation } from "wouter";
import { AppHeader } from "@/app/components/AppHeader";

export function ScanProfileScreen() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-full bg-white flex flex-col">
      <AppHeader title="Scanned Profile" showNotification={false} />

      <div className="px-4 pt-6 pb-6 flex-1 flex flex-col">
        {/* Gradient card */}
        <div className="bg-gradient-to-br from-blue-500 to-violet-600 rounded-3xl p-6 mb-5 flex flex-col items-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Sample Profile</h2>
          <p className="text-blue-200 text-sm mt-1">QR Tag Preview</p>
          <div className="flex items-center gap-1.5 mt-3 bg-white/20 rounded-full px-3 py-1.5">
            <Shield className="w-3.5 h-3.5 text-white" />
            <span className="text-white/90 text-xs font-medium">Protected by StegoTags</span>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
          <p className="text-xs text-slate-500">
            In production, scanning a StegoTags QR code opens the owner's contact page at{" "}
            <span className="font-semibold text-primary">your-domain.com/qr/&lt;id&gt;</span>.
            Create a QR profile and share its link to see the full flow.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/app/qr")}
            className="w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Go to My QR Profiles
          </button>
          <button
            onClick={() => navigate("/app/qr/create")}
            className="w-full border-2 border-primary/30 text-primary font-semibold py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Create a New QR Profile
          </button>
        </div>

        {/* Emergency hint */}
        <div className="mt-auto pt-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span>Real QR pages include an Emergency contact option for finders.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
