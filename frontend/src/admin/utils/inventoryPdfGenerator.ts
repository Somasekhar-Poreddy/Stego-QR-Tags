import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import type { QRInventoryItem } from "@/services/adminService";

export const STICKER_MM = { width: 100, height: 70 } as const;

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
): string {
  const W = 680, H = 360, LEFT = 374;
  const RIGHT_X = LEFT, RIGHT_W = W - LEFT;
  const c = contentFor(item.type);
  const code = item.display_code ?? item.qr_code ?? "STG---------";
  const pin = item.pin_code ?? "----";
  const gradId = `g_${Math.random().toString(36).slice(2, 8)}`;

  const emojiImgs = c.icons.map((emoji, i) => {
    const png = emojiToPng(emoji);
    const cx = RIGHT_X + RIGHT_W / 2 - 78 + i * 40;
    const cy = H - 68;
    return `<circle cx="${cx + 16}" cy="${cy + 16}" r="18" fill="rgba(255,255,255,0.22)"/>
            <image href="${png}" x="${cx}" y="${cy}" width="32" height="32"/>`;
  }).join("\n");

  const headingLines = c.heading.split("\n");
  const subLines = c.sub.split("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.gradFrom}"/>
      <stop offset="100%" stop-color="${c.gradTo}"/>
    </linearGradient>
    <clipPath id="clip_${gradId}"><rect width="${W}" height="${H}" rx="20"/></clipPath>
  </defs>

  <g clip-path="url(#clip_${gradId})">
    <!-- Left panel -->
    <rect width="${LEFT}" height="${H}" fill="#F8FAFC"/>

    <!-- Right panel gradient -->
    <rect x="${RIGHT_X}" width="${RIGHT_W}" height="${H}" fill="url(#${gradId})"/>

    <!-- Brand icon -->
    <g transform="translate(36,32)">
      <rect width="36" height="36" rx="8" fill="#2563EB"/>
      <path d="M18 8 L26 11 L26 18 Q26 23.5 18 27 Q10 23.5 10 18 L10 11 Z" fill="#fff"/>
      <path d="M15 15.5 Q15 14 16.5 14 L19.5 14 Q21 14 21 15.5 L19.5 16 Q19 15.2 17.5 16 Q17 16.8 18.5 17.5 L19.5 18 Q21 18.8 21 20 Q21 21.5 19.5 21.5 L16.5 21.5 Q15 21.5 15 20 L16.5 19 Q17 20.5 18 20 Q18.8 19.2 17.5 18.5 L16.5 18 Q15 17.2 15 16 Z" fill="#2563EB"/>
    </g>

    <!-- StegoTags text -->
    <text x="82" y="52" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="800" fill="#2563EB">StegoTags</text>
    <text x="82" y="64" font-family="system-ui,-apple-system,sans-serif" font-size="9" font-weight="500" fill="#94A3B8" letter-spacing="0.5">SECURE QR IDENTITY</text>

    <!-- Subtitle -->
    ${svgMultiline(subLines, 36, 115, 11, 16, 'font-family="system-ui,-apple-system,sans-serif" font-weight="500" fill="#64748B"')}

    <!-- Heading -->
    ${svgMultiline(headingLines, 36, 165, 22, 28, 'font-family="system-ui,-apple-system,sans-serif" font-weight="800" fill="#0F172A"')}

    <!-- Scan instruction -->
    <text x="36" y="${H - 50}" font-family="system-ui,-apple-system,sans-serif" font-size="9" font-weight="700" fill="#94A3B8" letter-spacing="1">SCAN USING PHONE CAMERA, GOOGLE</text>
    <text x="36" y="${H - 38}" font-family="system-ui,-apple-system,sans-serif" font-size="9" font-weight="700" fill="#94A3B8" letter-spacing="1">LENS OR ANY QR SCANNER APP.</text>

    <!-- Privacy line with shield -->
    <g transform="translate(36,${H - 22})">
      <path d="M6 1 L11 3 L11 7 Q11 10.5 6 12 Q1 10.5 1 7 L1 3 Z" fill="none" stroke="#3B82F6" stroke-width="1.2"/>
      <text x="16" y="9" font-family="system-ui,-apple-system,sans-serif" font-size="9" font-weight="600" fill="#3B82F6" letter-spacing="0.3">Privacy protected by StegoTags</text>
    </g>

    <!-- QR code card (shadow + white card + QR) -->
    <rect x="${RIGHT_X + (RIGHT_W - 172) / 2 + 3}" y="31" width="172" height="172" rx="16" fill="rgba(0,0,0,0.08)"/>
    <rect x="${RIGHT_X + (RIGHT_W - 172) / 2}" y="28" width="172" height="172" rx="16" fill="#FFFFFF"/>
    <image href="${qrDataUrl}" x="${RIGHT_X + (RIGHT_W - 148) / 2}" y="40" width="148" height="148"/>

    <!-- Display code -->
    <text x="${RIGHT_X + RIGHT_W / 2}" y="225" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">${esc(code)}</text>

    <!-- PIN -->
    <text x="${RIGHT_X + RIGHT_W / 2}" y="245" font-family="system-ui,-apple-system,sans-serif" font-size="10" font-weight="600" fill="rgba(255,255,255,0.7)" text-anchor="middle" letter-spacing="1">PIN: ${esc(pin)}</text>

    <!-- Emoji icons -->
    ${emojiImgs}

    <!-- Icon label -->
    <text x="${RIGHT_X + RIGHT_W / 2}" y="${H - 14}" font-family="system-ui,-apple-system,sans-serif" font-size="7" font-weight="500" fill="rgba(255,255,255,0.8)" text-anchor="middle">${esc(c.iconLabel.length > 60 ? c.iconLabel.slice(0, 57) + "..." : c.iconLabel)}</text>
  </g>
</svg>`;
}

/* ─── SVG → PNG via canvas (no html-to-image, no CORS) ───────────────────── */

function svgToPng(svgString: string, w: number, h: number, scale = 2): Promise<string> {
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

async function renderStickerPng(
  item: { type?: string | null; display_code?: string | null; qr_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
): Promise<string> {
  const svg = buildStickerSvg(item, qrDataUrl);
  return svgToPng(svg, 680, 360, 2);
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

const ROW_GAP = 4;
const COL_GAP = 4;

function drawCutGuides(doc: jsPDF, sideMargin: number, topMargin: number, rowsOnPage: number): void {
  const totalW = STICKER_MM.width * 2 + COL_GAP;
  for (let r = 1; r < rowsOnPage; r++) {
    const yLine = topMargin + r * STICKER_MM.height + (r - 1) * ROW_GAP + ROW_GAP / 2;
    drawCutLineHorizontal(doc, sideMargin - 4, sideMargin + totalW, yLine);
  }
  const xLine = sideMargin + STICKER_MM.width + COL_GAP / 2;
  const yTop = topMargin;
  const yBot = topMargin + rowsOnPage * STICKER_MM.height + (rowsOnPage - 1) * ROW_GAP;
  drawCutLineVertical(doc, xLine, yTop, yBot);
  doc.setDrawColor(15, 23, 42);
  doc.setFillColor(15, 23, 42);
  doc.setLineWidth(0.25);
  doc.circle(xLine - 0.7, yTop - 0.7, 0.45, "S");
  doc.circle(xLine + 0.7, yTop - 0.7, 0.45, "S");
  doc.line(xLine - 0.7, yTop - 0.25, xLine, yTop + 1.5);
  doc.line(xLine + 0.7, yTop - 0.25, xLine, yTop + 1.5);
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export async function generateSingleStickerPdf(item: QRInventoryItem): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = (pageW - STICKER_MM.width) / 2;
  const y = (pageH - STICKER_MM.height) / 2;

  const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
  const qrDataUrl = await toQrDataUrl(qrText);
  const png = await renderStickerPng(item, qrDataUrl);
  doc.addImage(png, "PNG", x, y, STICKER_MM.width, STICKER_MM.height);
  return doc;
}

export async function generateBatchStickerPdf(
  items: QRInventoryItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalW = STICKER_MM.width * 2 + COL_GAP;
  const totalH = STICKER_MM.height * 4 + ROW_GAP * 3;
  const sideMargin = (pageW - totalW) / 2;
  const topMargin = (pageH - totalH) / 2;

  const stickerPngs = await mapConcurrent(items, 2, async (item, i) => {
    const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
    const qrDataUrl = await toQrDataUrl(qrText);
    const png = await renderStickerPng(item, qrDataUrl);
    if (onProgress) onProgress(i + 1, items.length);
    return png;
  });

  let slot = 0;
  let stickersOnPage = 0;
  for (let i = 0; i < items.length; i++) {
    if (slot === 8 && i > 0) {
      drawCutGuides(doc, sideMargin, topMargin, Math.ceil(stickersOnPage / 2));
      doc.addPage();
      slot = 0;
      stickersOnPage = 0;
    }
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const sx = sideMargin + col * (STICKER_MM.width + COL_GAP);
    const sy = topMargin + row * (STICKER_MM.height + ROW_GAP);
    doc.addImage(stickerPngs[i], "PNG", sx, sy, STICKER_MM.width, STICKER_MM.height);
    slot++;
    stickersOnPage++;
  }
  if (stickersOnPage > 0) {
    drawCutGuides(doc, sideMargin, topMargin, Math.ceil(stickersOnPage / 2));
  }
  return doc;
}

export async function downloadSingleStickerPdf(item: QRInventoryItem): Promise<void> {
  const doc = await generateSingleStickerPdf(item);
  const fname = item.display_code ?? item.qr_code ?? `stegotags-${item.id.slice(0, 8)}`;
  doc.save(`${fname}-sticker.pdf`);
}

export async function downloadBatchStickerPdf(
  items: QRInventoryItem[],
  batchNumber?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const doc = await generateBatchStickerPdf(items, onProgress);
  doc.save(`${batchNumber ?? "stickers"}-stickers.pdf`);
}
