import { useEffect, useRef, useState } from "react";
import { Plus, QrCode, Eye, Edit, Share2, Trash2, Download, X, Check, Save } from "lucide-react";
import QRCode from "qrcode";
import { useQR, QRProfile } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
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
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrUrl = profile.qrUrl ?? `${window.location.origin}/qr/${profile.qrId ?? profile.id}`;

  useEffect(() => {
    QRCode.toDataURL(qrUrl, {
      width: 280,
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
    a.download = `stegofy-qr-${profile.name.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Stegofy QR — ${profile.name}`,
          text: "Scan this QR code to contact me safely",
          url: qrUrl,
        });
        return;
      } catch (_) {}
    }
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-5 pb-8 animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
            <p className="text-xs text-slate-400 capitalize">{profile.type} · {profile.scans} scans · Created {profile.createdAt}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR Code" className="w-52 h-52 rounded-2xl shadow-md mb-4" />
          ) : (
            <div className="w-52 h-52 bg-slate-100 rounded-2xl flex items-center justify-center animate-pulse mb-4">
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
          )}

          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-2 h-2 rounded-full", profile.status === "active" ? "bg-green-400" : "bg-slate-300")} />
            <span className="text-xs font-semibold text-slate-600 capitalize">{profile.status}</span>
          </div>
          <p className="text-xs text-slate-400 mb-5">Privacy: <span className="font-semibold capitalize">{profile.privacyMode}</span></p>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleDownload}
              disabled={!dataUrl}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-2xl text-sm font-semibold active:scale-95 transition-all"
            >
              <Share2 className="w-4 h-4" />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─────────────────────────────────────────────────────────── */
function EditModal({
  profile,
  onSave,
  onClose,
}: {
  profile: QRProfile;
  onSave: (updates: Partial<QRProfile>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [contact, setContact] = useState(profile.primaryContact);
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(profile.status);

  const handleSave = () => {
    onSave({ name: name.trim() || profile.name, primaryContact: contact.trim(), notes: notes.trim() || undefined, status });
    onClose();
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-5 pb-8 animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">Edit Profile</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Profile name"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Primary Contact</label>
            <input
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={inputClass}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Notes <span className="text-slate-400 font-normal">Optional</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="Any additional info for the finder..."
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">Status</p>
              <p className="text-xs text-slate-400">{status === "active" ? "QR is live and scannable" : "QR is paused"}</p>
            </div>
            <button
              onClick={() => setStatus((s) => s === "active" ? "inactive" : "active")}
              className={cn(
                "w-12 h-6 rounded-full transition-all flex items-center px-1",
                status === "active" ? "bg-green-500 justify-end" : "bg-slate-200 justify-start"
              )}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-5 w-full bg-gradient-to-r from-primary to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}

/* ─── QR Card ────────────────────────────────────────────────────────────── */
function QRCard({
  profile,
  onDelete,
  onUpdate,
}: {
  profile: QRProfile;
  onDelete: () => void;
  onUpdate: (updates: Partial<QRProfile>) => void;
}) {
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const qrUrl = profile.qrUrl ?? `${window.location.origin}/qr/${profile.qrId ?? profile.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Stegofy QR — ${profile.name}`,
          text: "Scan this QR code to contact me safely",
          url: qrUrl,
        });
        return;
      } catch (_) {}
    }
    await navigator.clipboard.writeText(qrUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
            onClick={handleShare}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform",
              shareCopied ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
            )}
          >
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {shareCopied ? "Copied!" : "Share"}
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
        <EditModal
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
