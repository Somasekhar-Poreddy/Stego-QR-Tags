import crypto from "node:crypto";

/**
 * Normalize a user-entered phone number to E.164-ish digits-only form.
 * Defaults to India (+91) when no country code is supplied and the number
 * is 10 digits long. This is the same shape already accepted by the rest of
 * the app (admin contact form, public scan flow), so behavior stays
 * consistent across surfaces.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  // Strip everything except digits and a leading '+'.
  const cleaned = trimmed.startsWith("+")
    ? "+" + trimmed.slice(1).replace(/\D/g, "")
    : trimmed.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) {
    // Already country-prefixed.
    return cleaned;
  }
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("0")) return `+91${cleaned.slice(1)}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  return `+${cleaned}`;
}

export function hashPhone(phone: string): string {
  const key = (process.env.IP_ENCRYPTION_KEY ?? "").trim();
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  // Reuse the existing IP_ENCRYPTION_KEY secret as the HMAC seed so we don't
  // require an additional secret. The key only needs to be stable; rotation
  // simply means historical phone hashes won't match new ones (acceptable
  // for analytics-only joins).
  if (!key) {
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
  return crypto.createHmac("sha256", key).update(normalized).digest("hex");
}

export function isValidIndianMobile(phone: string): boolean {
  const n = normalizePhone(phone);
  return /^\+91[6-9]\d{9}$/.test(n);
}
