// =============================================================================
// Inventory sticker PDF generator
// =============================================================================
// Renders Stegofy QR stickers for printing. Two entry points:
//   generateSingleStickerPdf(item)  — one sticker centered on an A4 page
//   generateBatchStickerPdf(items)  — 8 stickers per A4, paginated
//
// Sticker dimensions: 100 mm × 70 mm (matches QRCardDesign.tsx at print scale).
// jsPDF can't render CSS gradients, so each type uses a solid tint sampled
// from the Tailwind gradient used on-screen.
// =============================================================================

import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import type { QRInventoryItem } from "@/services/adminService";

export const STICKER_MM = { width: 100, height: 70 } as const;

// Per-type accent colours. Tailwind 700-end of each QRCardDesign gradient.
// Values are RGB — jsPDF.setFillColor accepts (r, g, b).
type RGB = [number, number, number];
const TYPE_ACCENT: Record<string, RGB> = {
  vehicle:    [91, 33, 182],   // violet-700
  pet:        [190, 24, 93],   // pink-700
  child:      [15, 118, 110],  // teal-700
  medical:    [159, 18, 57],   // rose-700
  luggage:    [107, 33, 168],  // purple-700
  wallet:     [194, 65, 12],   // orange-700
  home:       [14, 116, 144],  // cyan-700
  event:      [107, 33, 168],  // purple-700 (fuchsia-500 → purple-700 gradient)
  business:   [30, 41, 59],    // slate-800
  belongings: [161, 98, 7],    // yellow-700
};

const TYPE_TAGLINE: Record<string, string> = {
  vehicle:    "Wrong parking · Emergency · Vehicle issues",
  pet:        "Lost pet? Scan to reach the owner.",
  child:      "Lost child? Scan to contact a parent.",
  medical:    "Emergency medical info for responders.",
  luggage:    "Found this bag? Scan to return it.",
  wallet:     "Found this item? Scan to return it.",
  home:       "Delivery · Visitor · Emergency contact.",
  event:      "Scan for event details and contact info.",
  business:   "Scan to connect with us.",
  belongings: "Found this item? Scan to return it.",
};

const TYPE_HEADING: Record<string, string> = {
  vehicle:    "Scan to contact\nthe vehicle owner.",
  pet:        "Scan to help this\npet get home.",
  child:      "Scan to contact\nthe parent.",
  medical:    "Scan for emergency\nmedical info.",
  luggage:    "Scan to return\nthis luggage.",
  wallet:     "Scan to return\nthis lost item.",
  home:       "Scan to contact\nthe resident.",
  event:      "Scan to view\nevent details.",
  business:   "Scan to connect\nwith us.",
  belongings: "Scan to return\nthis item.",
};

function accentFor(type: string | null | undefined): RGB {
  if (type && TYPE_ACCENT[type]) return TYPE_ACCENT[type];
  return TYPE_ACCENT.belongings;
}
function taglineFor(type: string | null | undefined): string {
  if (type && TYPE_TAGLINE[type]) return TYPE_TAGLINE[type];
  return TYPE_TAGLINE.belongings;
}
function headingFor(type: string | null | undefined): string {
  if (type && TYPE_HEADING[type]) return TYPE_HEADING[type];
  return TYPE_HEADING.belongings;
}

