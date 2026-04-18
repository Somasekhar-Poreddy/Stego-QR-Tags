import { useState, useEffect } from "react";
import { X, Loader2, FileDown, Mail, ChevronRight, AlertTriangle, Paperclip, Bold, Italic, List } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  sendBatchToVendor,
  getBatchById,
  sendVendorEmail,
  getEmailStatus,
  type QRInventoryBatch,
} from "@/services/adminService";
import {
  generateBatchStickerPdf,
  downloadBatchStickerPdf,
} from "@/admin/utils/inventoryPdfGenerator";

interface Props {
  batch: QRInventoryBatch;
  onClose: () => void;
  onDone: () => void;
}

type Step = "details" | "email";

const DEFAULT_BODY = (batchNumber: string, count: number, vendorName: string) =>
  `<p>Hi ${vendorName || "Team"},</p>
<p>Please find attached the print-ready PDF for <strong>Batch ${batchNumber}</strong> containing <strong>${count} Stegofy QR stickers</strong> (100&times;70&nbsp;mm each, 8 per A4 page).</p>
<p>Please confirm receipt and let us know the expected dispatch date.</p>
<p>Thanks,<br/>Stegofy Admin</p>`;

export function SendToVendorModal({ batch, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("details");

  const [vendorName, setVendorName] = useState(batch.vendor_name ?? "");
  const [vendorContact, setVendorContact] = useState(batch.vendor_contact ?? "");
  const [vendorNotes, setVendorNotes] = useState(batch.vendor_notes ?? "");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [emailTo, setEmailTo] = useState(batch.vendor_contact ?? "");
  const [emailSubject, setEmailSubject] = useState(
    `Stegofy QR Batch ${batch.batch_number} – Print Ready`,
  );
  const [attachPdf, setAttachPdf] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: DEFAULT_BODY(batch.batch_number, batch.total_count, batch.vendor_name ?? ""),
  });

  useEffect(() => {
    getEmailStatus()
      .then((d) => setEmailConfigured(d.configured))
      .catch(() => setEmailConfigured(false));
  }, []);

  const handleNextStep = async () => {
    if (!vendorName.trim()) {
      setDetailsError("Vendor name is required.");
      return;
    }
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      await sendBatchToVendor({
        batchId: batch.id,
        vendorName: vendorName.trim(),
        vendorContact: vendorContact.trim() || undefined,
        vendorNotes: vendorNotes.trim() || undefined,
      });
      if (vendorContact.trim()) setEmailTo(vendorContact.trim());
      setStep("email");
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to update vendor details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) { setEmailError("Recipient email is required."); return; }
    if (!emailSubject.trim()) { setEmailError("Subject is required."); return; }
    setEmailError(null);
    setEmailLoading(true);

    try {
      const { items } = await getBatchById(batch.id);

      let pdfBase64: string | undefined;
      if (attachPdf && items.length > 0) {
        setPdfProgress({ done: 0, total: items.length });
        const doc = await generateBatchStickerPdf(items, (done, total) =>
          setPdfProgress({ done, total }),
        );
        pdfBase64 = doc.output("datauristring");
        setPdfProgress(null);
      }

      await sendVendorEmail({
        batchId: batch.id,
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        html: editor?.getHTML() ?? "<p></p>",
        attachPdf,
        pdfBase64,
        pdfFilename: `${batch.batch_number}-stickers.pdf`,
      });

      if (attachPdf && items.length > 0) {
        await downloadBatchStickerPdf(items, batch.batch_number);
      }

      onDone();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setEmailLoading(false);
      setPdfProgress(null);
    }
  };

  const handleSkipEmail = async () => {
    try {
      const { items } = await getBatchById(batch.id);
      if (items.length > 0) {
        setPdfProgress({ done: 0, total: items.length });
        await downloadBatchStickerPdf(items, batch.batch_number, (done, total) =>
          setPdfProgress({ done, total }),
        );
      }
    } finally {
      setPdfProgress(null);
    }
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              {step === "details" ? "Send batch to vendor" : "Compose email to vendor"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {batch.batch_number} · {batch.total_count} QRs
            </p>
          </div>
          <button onClick={onClose} disabled={detailsLoading || emailLoading} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-3 flex items-center gap-2 text-xs font-semibold">
          <span className={step === "details" ? "text-primary" : "text-slate-400"}>1 Vendor details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={step === "email" ? "text-primary" : "text-slate-400"}>2 Compose email</span>
        </div>

        {/* ── Step 1: Vendor details ── */}
        {step === "details" && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendor name *</label>
                <input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendor email / phone</label>
                <input
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                  placeholder="vendor@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                <textarea
                  value={vendorNotes}
                  onChange={(e) => setVendorNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
              {detailsError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{detailsError}</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={onClose} disabled={detailsLoading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleNextStep} disabled={detailsLoading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {detailsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {detailsLoading ? "Saving…" : "Next: Compose Email"}
                {!detailsLoading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Email composer ── */}
        {step === "email" && (
          <>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {emailConfigured === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>RESEND_API_KEY not configured.</strong> Email cannot be sent.
                    Add it in Settings → API Keys, or{" "}
                    <button onClick={handleSkipEmail} className="underline font-semibold">skip & download PDF</button> instead.
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">To</label>
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="vendor@example.com"
                  type="email"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Subject</label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Message</label>
                {/* Toolbar */}
                <div className="flex items-center gap-1 px-2 py-1.5 border border-b-0 border-slate-200 rounded-t-xl bg-slate-50">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
                    className={`p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors ${editor?.isActive("bold") ? "bg-slate-200" : ""}`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
                    className={`p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors ${editor?.isActive("italic") ? "bg-slate-200" : ""}`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }}
                    className={`p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors ${editor?.isActive("bulletList") ? "bg-slate-200" : ""}`}
                    title="Bullet list"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
                <EditorContent
                  editor={editor}
                  className="min-h-[140px] border border-slate-200 rounded-b-xl px-3 py-2 text-sm text-slate-800 outline-none focus-within:border-primary transition-colors [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic"
                />
              </div>

              {/* Attach PDF */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachPdf}
                  onChange={(e) => setAttachPdf(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">
                  Attach batch PDF ({batch.total_count} stickers, 100×70mm)
                </span>
              </label>

              {pdfProgress && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-slate-600 mb-1">
                    Generating PDF… {pdfProgress.done} / {pdfProgress.total}
                  </p>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(pdfProgress.done / Math.max(1, pdfProgress.total)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {emailError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                  {emailError}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleSkipEmail}
                disabled={emailLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <FileDown className="w-4 h-4" /> PDF only
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailLoading || emailConfigured === false}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {emailLoading
                  ? pdfProgress ? "Generating PDF…" : "Sending…"
                  : <><Mail className="w-4 h-4" /> Send Email</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
