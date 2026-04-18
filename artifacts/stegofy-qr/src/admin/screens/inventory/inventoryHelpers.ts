import type { InventoryStatus, BatchStatus } from "@/services/adminService";

// Shared constants, types, and helpers for the inventory module.

export const QR_TYPES = [
  "vehicle", "pet", "child", "medical", "luggage",
  "wallet", "home", "event", "business", "belongings",
] as const;
export type QRType = (typeof QR_TYPES)[number];

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  unassigned:     "Unassigned",
  sent_to_vendor: "Sent to Vendor",
  in_stock:       "In Stock",
  assigned:       "Assigned",
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  created:         "Created",
  sent_to_vendor:  "Sent to Vendor",
  received:        "Received",
  fully_assigned:  "Fully Assigned",
};

export function statusBadge(s: InventoryStatus | string): string {
  switch (s) {
    case "unassigned":     return "bg-slate-100 text-slate-600 border-slate-200";
    case "sent_to_vendor": return "bg-amber-100 text-amber-700 border-amber-200";
    case "in_stock":       return "bg-blue-100 text-blue-700 border-blue-200";
    case "assigned":       return "bg-green-100 text-green-700 border-green-200";
    default:               return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

export function batchStatusBadge(s: BatchStatus | string): string {
  switch (s) {
    case "created":        return "bg-slate-100 text-slate-600 border-slate-200";
    case "sent_to_vendor": return "bg-amber-100 text-amber-700 border-amber-200";
    case "received":       return "bg-blue-100 text-blue-700 border-blue-200";
    case "fully_assigned": return "bg-green-100 text-green-700 border-green-200";
    default:               return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function readSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function stripSearchParam(...keys: string[]): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  keys.forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.toString());
}
