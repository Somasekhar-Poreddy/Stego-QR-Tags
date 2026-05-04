import { useState } from "react";
import { Printer, X, FileImage, FileText, Zap, Maximize2, Grid3X3 } from "lucide-react";
import {
  STICKER_SIZES, DPI_PRESETS, DEFAULT_PRINT_SETTINGS,
  computePageLayout,
  type PrintSettings, type StickerSize, type OutputFormat,
} from "@/admin/utils/inventoryPdfGenerator";
import { cn } from "@/lib/utils";

interface PrintSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (settings: PrintSettings) => void;
  stickerCount: number;
  loading?: boolean;
}

export function PrintSettingsModal({ open, onClose, onConfirm, stickerCount, loading }: PrintSettingsModalProps) {
  const [size, setSize] = useState<StickerSize>(STICKER_SIZES[0]);
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [dpi, setDpi] = useState(300);
  const [format, setFormat] = useState<OutputFormat>("pdf");

  if (!open) return null;

  const wMm = useCustom ? (Number(customW) || 100) : size.widthMm;
  const hMm = useCustom ? (Number(customH) || 70) : size.heightMm;
  const layout = computePageLayout(wMm, hMm);
  const totalPages = Math.ceil(stickerCount / layout.perPage);

  const settings: PrintSettings = {
    size,
    dpi,
    format,
    ...(useCustom ? { customWidthMm: wMm, customHeightMm: hMm } : {}),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-slate-900">Print Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Sticker Size */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
              <Maximize2 className="w-3.5 h-3.5" /> Sticker Size
            </label>
            <div className="space-y-1.5">
              {STICKER_SIZES.map((s) => (
                <label
                  key={s.label}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                    !useCustom && size === s ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <input
                    type="radio" name="size" checked={!useCustom && size === s}
                    onChange={() => { setSize(s); setUseCustom(false); }}
                    className="accent-primary"
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
              <label
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  useCustom ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input type="radio" name="size" checked={useCustom} onChange={() => setUseCustom(true)} className="accent-primary" />
                <span className="text-sm">Custom:</span>
                <input
                  type="number" value={customW} onChange={(e) => { setCustomW(e.target.value); setUseCustom(true); }}
                  placeholder="W" min={30} max={200}
                  className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-md outline-none focus:border-primary"
                />
                <span className="text-xs text-slate-400">×</span>
                <input
                  type="number" value={customH} onChange={(e) => { setCustomH(e.target.value); setUseCustom(true); }}
                  placeholder="H" min={20} max={200}
                  className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-md outline-none focus:border-primary"
                />
                <span className="text-xs text-slate-400">mm</span>
              </label>
            </div>
          </div>

          {/* DPI / Quality */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
              <Zap className="w-3.5 h-3.5" /> Quality (DPI)
            </label>
            <div className="flex gap-2">
              {DPI_PRESETS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDpi(d.value)}
                  className={cn(
                    "flex-1 px-3 py-2.5 rounded-lg border text-center transition-colors",
                    dpi === d.value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300",
                  )}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{d.value} DPI</div>
                  <div className="text-[10px] text-slate-400">{d.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
              <FileText className="w-3.5 h-3.5" /> Output Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("pdf")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg border transition-colors",
                  format === "pdf" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300",
                )}
              >
                <FileText className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">PDF</div>
                  <div className="text-[10px] text-slate-400">Batch with cut guides</div>
                </div>
              </button>
              <button
                onClick={() => setFormat("png")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg border transition-colors",
                  format === "png" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300",
                )}
              >
                <FileImage className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">PNG</div>
                  <div className="text-[10px] text-slate-400">Individual images</div>
                </div>
              </button>
            </div>
          </div>

          {/* Page Layout Preview */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
              <Grid3X3 className="w-3.5 h-3.5" /> Page Layout Preview
            </div>
            <div className="flex gap-4 items-start">
              {/* Mini A4 preview */}
              <div className="border border-slate-300 bg-white rounded-md shadow-sm flex-shrink-0" style={{ width: 84, height: 119 }}>
                <div className="p-1.5 h-full flex flex-col gap-[1px] justify-center items-center">
                  {Array.from({ length: Math.min(layout.rows, 6) }).map((_, r) => (
                    <div key={r} className="flex gap-[1px]">
                      {Array.from({ length: layout.cols }).map((_, c) => (
                        <div
                          key={c}
                          className="bg-primary/20 rounded-[1px]"
                          style={{
                            width: Math.max(4, Math.round(70 / layout.cols)),
                            height: Math.max(3, Math.round(100 / layout.rows)),
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5 flex-1">
                <div><span className="font-semibold">{layout.cols} × {layout.rows}</span> = {layout.perPage} stickers per A4 page</div>
                <div>Sticker: <span className="font-semibold">{wMm} × {hMm} mm</span></div>
                <div>{stickerCount} stickers → <span className="font-semibold">{totalPages} page{totalPages !== 1 ? "s" : ""}</span></div>
                <div>Margins: {layout.sideMargin.toFixed(1)} mm sides, {layout.topMargin.toFixed(1)} mm top/bottom</div>
                <div>Resolution: ~{Math.round((wMm / 25.4) * dpi)} × {Math.round((hMm / 25.4) * dpi)} px per sticker</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(settings)}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>Generating...</>
            ) : (
              <><Printer className="w-4 h-4" /> Generate & Download</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
