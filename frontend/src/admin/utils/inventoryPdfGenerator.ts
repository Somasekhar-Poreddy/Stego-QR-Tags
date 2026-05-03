import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import { toPng } from "html-to-image";
import type { QRInventoryItem } from "@/services/adminService";

export const STICKER_MM = { width: 100, height: 70 } as const;

const TYPE_CONTENT: Record<string, {
  heading: string;
  sub: string;
  icons: string[];
  iconLabel: string;
  gradFrom: string;
  gradTo: string;
}> = {
  vehicle:    { heading: "Scan to contact\nthe vehicle owner.", sub: "Stegofy QR tag. Contact owner, help\nin emergency, or wrong parking.", icons: ["🚗", "🚨", "📞", "⚠️"], iconLabel: "Wrong Parking, Emergency Contact, any issue with the vehicle, Scan the QR.", gradFrom: "#2563EB", gradTo: "#6D28D9" },
  pet:        { heading: "Scan to help this\npet get home.", sub: "Lost pet? Scan to reach\nthe owner instantly.", icons: ["🐾", "🏠", "📞", "❤️"], iconLabel: "Lost pet? Scan to contact the owner and help them reunite.", gradFrom: "#F43F5E", gradTo: "#BE185D" },
  child:      { heading: "Scan to contact\nthe parent.", sub: "Lost child? Scan to reach\na parent or guardian immediately.", icons: ["👦", "🏠", "📞", "🆘"], iconLabel: "Lost child? Scan to contact the parent or guardian.", gradFrom: "#22C55E", gradTo: "#0F766E" },
  medical:    { heading: "Scan for emergency\nmedical info.", sub: "Critical health information\nfor first responders.", icons: ["🏥", "❤️", "📞", "🆘"], iconLabel: "Emergency medical info, blood group, allergies — scan now.", gradFrom: "#EF4444", gradTo: "#9F1239" },
  luggage:    { heading: "Scan to return\nthis luggage.", sub: "Found this bag? Scan to reach\nthe owner and return it.", icons: ["🧳", "✈️", "📞", "🙏"], iconLabel: "Found this luggage? Scan to contact the owner.", gradFrom: "#6366F1", gradTo: "#6B21A8" },
  wallet:     { heading: "Scan to return\nthis lost item.", sub: "Found this wallet or keys? Scan\nto reach the owner.", icons: ["👛", "🔑", "📞", "🙏"], iconLabel: "Found this item? Scan to return it to the owner.", gradFrom: "#F59E0B", gradTo: "#C2410C" },
  home:       { heading: "Scan to contact\nthe resident.", sub: "Delivery, visitor, or emergency —\nscan to reach the resident.", icons: ["🏠", "📦", "📞", "🔔"], iconLabel: "Delivery, visitor, or emergency — scan to contact resident.", gradFrom: "#14B8A6", gradTo: "#0E7490" },
  event:      { heading: "Scan to view\nevent details.", sub: "Get event info, schedule,\nand contact details instantly.", icons: ["🎫", "📅", "📞", "🎉"], iconLabel: "Scan to get event details, schedule, and contact info.", gradFrom: "#D946EF", gradTo: "#6B21A8" },
  business:   { heading: "Scan to connect\nwith us.", sub: "Get contact details, portfolio,\nand business info instantly.", icons: ["💼", "🌐", "📞", "🤝"], iconLabel: "Scan to get business contact details and portfolio.", gradFrom: "#475569", gradTo: "#1E293B" },
  belongings: { heading: "Scan to return\nthis item.", sub: "Found this item? Scan to reach\nthe owner and return it.", icons: ["🎒", "🔍", "📞", "🙏"], iconLabel: "Found this item? Scan to contact the owner.", gradFrom: "#F59E0B", gradTo: "#A16207" },
};

