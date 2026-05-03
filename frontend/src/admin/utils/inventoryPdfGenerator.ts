import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import type { QRInventoryItem } from "@/services/adminService";

export const STICKER_MM = { width: 100, height: 70 } as const;

type RGB = [number, number, number];

const TYPE_GRADIENT: Record<string, { from: RGB; to: RGB }> = {
  vehicle:    { from: [37, 99, 235],   to: [109, 40, 217] },
  pet:        { from: [244, 63, 94],   to: [190, 24, 93]  },
  child:      { from: [34, 197, 94],   to: [15, 118, 110] },
  medical:    { from: [239, 68, 68],   to: [159, 18, 57]  },
  luggage:    { from: [99, 102, 241],  to: [107, 33, 168] },
  wallet:     { from: [245, 158, 11],  to: [194, 65, 12]  },
  home:       { from: [20, 184, 166],  to: [14, 116, 144] },
  event:      { from: [217, 70, 239],  to: [107, 33, 168] },
  business:   { from: [71, 85, 105],   to: [30, 41, 59]   },
  belongings: { from: [245, 158, 11],  to: [161, 98, 7]   },
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

function gradientFor(type: string | null | undefined): { from: RGB; to: RGB } {
  return (type && TYPE_GRADIENT[type]) ? TYPE_GRADIENT[type] : TYPE_GRADIENT.belongings;
}
function accentFor(type: string | null | undefined): RGB {
  return gradientFor(type).to;
}
function taglineFor(type: string | null | undefined): string {
  return (type && TYPE_TAGLINE[type]) ? TYPE_TAGLINE[type] : TYPE_TAGLINE.belongings;
}
function headingFor(type: string | null | undefined): string {
  return (type && TYPE_HEADING[type]) ? TYPE_HEADING[type] : TYPE_HEADING.belongings;
}

async function toQrDataUrl(text: string): Promise<string> {
  return QRCodeLib.toDataURL(text, {
    width: 512,
    margin: 1,
    color: { dark: "#0F172A", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });
}

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

function drawGradientRect(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  from: RGB, to: RGB, steps = 40,
): void {
  const stripH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    );
    doc.rect(x, y + i * stripH, w, stripH + 0.15, "F");
  }
}

function drawIconCircle(doc: jsPDF, cx: number, cy: number, r: number): void {
  const gs = doc.GState({ opacity: 0.2 });
  doc.saveGraphicsState();
  doc.setGState(gs);
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r, "F");
  doc.restoreGraphicsState();
}

function setupIconFill(doc: jsPDF): void {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
}

function icoCar(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.65, cy - s * 0.1, s * 1.3, s * 0.5, s * 0.08, s * 0.08, "F");
  doc.roundedRect(cx - s * 0.38, cy - s * 0.48, s * 0.76, s * 0.42, s * 0.12, s * 0.12, "F");
  doc.circle(cx - s * 0.35, cy + s * 0.4, s * 0.14, "F");
  doc.circle(cx + s * 0.35, cy + s * 0.4, s * 0.14, "F");
}

function icoWarning(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.4);
  doc.line(cx, cy - s * 0.7, cx + s * 0.7, cy + s * 0.5);
  doc.line(cx + s * 0.7, cy + s * 0.5, cx - s * 0.7, cy + s * 0.5);
  doc.line(cx - s * 0.7, cy + s * 0.5, cx, cy - s * 0.7);
  doc.line(cx, cy - s * 0.25, cx, cy + s * 0.1);
  doc.circle(cx, cy + s * 0.28, s * 0.08, "F");
}

function icoPhone(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.32, cy - s * 0.55, s * 0.64, s * 1.1, s * 0.14, s * 0.14, "S");
  doc.line(cx - s * 0.15, cy - s * 0.35, cx + s * 0.15, cy - s * 0.35);
  doc.circle(cx, cy + s * 0.35, s * 0.07, "F");
}

