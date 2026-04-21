import { useState } from "react";
import { Plus, QrCode, Eye, Edit, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { QRCardDesign } from "@/app/components/QRCardDesign";
import { EditQRModal } from "@/app/components/EditQRModal";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
  belongings: "from-amber-400 to-orange-400",
};

/* ─── View Modal ─────────────────────────────────────────────────────────── */
function ViewModal({ profile, onClose }: { profile: QRProfile; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
            <p className="text-xs text-slate-400 capitalize mt-0.5">
              {profile.type} · {profile.scans} scans · Created {profile.createdAt}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors -mr-1">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable content — premium card + download */}
        <div className="overflow-y-auto flex-1 px-4 py-5">
          <QRCardDesign profile={profile} showActions={true} />
        </div>
      </div>
    </div>
  );
}


/* ─── QR Card ────────────────────────────────────────────────────────────── */
function QRCard({
  profile,
  onDelete,
  onUpdate,
  defaultEditOpen = false,
}: {
  profile: QRProfile;
  onDelete: () => void;
  onUpdate: (updates: Partial<QRProfile>) => void;
  defaultEditOpen?: boolean;
}) {
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(defaultEditOpen);
  const [, navigate] = useLocation();

  const isActive = profile.isActive !== false && profile.status === "active";
  const callsOn = profile.allowContact !== false;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Colour header */}
        <div className={cn("bg-gradient-to-br h-16 relative flex items-center px-4", TYPE_COLORS[profile.type] || "from-slate-400 to-slate-300")}>
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile.name}</p>
            <p className="text-xs text-white/70 capitalize">{profile.type}</p>
          </div>
          {/* Status + calls pills */}
          <div className="flex flex-col items-end gap-1 ml-2">
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              isActive ? "bg-green-400/30 text-white" : "bg-white/20 text-white/70"
            )}>
              {isActive ? "ACTIVE" : "INACTIVE"}
            </span>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              callsOn ? "bg-white/20 text-white/90" : "bg-white/10 text-white/50"
            )}>
              {callsOn ? "Calls on" : "Calls off"}
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-4 py-2 flex items-center gap-4 border-b border-slate-50">
          <div>
            <p className="text-[10px] text-slate-400">Scans</p>
            <p className="text-sm font-bold text-slate-800">{profile.scans}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Privacy</p>
            <p className="text-xs font-semibold text-slate-700 capitalize">{profile.privacyMode}</p>
          </div>
          {profile.displayCode && (
            <div className="ml-auto">
              <p className="text-[10px] text-slate-400">Code</p>
              <p className="text-[11px] font-mono font-semibold text-slate-600">{profile.displayCode}</p>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setShowView(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => navigate(`/app/qr/${profile.id}/manage`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Manage
          </button>
          <button
            onClick={onDelete}
            className="p-2 bg-red-50 text-red-500 rounded-xl active:scale-95 transition-transform"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showView && <ViewModal profile={profile} onClose={() => setShowView(false)} />}
      {showEdit && (
        <EditQRModal
          profile={profile}
          onSave={onUpdate}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export function MyQRScreen() {
  const { profiles, deleteProfile, updateProfile } = useQR();
  const [, navigate] = useLocation();
  // When navigating from ManageQR "Edit and Rewrite Tag", the URL is /app/qr?edit=<id>
  const [pendingEditId] = useState(() => new URLSearchParams(window.location.search).get("edit"));

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
            <QRCard
              key={p.id}
              profile={p}
              onDelete={() => deleteProfile(p.id)}
              onUpdate={(updates) => updateProfile(p.id, updates)}
              defaultEditOpen={pendingEditId === p.id}
            />
          ))
        )}

        <button
          onClick={() => navigate("/app/qr/create")}
          className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-4 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> Create New QR
        </button>
      </div>
    </div>
  );
}
