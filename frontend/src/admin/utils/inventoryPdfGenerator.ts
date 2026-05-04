import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import type { QRInventoryItem } from "@/services/adminService";

export const STICKER_MM = { width: 100, height: 70 } as const;

/* ─── Print settings types ───────────────────────────────────────────────── */

export interface StickerSize {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const STICKER_SIZES: StickerSize[] = [
  { label: "Standard (100 × 70 mm)", widthMm: 100, heightMm: 70 },
  { label: "Wide (100 × 53 mm)", widthMm: 100, heightMm: 53 },
  { label: "Compact (80 × 50 mm)", widthMm: 80, heightMm: 50 },
  { label: "Large (120 × 84 mm)", widthMm: 120, heightMm: 84 },
];

export interface DpiPreset {
  label: string;
  value: number;
  description: string;
}

export const DPI_PRESETS: DpiPreset[] = [
  { label: "Draft", value: 150, description: "Fast, small file" },
  { label: "Standard", value: 300, description: "Good quality" },
  { label: "High", value: 600, description: "Print-shop quality" },
];

export type OutputFormat = "pdf" | "png";

export interface PrintSettings {
  size: StickerSize;
  dpi: number;
  format: OutputFormat;
  customWidthMm?: number;
  customHeightMm?: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  size: STICKER_SIZES[0],
  dpi: 300,
  format: "pdf",
};

export function computePageLayout(widthMm: number, heightMm: number, gapMm = 4) {
  const pageW = 210, pageH = 297; // A4
  const cols = Math.max(1, Math.floor((pageW + gapMm) / (widthMm + gapMm)));
  const rows = Math.max(1, Math.floor((pageH + gapMm) / (heightMm + gapMm)));
  const totalW = cols * widthMm + (cols - 1) * gapMm;
  const totalH = rows * heightMm + (rows - 1) * gapMm;
  const sideMargin = (pageW - totalW) / 2;
  const topMargin = (pageH - totalH) / 2;
  return { cols, rows, perPage: cols * rows, sideMargin, topMargin, totalW, totalH };
}

/* ─── Per-type content (matches QRCardDesign.tsx) ─────────────────────────── */

interface TypeContent {
  heading: string;
  sub: string;
  icons: string[];
  iconLabel: string;
  gradFrom: string;
  gradTo: string;
}

const TYPE_CONTENT: Record<string, TypeContent> = {
  vehicle:    { heading: "Scan to contact\nthe vehicle owner.", sub: "Stegofy QR tag. Contact owner, help\nin emergency, or wrong parking.", icons: ["🚗", "🚨", "📞", "⚠️"], iconLabel: "Wrong Parking, Emergency Contact, any issue with the vehicle, Scan the QR.", gradFrom: "#2563EB", gradTo: "#6D28D9" },
  pet:        { heading: "Scan to help this\npet get home.", sub: "Lost pet? Scan to reach\nthe owner instantly.", icons: ["🐾", "🏠", "📞", "❤️"], iconLabel: "Lost pet? Scan to contact the owner and help them reunite.", gradFrom: "#F43F5E", gradTo: "#BE185D" },
  child:      { heading: "Scan to contact\nthe parent.", sub: "Lost child? Scan to reach\na parent or guardian.", icons: ["👦", "🏠", "📞", "🆘"], iconLabel: "Lost child? Scan to contact the parent or guardian.", gradFrom: "#22C55E", gradTo: "#0F766E" },
  medical:    { heading: "Scan for emergency\nmedical info.", sub: "Critical health information\nfor first responders.", icons: ["🏥", "❤️", "📞", "🆘"], iconLabel: "Emergency medical info, blood group, allergies — scan now.", gradFrom: "#EF4444", gradTo: "#9F1239" },
  luggage:    { heading: "Scan to return\nthis luggage.", sub: "Found this bag? Scan to reach\nthe owner and return it.", icons: ["🧳", "✈️", "📞", "🙏"], iconLabel: "Found this luggage? Scan to contact the owner.", gradFrom: "#6366F1", gradTo: "#6B21A8" },
  wallet:     { heading: "Scan to return\nthis lost item.", sub: "Found this wallet or keys? Scan\nto reach the owner.", icons: ["👛", "🔑", "📞", "🙏"], iconLabel: "Found this item? Scan to return it to the owner.", gradFrom: "#F59E0B", gradTo: "#C2410C" },
  home:       { heading: "Scan to contact\nthe resident.", sub: "Delivery, visitor, or emergency —\nscan to reach the resident.", icons: ["🏠", "📦", "📞", "🔔"], iconLabel: "Delivery, visitor, or emergency — scan to contact resident.", gradFrom: "#14B8A6", gradTo: "#0E7490" },
  event:      { heading: "Scan to view\nevent details.", sub: "Get event info, schedule,\nand contact details instantly.", icons: ["🎫", "📅", "📞", "🎉"], iconLabel: "Scan to get event details, schedule, and contact info.", gradFrom: "#D946EF", gradTo: "#6B21A8" },
  business:   { heading: "Scan to connect\nwith us.", sub: "Get contact details, portfolio,\nand business info instantly.", icons: ["💼", "🌐", "📞", "🤝"], iconLabel: "Scan to get business contact details and portfolio.", gradFrom: "#475569", gradTo: "#1E293B" },
  belongings: { heading: "Scan to return\nthis item.", sub: "Found this item? Scan to reach\nthe owner and return it.", icons: ["🎒", "🔍", "📞", "🙏"], iconLabel: "Found this item? Scan to contact the owner.", gradFrom: "#F59E0B", gradTo: "#A16207" },
};

function contentFor(type: string | null | undefined): TypeContent {
  return TYPE_CONTENT[type ?? ""] ?? TYPE_CONTENT.belongings;
}

/* ─── Emoji → small PNG data URL (cached) ────────────────────────────────── */

const emojiCache = new Map<string, string>();

function emojiToPng(emoji: string, size = 64): string {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${size * 0.7}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + 2);
  const url = canvas.toDataURL("image/png");
  emojiCache.set(emoji, url);
  return url;
}