function icoAlert(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.circle(cx, cy, s * 0.6, "S");
  doc.line(cx, cy - s * 0.3, cx, cy + s * 0.05);
  doc.circle(cx, cy + s * 0.22, s * 0.07, "F");
}

function icoPaw(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.circle(cx, cy + s * 0.12, s * 0.35, "F");
  doc.circle(cx - s * 0.38, cy - s * 0.25, s * 0.17, "F");
  doc.circle(cx, cy - s * 0.5, s * 0.17, "F");
  doc.circle(cx + s * 0.38, cy - s * 0.25, s * 0.17, "F");
}

function icoHouse(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.rect(cx - s * 0.4, cy - s * 0.05, s * 0.8, s * 0.6, "F");
  doc.setLineWidth(0.5);
  doc.line(cx - s * 0.55, cy - s * 0.05, cx, cy - s * 0.6);
  doc.line(cx, cy - s * 0.6, cx + s * 0.55, cy - s * 0.05);
}

function icoHeart(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  const r = s * 0.28;
  doc.circle(cx - r, cy - r * 0.3, r, "F");
  doc.circle(cx + r, cy - r * 0.3, r, "F");
  doc.setLineWidth(0.5);
  doc.line(cx - s * 0.55, cy + r * 0.1, cx, cy + s * 0.6);
  doc.line(cx + s * 0.55, cy + r * 0.1, cx, cy + s * 0.6);
}

function icoPerson(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.circle(cx, cy - s * 0.4, s * 0.22, "F");
  doc.roundedRect(cx - s * 0.38, cy, s * 0.76, s * 0.5, s * 0.15, s * 0.15, "F");
}

function icoCross(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.rect(cx - s * 0.12, cy - s * 0.55, s * 0.24, s * 1.1, "F");
  doc.rect(cx - s * 0.55, cy - s * 0.12, s * 1.1, s * 0.24, "F");
}

function icoSuitcase(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.55, cy - s * 0.2, s * 1.1, s * 0.75, s * 0.1, s * 0.1, "F");
  doc.roundedRect(cx - s * 0.22, cy - s * 0.5, s * 0.44, s * 0.32, s * 0.08, s * 0.08, "S");
}

function icoPin(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.circle(cx, cy - s * 0.15, s * 0.35, "F");
  doc.setLineWidth(0.5);
  doc.line(cx - s * 0.35, cy - s * 0.15, cx, cy + s * 0.6);
  doc.line(cx + s * 0.35, cy - s * 0.15, cx, cy + s * 0.6);
}

function icoReturn(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.45);
  doc.line(cx - s * 0.35, cy - s * 0.45, cx - s * 0.35, cy + s * 0.25);
  doc.line(cx - s * 0.35, cy + s * 0.25, cx + s * 0.45, cy + s * 0.25);
  doc.line(cx + s * 0.45, cy + s * 0.25, cx + s * 0.2, cy);
  doc.line(cx + s * 0.45, cy + s * 0.25, cx + s * 0.2, cy + s * 0.5);
}

function icoTag(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.4, cy - s * 0.55, s * 0.8, s * 1.1, s * 0.15, s * 0.15, "F");
  doc.circle(cx, cy - s * 0.3, s * 0.12, "S");
}

function icoDoor(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.35, cy - s * 0.55, s * 0.7, s * 1.1, s * 0.06, s * 0.06, "F");
  doc.circle(cx + s * 0.15, cy + s * 0.1, s * 0.08, "S");
}

function icoBell(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.45);
  doc.line(cx - s * 0.5, cy + s * 0.25, cx + s * 0.5, cy + s * 0.25);
  doc.ellipse(cx, cy - s * 0.05, s * 0.5, s * 0.38, "F");
  doc.circle(cx, cy + s * 0.42, s * 0.1, "F");
}

function icoGlobe(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, s * 0.5, "S");
  doc.line(cx - s * 0.5, cy, cx + s * 0.5, cy);
  doc.ellipse(cx, cy, s * 0.22, s * 0.5, "S");
}

