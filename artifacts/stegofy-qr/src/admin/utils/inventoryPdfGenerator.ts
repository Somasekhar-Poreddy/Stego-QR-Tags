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
