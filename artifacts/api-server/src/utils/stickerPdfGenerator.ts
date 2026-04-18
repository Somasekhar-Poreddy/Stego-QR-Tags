import jsPDF from "jspdf";
import QRCodeLib from "qrcode";

interface InventoryItem {
  id: string;
  type?: string | null;
  qr_code?: string | null;
  qr_url?: string | null;
  display_code?: string | null;
  pin_code?: string | null;
}

const STICKER_MM = { width: 100, height: 70 } as const;

type RGB = [number, number, number];

const TYPE_ACCENT: Record<string, RGB> = {
  vehicle:    [91, 33, 182],
  pet:        [190, 24, 93],
  child:      [15, 118, 110],
  medical:    [159, 18, 57],
  luggage:    [107, 33, 168],
  wallet:     [194, 65, 12],
  home:       [14, 116, 144],
  event:      [107, 33, 168],
  business:   [30, 41, 59],
  belongings: [161, 98, 7],
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
  return (type && TYPE_ACCENT[type]) ? TYPE_ACCENT[type] : TYPE_ACCENT.belongings;
}
function taglineFor(type: string | null | undefined): string {
  return (type && TYPE_TAGLINE[type]) ? TYPE_TAGLINE[type] : TYPE_TAGLINE.belongings;
}
function headingFor(type: string | null | undefined): string {
  return (type && TYPE_HEADING[type]) ? TYPE_HEADING[type] : TYPE_HEADING.belongings;
}

function appBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.VITE_APP_URL ?? "https://stegofy.com").replace(/\/$/, "");
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

function drawSticker(
  doc: jsPDF,
  item: InventoryItem,
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
  doc.roundedRect(x + 5, y + 4, 7, 7, 1.2, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("S", x + 8.5, y + 9, { align: "center" });

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Stegofy", x + 14, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text("SECURE QR IDENTITY", x + 14, y + 11);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const headingLines = headingFor(item.type).split("\n");
  doc.text(headingLines, x + 5, y + 22, { baseline: "top" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const taglineWrapped = doc.splitTextToSize(taglineFor(item.type), leftW - 10);
  doc.text(taglineWrapped, x + 5, y + 38, { baseline: "top" });

  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  const scanNote = "Scan using phone camera, Google Lens or any QR scanner app.";
  const scanWrapped = doc.splitTextToSize(scanNote, leftW - 10);
  doc.text(scanWrapped, x + 5, y + H - 11, { baseline: "top" });

  doc.setTextColor(59, 130, 246);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("Privacy protected by Stegofy", x + 5, y + H - 4);

  const rightX = x + leftW;
  const rightW = W - leftW;
  const accent = accentFor(item.type);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(rightX, y, rightW - 2, H, "F");
  doc.roundedRect(rightX, y, rightW, H, 2, 2, "F");
  doc.setFillColor(248, 250, 252);
  doc.rect(x + leftW - 2, y + 1, 2, H - 2, "F");

  const qrPadding = 1.5;
  const qrSize = 24;
  const cardSize = qrSize + qrPadding * 2;
  const cardX = rightX + (rightW - cardSize) / 2;
  const cardY = y + 5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardSize, cardSize, 1.5, 1.5, "F");
  doc.addImage(qrDataUrl, "PNG", cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(item.display_code ?? item.qr_code ?? "STG-------", rightX + rightW / 2, y + 38, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`PIN: ${item.pin_code ?? "----"}`, rightX + rightW / 2, y + 43, { align: "center" });

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

export async function generateBatchPdfBase64(
  items: InventoryItem[],
): Promise<string> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sideMargin = (pageW - STICKER_MM.width * 2) / 2;
  const topMargin = (pageH - STICKER_MM.height * 4) / 2;

  const base = appBaseUrl();
  const qrDataUrls = await mapConcurrent(items, 8, async (item) => {
    const text = item.qr_url || `${base}/qr/${item.id}`;
    return toQrDataUrl(text);
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

  const raw = doc.output("datauristring");
  const comma = raw.indexOf(",");
  return comma >= 0 ? raw.slice(comma + 1) : raw;
}