function icoBriefcase(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.55, cy - s * 0.15, s * 1.1, s * 0.7, s * 0.08, s * 0.08, "F");
  doc.roundedRect(cx - s * 0.22, cy - s * 0.42, s * 0.44, s * 0.3, s * 0.06, s * 0.06, "S");
}

function icoCalendar(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.48, cy - s * 0.4, s * 0.96, s * 0.9, s * 0.08, s * 0.08, "F");
  doc.setLineWidth(0.35);
  doc.line(cx - s * 0.2, cy - s * 0.4, cx - s * 0.2, cy - s * 0.58);
  doc.line(cx + s * 0.2, cy - s * 0.4, cx + s * 0.2, cy - s * 0.58);
}

function icoWallet(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.roundedRect(cx - s * 0.55, cy - s * 0.25, s * 1.1, s * 0.7, s * 0.12, s * 0.12, "F");
  doc.circle(cx + s * 0.3, cy + s * 0.15, s * 0.1, "S");
}

function icoLink(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.4);
  doc.ellipse(cx - s * 0.18, cy, s * 0.38, s * 0.2, "S");
  doc.ellipse(cx + s * 0.18, cy, s * 0.38, s * 0.2, "S");
}

function icoQR(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  const sq = s * 0.3;
  doc.rect(cx - s * 0.5, cy - s * 0.5, sq, sq, "F");
  doc.rect(cx + s * 0.5 - sq, cy - s * 0.5, sq, sq, "F");
  doc.rect(cx - s * 0.5, cy + s * 0.5 - sq, sq, sq, "F");
  doc.rect(cx + s * 0.05, cy + s * 0.05, s * 0.38, s * 0.38, "F");
}

function icoStar(doc: jsPDF, cx: number, cy: number, s: number): void {
  drawIconCircle(doc, cx, cy, s * 1.3);
  setupIconFill(doc);
  doc.setLineWidth(0.45);
  doc.line(cx, cy - s * 0.55, cx + s * 0.35, cy);
  doc.line(cx + s * 0.35, cy, cx, cy + s * 0.55);
  doc.line(cx, cy + s * 0.55, cx - s * 0.35, cy);
  doc.line(cx - s * 0.35, cy, cx, cy - s * 0.55);
  doc.line(cx - s * 0.55, cy, cx, cy - s * 0.28);
  doc.line(cx, cy - s * 0.28, cx + s * 0.55, cy);
  doc.line(cx + s * 0.55, cy, cx, cy + s * 0.28);
  doc.line(cx, cy + s * 0.28, cx - s * 0.55, cy);
}

type IconFn = (doc: jsPDF, cx: number, cy: number, s: number) => void;

const TYPE_ICONS: Record<string, [IconFn, IconFn, IconFn, IconFn]> = {
  vehicle:    [icoCar,       icoWarning,  icoPhone, icoAlert],
  pet:        [icoPaw,       icoHouse,    icoPhone, icoHeart],
  child:      [icoPerson,    icoHouse,    icoPhone, icoHeart],
  medical:    [icoCross,     icoHeart,    icoPhone, icoAlert],
  luggage:    [icoSuitcase,  icoPin,      icoPhone, icoReturn],
  wallet:     [icoWallet,    icoPin,      icoPhone, icoReturn],
  home:       [icoHouse,     icoDoor,     icoPhone, icoBell],
  event:      [icoCalendar,  icoStar,     icoPhone, icoQR],
  business:   [icoBriefcase, icoGlobe,    icoPhone, icoLink],
  belongings: [icoTag,       icoPin,      icoPhone, icoReturn],
};

function drawTypeIcons(
  doc: jsPDF, rightX: number, y: number, rightW: number, H: number,
  type: string | null | undefined,
): void {
  const icons = TYPE_ICONS[type ?? ""] ?? TYPE_ICONS.belongings;
  const s = 3.2;
  const iconCy = y + H - 18;
  const totalW = rightW - 4;
  const step = totalW / 4;
  for (let i = 0; i < 4; i++) {
    const cx = rightX + 2 + step * i + step / 2;
    icons[i](doc, cx, iconCy, s);
  }
}

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