// ─── QR data-URL generation with bounded concurrency ─────────────────────────
async function toQrDataUrl(text: string): Promise<string> {
  return QRCodeLib.toDataURL(text, {
    width: 512,
    margin: 1,
    color: { dark: "#0F172A", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });
}

async function mapConcurrent<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let cursor = 0;
  async function worker() {
    while (cursor < arr.length) {
      const i = cursor++;
      results[i] = await fn(arr[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, arr.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Type-specific icon drawing ───────────────────────────────────────────────
// Each icon function draws a simple line-art glyph at (cx, cy) with half-size s.
// All use white stroke on the type-coloured right panel.

function setupIcon(doc: jsPDF): void {
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.35);
}

// Phone: rounded rectangle body
function icoPhone(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.roundedRect(cx - s * 0.38, cy - s * 0.62, s * 0.76, s * 1.24, s * 0.18, s * 0.18, "S");
  doc.line(cx - s * 0.18, cy - s * 0.42, cx + s * 0.18, cy - s * 0.42);
}

// Heart: two circles top + V bottom
function icoHeart(doc: jsPDF, cx: number, cy: number, s: number): void {
  const r = s * 0.3;
  doc.circle(cx - r, cy - r * 0.2, r, "S");
  doc.circle(cx + r, cy - r * 0.2, r, "S");
  doc.line(cx - s * 0.6, cy + r * 0.2, cx, cy + s * 0.7);
  doc.line(cx + s * 0.6, cy + r * 0.2, cx, cy + s * 0.7);
}

// Warning triangle with exclamation mark
function icoWarning(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.line(cx, cy - s, cx + s * 0.87, cy + s * 0.5);
  doc.line(cx + s * 0.87, cy + s * 0.5, cx - s * 0.87, cy + s * 0.5);
  doc.line(cx - s * 0.87, cy + s * 0.5, cx, cy - s);
  doc.line(cx, cy - s * 0.35, cx, cy + s * 0.15);
  doc.circle(cx, cy + s * 0.32, s * 0.09, "F");
}

// Car: body rect + windshield roof + 2 wheel circles
function icoCar(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.rect(cx - s * 0.6, cy - s * 0.12, s * 1.2, s * 0.55, "S");
  doc.line(cx - s * 0.3, cy - s * 0.12, cx - s * 0.5, cy - s * 0.52);
  doc.line(cx - s * 0.5, cy - s * 0.52, cx + s * 0.5, cy - s * 0.52);
  doc.line(cx + s * 0.5, cy - s * 0.52, cx + s * 0.3, cy - s * 0.12);
  doc.circle(cx - s * 0.38, cy + s * 0.43, s * 0.18, "S");
  doc.circle(cx + s * 0.38, cy + s * 0.43, s * 0.18, "S");
}

// Paw: large pad + 3 toe circles
function icoPaw(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.circle(cx, cy + s * 0.15, s * 0.4, "S");
  doc.circle(cx - s * 0.42, cy - s * 0.3, s * 0.2, "S");
  doc.circle(cx, cy - s * 0.6, s * 0.2, "S");
  doc.circle(cx + s * 0.42, cy - s * 0.3, s * 0.2, "S");
}

// House: rectangle body + triangle roof
function icoHouse(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.rect(cx - s * 0.45, cy - s * 0.1, s * 0.9, s * 0.7, "S");
  doc.line(cx - s * 0.6, cy - s * 0.1, cx, cy - s * 0.7);
  doc.line(cx, cy - s * 0.7, cx + s * 0.6, cy - s * 0.1);
}

// Person: circle head + triangle body
function icoPerson(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.circle(cx, cy - s * 0.52, s * 0.26, "S");
  doc.line(cx - s * 0.5, cy + s * 0.62, cx, cy - s * 0.2);
  doc.line(cx + s * 0.5, cy + s * 0.62, cx, cy - s * 0.2);
  doc.line(cx - s * 0.5, cy + s * 0.62, cx + s * 0.5, cy + s * 0.62);
}

// Medical cross (+)
function icoCross(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.line(cx, cy - s * 0.7, cx, cy + s * 0.7);
  doc.line(cx - s * 0.7, cy, cx + s * 0.7, cy);
}

// Alert: circle with !
function icoAlert(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.circle(cx, cy, s * 0.65, "S");
  doc.line(cx, cy - s * 0.35, cx, cy + s * 0.08);
  doc.circle(cx, cy + s * 0.28, s * 0.1, "F");
}

// Location pin: circle on a pointed drop
function icoPin(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.circle(cx, cy - s * 0.2, s * 0.42, "S");
  doc.line(cx - s * 0.42, cy - s * 0.2, cx, cy + s * 0.7);
  doc.line(cx + s * 0.42, cy - s * 0.2, cx, cy + s * 0.7);
}

// Tag: rounded rectangle + small hole
function icoTag(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.roundedRect(cx - s * 0.5, cy - s * 0.65, s, s * 1.3, s * 0.2, s * 0.2, "S");
  doc.circle(cx, cy - s * 0.38, s * 0.14, "S");
}

// Return arrow: vertical line + horizontal + arrowhead
function icoReturn(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.line(cx - s * 0.4, cy - s * 0.6, cx - s * 0.4, cy + s * 0.3);
  doc.line(cx - s * 0.4, cy + s * 0.3, cx + s * 0.5, cy + s * 0.3);
  doc.line(cx + s * 0.5, cy + s * 0.3, cx + s * 0.25, cy + s * 0.05);
  doc.line(cx + s * 0.5, cy + s * 0.3, cx + s * 0.25, cy + s * 0.55);
}

// Suitcase: rectangle + handle arch + centre seam
function icoSuitcase(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.rect(cx - s * 0.6, cy - s * 0.25, s * 1.2, s * 0.9, "S");
  doc.roundedRect(cx - s * 0.28, cy - s * 0.55, s * 0.56, s * 0.32, s * 0.1, s * 0.1, "S");
  doc.line(cx - s * 0.6, cy + s * 0.15, cx + s * 0.6, cy + s * 0.15);
}

// Bell: dome + clapper dot
function icoBell(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.line(cx - s * 0.6, cy + s * 0.3, cx + s * 0.6, cy + s * 0.3);
  doc.line(cx - s * 0.6, cy + s * 0.3, cx - s * 0.6, cy);
  doc.line(cx + s * 0.6, cy + s * 0.3, cx + s * 0.6, cy);
  doc.ellipse(cx, cy - s * 0.05, s * 0.6, s * 0.45, "S");
  doc.circle(cx, cy + s * 0.52, s * 0.13, "S");
}

// Globe: circle + equator + meridian
function icoGlobe(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.circle(cx, cy, s * 0.6, "S");
  doc.line(cx - s * 0.6, cy, cx + s * 0.6, cy);
  doc.line(cx, cy - s * 0.6, cx, cy + s * 0.6);
  doc.ellipse(cx, cy, s * 0.28, s * 0.6, "S");
}

// Briefcase: rectangle + arch handle + divider
function icoBriefcase(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.rect(cx - s * 0.6, cy - s * 0.2, s * 1.2, s * 0.85, "S");
  doc.roundedRect(cx - s * 0.28, cy - s * 0.5, s * 0.56, s * 0.32, s * 0.1, s * 0.1, "S");
  doc.line(cx - s * 0.6, cy + s * 0.15, cx + s * 0.6, cy + s * 0.15);
}

// Calendar: rectangle + header line + two pegs
function icoCalendar(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.rect(cx - s * 0.6, cy - s * 0.5, s * 1.2, s, "S");
  doc.line(cx - s * 0.6, cy - s * 0.18, cx + s * 0.6, cy - s * 0.18);
  doc.line(cx - s * 0.25, cy - s * 0.5, cx - s * 0.25, cy - s * 0.7);
  doc.line(cx + s * 0.25, cy - s * 0.5, cx + s * 0.25, cy - s * 0.7);
}

// Star: 4-point diamond (simpler than 5-point, clear at 5mm)
function icoStar(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.line(cx, cy - s * 0.7, cx + s * 0.4, cy);
  doc.line(cx + s * 0.4, cy, cx, cy + s * 0.7);
  doc.line(cx, cy + s * 0.7, cx - s * 0.4, cy);
  doc.line(cx - s * 0.4, cy, cx, cy - s * 0.7);
  doc.line(cx - s * 0.7, cy, cx, cy - s * 0.35);
  doc.line(cx, cy - s * 0.35, cx + s * 0.7, cy);
  doc.line(cx + s * 0.7, cy, cx, cy + s * 0.35);
  doc.line(cx, cy + s * 0.35, cx - s * 0.7, cy);
}

// Chain link
function icoLink(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.ellipse(cx - s * 0.22, cy, s * 0.44, s * 0.25, "S");
  doc.ellipse(cx + s * 0.22, cy, s * 0.44, s * 0.25, "S");
}

// Wallet: rectangle body + fold flap on top
function icoWallet(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.roundedRect(cx - s * 0.65, cy - s * 0.3, s * 1.3, s * 0.8, s * 0.15, s * 0.15, "S");
  doc.line(cx - s * 0.65, cy - s * 0.05, cx + s * 0.65, cy - s * 0.05);
  doc.circle(cx + s * 0.35, cy + s * 0.22, s * 0.14, "S");
}

// Door: outer frame + inner door panel + knob
function icoDoor(doc: jsPDF, cx: number, cy: number, s: number): void {
  doc.roundedRect(cx - s * 0.42, cy - s * 0.68, s * 0.84, s * 1.36, s * 0.08, s * 0.08, "S");
  doc.roundedRect(cx - s * 0.3, cy - s * 0.56, s * 0.6, s * 1.12, s * 0.06, s * 0.06, "S");
  doc.circle(cx + s * 0.18, cy + s * 0.1, s * 0.1, "F");
}

// Simplified QR mark: 3 corner squares + dot cluster
function icoQR(doc: jsPDF, cx: number, cy: number, s: number): void {
  const sq = s * 0.35;
  doc.rect(cx - s * 0.6, cy - s * 0.6, sq, sq, "S");
  doc.rect(cx + s * 0.6 - sq, cy - s * 0.6, sq, sq, "S");
  doc.rect(cx - s * 0.6, cy + s * 0.6 - sq, sq, sq, "S");
  doc.rect(cx + s * 0.05, cy + s * 0.05, s * 0.45, s * 0.45, "S");
}

type IconFn = (doc: jsPDF, cx: number, cy: number, s: number) => void;

const TYPE_ICONS: Record<string, [IconFn, IconFn, IconFn, IconFn]> = {
  vehicle:    [icoCar,       icoWarning,  icoPhone, icoAlert],
  pet:        [icoPaw,       icoHouse,    icoPhone, icoHeart],
  child:      [icoPerson,    icoHouse,    icoPhone, icoHeart],
  medical:    [icoCross,     icoHeart,    icoPhone, icoAlert],
  luggage:    [icoSuitcase,  icoPin,      icoPhone, icoReturn],
  wallet:     [icoWallet,    icoPin,      icoPhone, icoReturn],
  home:       [icoDoor,      icoBell,     icoPhone, icoAlert],
  event:      [icoCalendar,  icoStar,     icoPhone, icoQR],
  business:   [icoBriefcase, icoGlobe,   icoPhone, icoLink],
  belongings: [icoTag,       icoPin,      icoPhone, icoReturn],
};

function drawTypeIcons(
  doc: jsPDF,
  rightX: number,
  y: number,
  rightW: number,
  H: number,
  type: string | null | undefined,
): void {
  const icons = TYPE_ICONS[type ?? ""] ?? TYPE_ICONS.belongings;
  const s = 3.5; // half-size; each icon fits in a ~7mm × 7mm box
  const iconCy = y + H - 18; // center Y — between PIN text and type badge
  // Distribute 4 icons evenly across rightW
  const totalW = rightW - 4; // 2mm padding each side
  const step = totalW / 4;
  setupIcon(doc);
  for (let i = 0; i < 4; i++) {
    const cx = rightX + 2 + step * i + step / 2;
    icons[i](doc, cx, iconCy, s);
  }
}

// ─── Draw a single sticker at an arbitrary (x, y) offset on the current page ─
function drawSticker(
  doc: jsPDF,
  item: QRInventoryItem,
  qrDataUrl: string,
  x: number,
  y: number,
): void {
  const W = STICKER_MM.width;
  const H = STICKER_MM.height;

  // Outer border (thin neutral grey) so the cut line is visible.
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, W, H, 2, 2, "S");

  // ── LEFT PANEL (60mm, off-white) ─────────────────────────────────────────
  const leftW = 60;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(x, y, leftW, H, 2, 2, "F");
  // Square off the right edge of the left panel so the rounded corners sit
  // only on the outer envelope.
  doc.rect(x + leftW - 2, y, 2, H, "F");

  // Logo mark (simple rounded square with "S" glyph — emojis aren't renderable).
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.roundedRect(x + 5, y + 4, 7, 7, 1.2, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("S", x + 8.5, y + 9, { align: "center" });

  // Wordmark
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Stegofy", x + 14, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("SECURE QR IDENTITY", x + 14, y + 11);

  // Heading (2 lines, 10pt bold).
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const headingLines = headingFor(item.type).split("\n");
  doc.text(headingLines, x + 5, y + 22, { baseline: "top" });

  // Tagline (2 lines max, 7pt).
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const taglineWrapped = doc.splitTextToSize(taglineFor(item.type), leftW - 10);
  doc.text(taglineWrapped, x + 5, y + 38, { baseline: "top" });

  // Fine-print — scan instruction.
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  const scanNote = "Scan using phone camera, Google Lens or any QR scanner app.";
  const scanWrapped = doc.splitTextToSize(scanNote, leftW - 10);
  doc.text(scanWrapped, x + 5, y + H - 11, { baseline: "top" });

  // "Privacy protected by Stegofy" tagline (bottom).
  doc.setTextColor(59, 130, 246); // blue-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("Privacy protected by Stegofy", x + 5, y + H - 4);

  // ── RIGHT PANEL (40mm, type-colored) ─────────────────────────────────────
  const rightX = x + leftW;
  const rightW = W - leftW;
  const accent = accentFor(item.type);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(rightX, y, rightW - 2, H, "F");
  // Right-side rounded corners via overlay — draw a full rounded rect and
  // cover the left edge with the slate panel we've already placed.
  doc.roundedRect(rightX, y, rightW, H, 2, 2, "F");
  // Re-draw the left panel's right edge to eliminate rounded bleed inward.
  doc.setFillColor(248, 250, 252);
  doc.rect(x + leftW - 2, y + 1, 2, H - 2, "F");

  // QR code on white rounded card.
  const qrPadding = 1.5;
  const qrSize = 24;
  const cardSize = qrSize + qrPadding * 2;
  const cardX = rightX + (rightW - cardSize) / 2;
  const cardY = y + 5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardSize, cardSize, 1.5, 1.5, "F");
  doc.addImage(qrDataUrl, "PNG", cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

  // Display code.
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(item.display_code ?? item.qr_code ?? "STG-------", rightX + rightW / 2, y + 38, {
    align: "center",
  });

  // PIN.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`PIN: ${item.pin_code ?? "----"}`, rightX + rightW / 2, y + 43, { align: "center" });

  // Per-type icon row (above type badge).
  drawTypeIcons(doc, rightX, y, rightW, H, item.type);

  // Restore sticker draw colour state after icon drawing.
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);

  // Type badge footer.
  const badge = (item.type ?? "tag").toUpperCase();
  doc.setFillColor(255, 255, 255);
  const badgeW = 22;
  const badgeH = 5;
  const badgeX = rightX + (rightW - badgeW) / 2;
  const badgeY = y + H - 10;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, "F");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(badge, badgeX + badgeW / 2, badgeY + 3.5, { align: "center" });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateSingleStickerPdf(item: QRInventoryItem): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = (pageW - STICKER_MM.width) / 2;
  const y = (pageH - STICKER_MM.height) / 2;

  const qrText = item.qr_url || `${window.location.origin}/qr/${item.id}`;
  const qr = await toQrDataUrl(qrText);
  drawSticker(doc, item, qr, x, y);
  return doc;
}

export async function generateBatchStickerPdf(
  items: QRInventoryItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sideMargin = (pageW - STICKER_MM.width * 2) / 2;
  const topMargin = (pageH - STICKER_MM.height * 4) / 2;

  // Pre-generate all QR data URLs with bounded concurrency.
  let done = 0;
  const qrDataUrls = await mapConcurrent(items, 10, async (item) => {
    const text = item.qr_url || `${window.location.origin}/qr/${item.id}`;
    const url = await toQrDataUrl(text);
    done++;
    if (onProgress) onProgress(done, items.length);
    return url;
  });

  let slot = 0;
  for (let i = 0; i < items.length; i++) {
    if (slot === 8 && i > 0) {
      doc.addPage();
      slot = 0;
    }
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const x = sideMargin + col * STICKER_MM.width;
    const y = topMargin + row * STICKER_MM.height;
    drawSticker(doc, items[i], qrDataUrls[i], x, y);
    slot++;
  }
  return doc;
}

export async function downloadSingleStickerPdf(item: QRInventoryItem): Promise<void> {
  const doc = await generateSingleStickerPdf(item);
  const fname = item.display_code ?? item.qr_code ?? `stegofy-${item.id.slice(0, 8)}`;
  doc.save(`${fname}-sticker.pdf`);
}

export async function downloadBatchStickerPdf(
  items: QRInventoryItem[],
  batchNumber?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const doc = await generateBatchStickerPdf(items, onProgress);
  const fname = batchNumber ?? `stegofy-batch-${new Date().toISOString().slice(0, 10)}`;
  doc.save(`${fname}-stickers.pdf`);
}