/* ─── QR code generation ─────────────────────────────────────────────────── */

async function toQrDataUrl(text: string): Promise<string> {
  return QRCodeLib.toDataURL(text, {
    width: 512, margin: 1,
    color: { dark: "#0F172A", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });
}

/* ─── SVG sticker builder ────────────────────────────────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgMultiline(lines: string[], x: number, y: number, fontSize: number, lineHeight: number, attrs: string): string {
  return lines.map((line, i) =>
    `<text x="${x}" y="${y + i * lineHeight}" font-size="${fontSize}" ${attrs}>${esc(line)}</text>`,
  ).join("\n");
}

function buildStickerSvg(
  item: { type?: string | null; display_code?: string | null; qr_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
  widthMm = 100,
  heightMm = 70,
): string {
  // Render the SVG at the same aspect ratio as the print slot so jsPDF
  // doesn't stretch the design. Base width = 1000px for ample resolution.
  const W = 1000;
  const H = Math.round(W * (heightMm / widthMm));
  const LEFT = Math.round(W * 0.54);
  const RIGHT_X = LEFT;
  const RIGHT_W = W - LEFT;
  const c = contentFor(item.type);
  const code = item.display_code ?? item.qr_code ?? "STG---------";
  const pin = item.pin_code ?? "----";
  const gradId = `g_${Math.random().toString(36).slice(2, 8)}`;

  // QR card sized to ~50% of the right panel width.
  const qrCardSize = Math.min(RIGHT_W - 60, H * 0.6);
  const qrInner = qrCardSize - 24;
  const qrCardX = RIGHT_X + (RIGHT_W - qrCardSize) / 2;
  const qrCardY = Math.round(H * 0.08);

  // Display code + PIN below the QR card.
  const codeY = qrCardY + qrCardSize + 36;
  const pinY = codeY + 22;

  // Icons row near the bottom of the right panel.
  const iconSize = Math.round(RIGHT_W * 0.085);
  const iconCircleR = iconSize * 0.85;
  const iconGap = iconSize * 0.5;
  const iconsTotalW = 4 * iconSize + 3 * iconGap;
  const iconsStartX = RIGHT_X + (RIGHT_W - iconsTotalW) / 2;
  const iconsY = H - Math.round(H * 0.18);

  const emojiImgs = c.icons.map((emoji, i) => {
    const png = emojiToPng(emoji);
    const x = iconsStartX + i * (iconSize + iconGap);
    return `<circle cx="${x + iconSize / 2}" cy="${iconsY + iconSize / 2}" r="${iconCircleR}" fill="rgba(255,255,255,0.22)"/>
            <image href="${png}" x="${x}" y="${iconsY}" width="${iconSize}" height="${iconSize}"/>`;
  }).join("\n");

  // Icon caption below icons.
  const captionY = iconsY + iconSize + 22;
  const caption = c.iconLabel.length > 70 ? c.iconLabel.slice(0, 67) + "..." : c.iconLabel;

  // Left panel layout — vertical proportions.
  const padX = Math.round(W * 0.04);
  const brandY = Math.round(H * 0.08);
  const subY = Math.round(H * 0.27);
  const headingY = Math.round(H * 0.42);
  const scanY1 = H - Math.round(H * 0.16);
  const scanY2 = scanY1 + 14;
  const privacyY = H - Math.round(H * 0.06);

  const headingLines = c.heading.split("\n");
  const subLines = c.sub.split("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.gradFrom}"/>
      <stop offset="100%" stop-color="${c.gradTo}"/>
    </linearGradient>
    <clipPath id="clip_${gradId}"><rect width="${W}" height="${H}" rx="22"/></clipPath>
  </defs>

  <g clip-path="url(#clip_${gradId})">
    <rect width="${LEFT}" height="${H}" fill="#F8FAFC"/>
    <rect x="${RIGHT_X}" width="${RIGHT_W}" height="${H}" fill="url(#${gradId})"/>

    <g transform="translate(${padX},${brandY})">
      <rect width="44" height="44" rx="10" fill="#2563EB"/>
      <path d="M22 10 L32 13.5 L32 22 Q32 28.5 22 33 Q12 28.5 12 22 L12 13.5 Z" fill="#fff"/>
      <path d="M18 19 Q18 17 20 17 L24 17 Q26 17 26 19 L24 19.5 Q23 18.5 21 19.5 Q20 20.5 22 21.5 L24 22 Q26 23 26 25 Q26 27 24 27 L20 27 Q18 27 18 25 L20 24 Q21 26 22 25 Q23 24 21 23 L19 22 Q18 21 18 19 Z" fill="#2563EB"/>
    </g>

    <text x="${padX + 56}" y="${brandY + 22}" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="800" fill="#2563EB">StegoTags</text>
    <text x="${padX + 56}" y="${brandY + 38}" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="500" fill="#94A3B8" letter-spacing="0.6">SECURE QR IDENTITY</text>

    ${svgMultiline(subLines, padX, subY, 14, 20, 'font-family="system-ui,-apple-system,sans-serif" font-weight="500" fill="#64748B"')}

    ${svgMultiline(headingLines, padX, headingY, 28, 36, 'font-family="system-ui,-apple-system,sans-serif" font-weight="800" fill="#0F172A"')}

    <text x="${padX}" y="${scanY1}" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="1.4">SCAN USING PHONE CAMERA, GOOGLE</text>
    <text x="${padX}" y="${scanY2}" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="1.4">LENS OR ANY QR SCANNER APP.</text>

    <g transform="translate(${padX},${privacyY - 11})">
      <path d="M7 1 L13 3 L13 8 Q13 12 7 14 Q1 12 1 8 L1 3 Z" fill="none" stroke="#3B82F6" stroke-width="1.4"/>
      <text x="20" y="11" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="#3B82F6" letter-spacing="0.3">Privacy protected by StegoTags</text>
    </g>

    <!-- QR card with shadow -->
    <rect x="${qrCardX + 4}" y="${qrCardY + 4}" width="${qrCardSize}" height="${qrCardSize}" rx="20" fill="rgba(0,0,0,0.12)"/>
    <rect x="${qrCardX}" y="${qrCardY}" width="${qrCardSize}" height="${qrCardSize}" rx="20" fill="#FFFFFF"/>
    <image href="${qrDataUrl}" x="${qrCardX + (qrCardSize - qrInner) / 2}" y="${qrCardY + (qrCardSize - qrInner) / 2}" width="${qrInner}" height="${qrInner}"/>

    <text x="${RIGHT_X + RIGHT_W / 2}" y="${codeY}" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="2.5">${esc(code)}</text>
    <text x="${RIGHT_X + RIGHT_W / 2}" y="${pinY}" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="rgba(255,255,255,0.78)" text-anchor="middle" letter-spacing="1.2">PIN: ${esc(pin)}</text>

    ${emojiImgs}

    <text x="${RIGHT_X + RIGHT_W / 2}" y="${captionY}" font-family="system-ui,-apple-system,sans-serif" font-size="10" font-weight="500" fill="rgba(255,255,255,0.85)" text-anchor="middle">${esc(caption)}</text>
  </g>
</svg>`;
}

/* ─── SVG → PNG via canvas (no html-to-image, no CORS) ───────────────────── */

function svgToPng(svgString: string, w: number, h: number, scale = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG render failed"));
    };
    img.src = url;
  });
}