function drawSticker(
  doc: jsPDF,
  item: { id: string; type?: string | null; qr_code?: string | null; qr_url?: string | null; display_code?: string | null; pin_code?: string | null },
  qrDataUrl: string,
  x: number,
  y: number,
): void {
  const W = STICKER_MM.width;
  const H = STICKER_MM.height;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, W, H, 2, 2, "S");

  const leftW = 60;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, leftW, H, 2, 2, "F");
  doc.rect(x + leftW - 2, y, 2, H, "F");

  doc.setFillColor(79, 70, 229);
  doc.roundedRect(x + 5, y + 4, 8, 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("S", x + 9, y + 9.5, { align: "center" });

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("StegoTags", x + 15, y + 8.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text("SECURE QR IDENTITY", x + 15, y + 11.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const headingLines = headingFor(item.type).split("\n");
  doc.text(headingLines, x + 5, y + 20, { baseline: "top", lineHeightFactor: 1.3 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const taglineWrapped = doc.splitTextToSize(taglineFor(item.type), leftW - 10);
  doc.text(taglineWrapped, x + 5, y + 38, { baseline: "top" });

  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text("SCAN USING PHONE CAMERA, GOOGLE", x + 5, y + H - 12, { baseline: "top" });
  doc.text("LENS OR ANY QR SCANNER APP.", x + 5, y + H - 9, { baseline: "top" });

  doc.setTextColor(59, 130, 246);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("Privacy protected by StegoTags", x + 5, y + H - 4);

  const rightX = x + leftW;
  const rightW = W - leftW;
  const grad = gradientFor(item.type);
  drawGradientRect(doc, rightX, y, rightW, H, grad.from, grad.to);

  doc.setFillColor(248, 250, 252);
  doc.rect(x + leftW - 2, y + 1, 2, H - 2, "F");

  const qrPadding = 1.5;
  const qrSize = 25;
  const cardSize = qrSize + qrPadding * 2;
  const cardX = rightX + (rightW - cardSize) / 2;
  const cardY = y + 4;

  const shadowGs = doc.GState({ opacity: 0.15 });
  doc.saveGraphicsState();
  doc.setGState(shadowGs);
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(cardX + 0.4, cardY + 0.6, cardSize, cardSize, 1.8, 1.8, "F");
  doc.restoreGraphicsState();

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardSize, cardSize, 1.8, 1.8, "F");
  doc.addImage(qrDataUrl, "PNG", cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    item.display_code ?? item.qr_code ?? "STG-------",
    rightX + rightW / 2, y + 37,
    { align: "center", charSpace: 0.4 },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`PIN: ${item.pin_code ?? "----"}`, rightX + rightW / 2, y + 42, { align: "center" });

  drawTypeIcons(doc, rightX, y, rightW, H, item.type);

  const badge = (item.type ?? "tag").toUpperCase();
  const accent = accentFor(item.type);
  const badgeW = 24;
  const badgeH = 5.5;
  const badgeX = rightX + (rightW - badgeW) / 2;
  const badgeY = y + H - 9;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, "F");
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(badge, badgeX + badgeW / 2, badgeY + 3.8, { align: "center" });
}

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
  const totalW = STICKER_MM.width * 2 + COL_GAP;
  const totalH = STICKER_MM.height * 4 + ROW_GAP * 3;
  const sideMargin = (pageW - totalW) / 2;
  const topMargin = (pageH - totalH) / 2;

  let done = 0;
  const qrDataUrls = await mapConcurrent(items, 10, async (item) => {
    const text = item.qr_url || `${window.location.origin}/qr/${item.id}`;
    const url = await toQrDataUrl(text);
    done++;
    if (onProgress) onProgress(done, items.length);
    return url;
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
    drawSticker(doc, items[i], qrDataUrls[i], sx, sy);
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
