import { Plus, QrCode, Eye, Edit, Share2, Trash2 } from "lucide-react";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";

const TYPE_COLORS: Record<string, string> = {
  pet: "from-rose-400 to-pink-400",
  vehicle: "from-blue-400 to-cyan-400",
  child: "from-green-400 to-emerald-400",
  medical: "from-red-400 to-orange-400",
  luggage: "from-indigo-400 to-purple-400",
  wallet: "from-amber-400 to-yellow-400",
  home: "from-teal-400 to-cyan-400",
  event: "from-fuchsia-400 to-pink-400",
  business: "from-slate-500 to-slate-400",
};

function QRCard({ profile, onDelete }: { profile: QRProfile; onDelete: () => void }) {
  const [, navigate] = useLocation();
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header gradient */}
      <div className={cn("bg-gradient-to-br h-16 relative flex items-center px-4", TYPE_COLORS[profile.type] || "from-slate-400 to-slate-300")}>
        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <QrCode className="w-5 h-5 text-white" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-bold text-white">{profile.name}</p>
          <p className="text-xs text-white/70 capitalize">{profile.type}</p>
        </div>
        <div className={cn("ml-auto w-2 h-2 rounded-full", profile.status === "active" ? "bg-green-300" : "bg-white/50")} />
      </div>

      {/* Stats row */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-slate-400">Scans</p>
            <p className="text-sm font-bold text-slate-800">{profile.scans}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Privacy</p>
            <p className="text-xs font-semibold text-slate-700 capitalize">{profile.privacyMode}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Created</p>
            <p className="text-xs font-semibold text-slate-700">{profile.createdAt}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-2.5 flex items-center gap-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95 transition-transform">
          <Eye className="w-3.5 h-3.5" /> View
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition-transform">
          <Edit className="w-3.5 h-3.5" /> Edit
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition-transform">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
        <button
          onClick={onDelete}
          className="p-2 bg-red-50 text-red-500 rounded-xl active:scale-95 transition-transform"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MyQRScreen() {
  const { profiles, deleteProfile } = useQR();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="My QR Profiles" showNotification={false} />

      <div className="px-4 pt-4 pb-4 space-y-3">
        {profiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <p className="text-slate-700 font-semibold mb-1">No QR profiles yet</p>
            <p className="text-xs text-slate-400 mb-5">Create your first QR profile to get started</p>
          </div>
        ) : (
          profiles.map((p) => (
            <QRCard key={p.id} profile={p} onDelete={() => deleteProfile(p.id)} />
          ))
        )}

        <button
          onClick={() => navigate("/qr/create")}
          className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-4 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> Create New QR
        </button>
      </div>
    </div>
  );
}