/* ─── Concurrency helper ─────────────────────────────────────────────────── */

async function mapConcurrent<T, R>(
  arr: T[], limit: number, fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let cursor = 0;
  async function worker() {
    while (cursor < arr.length) {
      const i = cursor++;
      results[i] = await fn(arr[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, () => worker()));
  return results;
}

/* ─── Render one sticker to PNG ──────────────────────────────────────────── */

function dpiToScale(dpi: number, widthMm: number, svgW: number): number {
  const widthInches = widthMm / 25.4;
  const targetPx = widthInches * dpi;
  return Math.max(1, Math.round(targetPx / svgW));
}

async function renderStickerPng(
  item: { type?: string | null; display_code?: string | null; qr_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
  dpi = 300,
  widthMm = 100,
  heightMm = 70,
): Promise<string> {
  const svg = buildStickerSvg(item, qrDataUrl, widthMm, heightMm);
  const W = 1000;
  const H = Math.round(W * (heightMm / widthMm));
  const scale = dpiToScale(dpi, widthMm, W);
  return svgToPng(svg, W, H, scale);
}

/* ─── Scissors + cut guides (jsPDF drawing) ──────────────────────────────── */

function drawScissors(doc: jsPDF, x: number, y: number): void {
  doc.setDrawColor(15, 23, 42);
  doc.setFillColor(15, 23, 42);
  doc.setLineWidth(0.25);
  doc.circle(x + 0.5, y - 0.7, 0.45, "S");
  doc.circle(x + 0.5, y + 0.7, 0.45, "S");
  doc.line(x + 0.95, y - 0.7, x + 3.2, y);
  doc.line(x + 0.95, y + 0.7, x + 3.2, y);
}

function drawCutLineHorizontal(doc: jsPDF, x1: number, x2: number, y: number, withScissors = true): void {
  if (withScissors) drawScissors(doc, x1, y);
  doc.setDrawColor(120, 130, 145);
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(withScissors ? x1 + 4 : x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function drawCutLineVertical(doc: jsPDF, x: number, y1: number, y2: number): void {
  doc.setDrawColor(120, 130, 145);
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x, y1, x, y2);
  doc.setLineDashPattern([], 0);
}

const GAP_MM = 4;

function drawCutGuidesForLayout(
  doc: jsPDF, layout: ReturnType<typeof computePageLayout>,
  widthMm: number, heightMm: number, rowsOnPage: number, colsOnPage: number,
): void {
  const { sideMargin, topMargin } = layout;
  const totalW = colsOnPage * widthMm + (colsOnPage - 1) * GAP_MM;
  for (let r = 1; r < rowsOnPage; r++) {
    const yLine = topMargin + r * heightMm + (r - 1) * GAP_MM + GAP_MM / 2;
    drawCutLineHorizontal(doc, sideMargin - 4, sideMargin + totalW, yLine);
  }
  if (colsOnPage > 1) {
    for (let c = 1; c < colsOnPage; c++) {
      const xLine = sideMargin + c * widthMm + (c - 1) * GAP_MM + GAP_MM / 2;
      const yTop = topMargin;
      const yBot = topMargin + rowsOnPage * heightMm + (rowsOnPage - 1) * GAP_MM;
      drawCutLineVertical(doc, xLine, yTop, yBot);
      doc.setDrawColor(15, 23, 42);
      doc.setFillColor(15, 23, 42);
      doc.setLineWidth(0.25);
      doc.circle(xLine - 0.7, yTop - 0.7, 0.45, "S");
      doc.circle(xLine + 0.7, yTop - 0.7, 0.45, "S");
      doc.line(xLine - 0.7, yTop - 0.25, xLine, yTop + 1.5);
      doc.line(xLine + 0.7, yTop - 0.25, xLine, yTop + 1.5);
    }
  }
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export async function generateSingleStickerPng(
  item: QRInventoryItem,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
): Promise<string> {
  const wMm = settings.customWidthMm ?? settings.size.widthMm;
  const hMm = settings.customHeightMm ?? settings.size.heightMm;
  const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
  const qrDataUrl = await toQrDataUrl(qrText);
  return renderStickerPng(item, qrDataUrl, settings.dpi, wMm, hMm);
}

export async function generateSingleStickerPdf(
  item: QRInventoryItem,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const wMm = settings.customWidthMm ?? settings.size.widthMm;
  const hMm = settings.customHeightMm ?? settings.size.heightMm;
  const x = (pageW - wMm) / 2;
  const y = (pageH - hMm) / 2;

  const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
  const qrDataUrl = await toQrDataUrl(qrText);
  const png = await renderStickerPng(item, qrDataUrl, settings.dpi, wMm, hMm);
  doc.addImage(png, "PNG", x, y, wMm, hMm);
  return doc;
}

export async function generateBatchStickerPdf(
  items: QRInventoryItem[],
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  onProgress?: (done: number, total: number) => void,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const wMm = settings.customWidthMm ?? settings.size.widthMm;
  const hMm = settings.customHeightMm ?? settings.size.heightMm;
  const layout = computePageLayout(wMm, hMm, GAP_MM);

  const stickerPngs = await mapConcurrent(items, 2, async (item, i) => {
    const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
    const qrDataUrl = await toQrDataUrl(qrText);
    const png = await renderStickerPng(item, qrDataUrl, settings.dpi, wMm, hMm);
    if (onProgress) onProgress(i + 1, items.length);
    return png;
  });

  let slot = 0;
  let stickersOnPage = 0;
  for (let i = 0; i < items.length; i++) {
    if (slot === layout.perPage && i > 0) {
      drawCutGuidesForLayout(doc, layout, wMm, hMm, Math.ceil(stickersOnPage / layout.cols), Math.min(stickersOnPage, layout.cols));
      doc.addPage();
      slot = 0;
      stickersOnPage = 0;
    }
    const col = slot % layout.cols;
    const row = Math.floor(slot / layout.cols);
    const sx = layout.sideMargin + col * (wMm + GAP_MM);
    const sy = layout.topMargin + row * (hMm + GAP_MM);
    doc.addImage(stickerPngs[i], "PNG", sx, sy, wMm, hMm);
    slot++;
    stickersOnPage++;
  }
  if (stickersOnPage > 0) {
    drawCutGuidesForLayout(doc, layout, wMm, hMm, Math.ceil(stickersOnPage / layout.cols), Math.min(stickersOnPage, layout.cols));
  }
  return doc;
}

export async function downloadSingleSticker(
  item: QRInventoryItem,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
): Promise<void> {
  const fname = item.display_code ?? item.qr_code ?? `stegotags-${item.id.slice(0, 8)}`;
  if (settings.format === "png") {
    const png = await generateSingleStickerPng(item, settings);
    const a = document.createElement("a");
    a.href = png;
    a.download = `${fname}-sticker.png`;
    a.click();
  } else {
    const doc = await generateSingleStickerPdf(item, settings);
    doc.save(`${fname}-sticker.pdf`);
  }
}

export async function downloadBatchStickers(
  items: QRInventoryItem[],
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  batchNumber?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (settings.format === "png") {
    const pngs = await mapConcurrent(items, 2, async (item, i) => {
      const png = await generateSingleStickerPng(item, settings);
      if (onProgress) onProgress(i + 1, items.length);
      return { name: `${item.display_code ?? item.qr_code ?? item.id.slice(0, 8)}.png`, data: png };
    });
    for (const { name, data } of pngs) {
      const a = document.createElement("a");
      a.href = data;
      a.download = name;
      a.click();
      await new Promise((r) => setTimeout(r, 200));
    }
  } else {
    const doc = await generateBatchStickerPdf(items, settings, onProgress);
    doc.save(`${batchNumber ?? "stickers"}-stickers.pdf`);
  }
}

// Legacy API (backward compatibility — callers that don't pass settings yet)
export async function downloadSingleStickerPdf(item: QRInventoryItem): Promise<void> {
  return downloadSingleSticker(item);
}
export async function downloadBatchStickerPdf(
  items: QRInventoryItem[],
  batchNumber?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  return downloadBatchStickers(items, DEFAULT_PRINT_SETTINGS, batchNumber, onProgress);
}
