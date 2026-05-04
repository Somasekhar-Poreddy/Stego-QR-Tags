import { useEffect, useRef, useState } from "react";
import { X, Loader2, Download, Trash2, ExternalLink, Save, QrCode as QrCodeIcon } from "lucide-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import {
  getInventoryById,
  getInventoryAssignedUser,
  updateInventoryItem,
  deleteInventoryItem,
  type QRInventoryItem,
  type QRInventoryEvent,
} from "@/services/adminService";
import { downloadSingleSticker, type PrintSettings } from "@/admin/utils/inventoryPdfGenerator";
import { PrintSettingsModal } from "@/admin/components/PrintSettingsModal";
import { STATUS_LABELS, statusBadge, formatDateTime, QR_TYPES } from "./inventoryHelpers";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  onClose: () => void;
  onChanged: () => void;
  openToEdit?: boolean;
}

type AssignedUser = { id: string; name: string | null; email: string | null };

export function InventoryDetailSlideOver({ itemId, onClose, onChanged, openToEdit }: Props) {
  const [, navigate] = useLocation();
  const [item, setItem] = useState<QRInventoryItem | null>(null);
  const [events, setEvents] = useState<QRInventoryEvent[]>([]);
  const [assignedUser, setAssignedUser] = useState<AssignedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const editSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to edit form when openToEdit=true and content is loaded
  useEffect(() => {
    if (openToEdit && !loading && editSectionRef.current) {
      editSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = editSectionRef.current.querySelector<HTMLElement>("select,input");
      firstInput?.focus();
    }
  }, [openToEdit, loading]);

  // Edit form state
  const [editType, setEditType] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getInventoryById(itemId)
      .then(async ({ item, events }) => {
        if (!alive) return;
        setItem(item);
        setEvents(events);
        if (item) {
          setEditType(item.type ?? "");
          setEditCategory(item.category ?? "");
          setEditVendor(item.vendor_name ?? "");
          // Fire-and-forget the QR preview + user lookup (neither blocks the panel).
          if (item.qr_url) {
            QRCode.toDataURL(item.qr_url, { margin: 1, width: 260 })
              .then((url) => alive && setQrPreview(url))
              .catch(() => {});
          }
          if (item.linked_user_id) {
            getInventoryAssignedUser(item.linked_user_id)
              .then((u) => alive && setAssignedUser(u))
              .catch(() => {});
          }
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [itemId]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      await updateInventoryItem(item.id, {
        type: editType || null,
        category: editCategory || null,
        vendor_name: editVendor || null,
      });
      onChanged();
      // Refresh the local copy so the header reflects the edit.
      setItem({ ...item, type: editType || null, category: editCategory || null, vendor_name: editVendor || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Delete QR ${item.display_code ?? item.qr_code}? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteInventoryItem(item.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
      setDeleting(false);
    }
  };

  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const handleDownloadPdf = () => {
    if (!item) return;
    setShowPrintSettings(true);
  };
  const handlePrintConfirm = async (settings: PrintSettings) => {
    if (!item) return;
    setShowPrintSettings(false);
    try {
      await downloadSingleSticker(item, settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate sticker.");
    }
  };

  const goToUser = () => {
    if (!assignedUser) return;
    onClose();
    navigate(`/admin/users?focus=${assignedUser.id}`);
  };

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{item?.display_code ?? "Inventory item"}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{item?.qr_code ?? itemId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !item ? (
            <div className="p-8 text-center text-sm text-slate-400">Item not found.</div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Sticker preview */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 flex flex-col items-center gap-3">
                {qrPreview ? (
                  <img src={qrPreview} alt="QR preview" className="w-40 h-40 rounded-xl bg-white p-2 shadow-sm" />
                ) : (
                  <div className="w-40 h-40 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-300">
                    <QrCodeIcon className="w-12 h-12" />
                  </div>
                )}
                <div className="text-center">
                  <p className="font-mono text-sm font-bold text-slate-800">{item.display_code ?? "—"}</p>
                  <p className="font-mono text-xs text-slate-500 mt-0.5">PIN: {item.pin_code ?? "—"}</p>
                </div>
                <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", statusBadge(item.status))}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>

              {/* Assigned user card */}
              {item.status === "assigned" && (
                <div className="border border-green-200 bg-green-50 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1">Assigned to</p>
                  {assignedUser ? (
                    <button
                      onClick={goToUser}
                      className="w-full text-left flex items-center justify-between gap-2 hover:bg-green-100 -mx-1 px-1 py-1 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{assignedUser.name ?? "Unnamed"}</p>
                        <p className="text-xs text-slate-500 truncate">{assignedUser.email ?? "—"}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">Looking up user…</p>
                  )}
                </div>
              )}

              {/* Edit form */}
              <div className="space-y-3" ref={editSectionRef}>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Edit</h4>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white">
                    <option value="">—</option>
                    {QR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
                  <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendor</label>
                  <input value={editVendor} onChange={(e) => setEditVendor(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
                </div>
                <button onClick={handleSave} disabled={saving} className="w-full py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Activity</h4>
                {events.length === 0 ? (
                  <p className="text-xs text-slate-400">No events yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {events.map((e) => (
                      <li key={e.id} className="border-l-2 border-slate-200 pl-3 py-1">
                        <p className="text-xs font-semibold text-slate-700 capitalize">{e.event_type.replace(/_/g, " ")}</p>
                        {e.description && <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>}
                        <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(e.created_at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
            </div>
          )}
        </div>

        {item && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
            <button onClick={handleDownloadPdf} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || item.status === "assigned"}
              title={item.status === "assigned" ? "Cannot delete an assigned QR" : "Delete this QR"}
              className="flex-1 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        )}
      </aside>
      <PrintSettingsModal
        open={showPrintSettings}
        onClose={() => setShowPrintSettings(false)}
        onConfirm={handlePrintConfirm}
        stickerCount={1}
      />
    </div>
  );
}