const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`;

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
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, () => worker()));
  return results;
}

function buildStickerHtml(
  item: { type?: string | null; display_code?: string | null; qr_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
): string {
  const content = TYPE_CONTENT[item.type ?? ""] ?? TYPE_CONTENT.belongings;
  const displayCode = item.display_code ?? item.qr_code ?? "STG---------";
  const pinCode = item.pin_code ?? "----";
  const iconCircles = content.icons.map(
    (ico) => `<div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);">${ico}</div>`,
  ).join("");

  return `<div style="width:680px;height:360px;font-family:'Poppins',system-ui,sans-serif;display:flex;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
  <div style="width:374px;display:flex;flex-direction:column;justify-content:space-between;padding:32px 36px;background:#F8FAFC;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="/icon-512.png" width="36" height="36" style="object-fit:contain;" />
      <div>
        <span style="font-size:18px;font-weight:800;background:linear-gradient(to right,#2563EB,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent;line-height:1;">StegoTags</span>
        <p style="font-size:9px;color:#94A3B8;margin:2px 0 0;font-weight:500;letter-spacing:0.05em;line-height:1;">SECURE QR IDENTITY</p>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:16px;margin-bottom:8px;">
      <p style="font-size:11px;color:#64748B;font-weight:500;margin:0 0 8px;line-height:1.625;white-space:pre-line;">${content.sub}</p>
      <h2 style="font-size:22px;font-weight:800;color:#0F172A;line-height:1.15;white-space:pre-line;margin:0;">${content.heading}</h2>
    </div>
    <div>
      <p style="font-size:9px;font-weight:700;color:#94A3B8;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;line-height:1.5;">SCAN USING PHONE CAMERA, GOOGLE LENS OR ANY QR SCANNER APP.</p>
      <div style="display:flex;align-items:center;gap:6px;">${SHIELD_SVG}<span style="font-size:9px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;">Privacy protected by StegoTags</span></div>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:28px 24px;background:linear-gradient(to bottom right,${content.gradFrom},${content.gradTo});">
    <div style="background:#fff;border-radius:16px;padding:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1);">
      <img src="${qrDataUrl}" width="148" height="148" style="display:block;" />
    </div>
    <div style="text-align:center;">
      <p style="color:#fff;font-weight:800;letter-spacing:0.1em;font-size:14px;line-height:1;margin:0;">${displayCode}</p>
      <p style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:600;margin:4px 0 0;letter-spacing:0.05em;">PIN: ${pinCode}</p>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">
      <div style="display:flex;gap:8px;">${iconCircles}</div>
      <p style="color:rgba(255,255,255,0.8);font-size:8px;font-weight:500;text-align:center;line-height:1.5;padding:0 8px;margin:0;">${content.iconLabel}</p>
    </div>
  </div>
</div>`;
}

async function renderStickerPng(
  item: { type?: string | null; display_code?: string | null; qr_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
): Promise<string> {
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-9999px;top:0;z-index:-1;";
  container.innerHTML = buildStickerHtml(item, qrDataUrl);
  document.body.appendChild(container);

  try {
    const el = container.firstElementChild as HTMLElement;
    const png = await toPng(el, { pixelRatio: 2.5, quality: 0.95 });
    return png;
  } finally {
    document.body.removeChild(container);
  }
}

/* ─── Cut-line helpers ───────────────────────────────────────────────────── */

function drawScissors(doc: jsPDF, x: number, y: number): void {
  doc.setDrawColor(15, 23, 42);
  doc.setFillColor(15, 23, 42);
  doc.setLineWidth(0.25);
  doc.circle(x + 0.5, y - 0.7, 0.45, "S");
  doc.circle(x + 0.5, y + 0.7, 0.45, "S");
  doc.line(x + 0.95, y - 0.7, x + 3.2, y);
  doc.line(x + 0.95, y + 0.7, x + 3.2, y);
}

function drawCutLineHorizontal(
  doc: jsPDF, x1: number, x2: number, y: number, withScissors = true,
): void {
  if (withScissors) drawScissors(doc, x1, y);
  doc.setDrawColor(120, 130, 145);
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(withScissors ? x1 + 4 : x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function drawCutLineVertical(
  doc: jsPDF, x: number, y1: number, y2: number,
): void {
  doc.setDrawColor(120, 130, 145);
  doc.setLineWidth(0.18);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x, y1, x, y2);
  doc.setLineDashPattern([], 0);
}

const ROW_GAP = 4;
const COL_GAP = 4;

function drawCutGuides(
  doc: jsPDF, sideMargin: number, topMargin: number, rowsOnPage: number,
): void {
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

/* ─── Public API (same signatures as before) ─────────────────────────────── */

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

  const stickerPngs = await mapConcurrent(items, 4, async (item, i) => {
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
  const fname = item.display_code ?? item.qr_code ?? `stegofy-${item.id.slice(0, 8)}`;
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
