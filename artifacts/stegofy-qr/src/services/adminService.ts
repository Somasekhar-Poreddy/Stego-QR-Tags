import { supabase } from "@/lib/supabase";
import { ensureFreshSession, throwAsAuthError } from "@/lib/adminAuth";

/* ─── Re-exported types shared with other modules ─── */
export type { UserProfile } from "@/services/userService";
export type { QRCodeRow } from "@/services/qrService";
export type { ContactRequest } from "@/services/contactRequestService";
export type { Product } from "@/services/productService";
export type { Order, OrderStatus, OrderWithItems } from "@/services/orderService";

/* ─── Admin-specific types ─── */
export interface AdminUser {
  id: string; user_id: string | null; email: string; name: string | null;
  role: string; permissions: Record<string, boolean>; created_at: string;
}
export type InventoryStatus = "unassigned" | "sent_to_vendor" | "in_stock" | "assigned";
export type BatchStatus = "created" | "sent_to_vendor" | "received" | "fully_assigned";
export interface QRInventoryItem {
  id: string;
  qr_code: string;
  type: string | null;
  category: string | null;
  status: InventoryStatus;
  created_at: string;
  updated_at?: string | null;
  batch_id?: string | null;
  display_code?: string | null;
  pin_code?: string | null;
  qr_url?: string | null;
  linked_qr_id?: string | null;
  linked_user_id?: string | null;
  vendor_name?: string | null;
}
export interface QRInventoryBatch {
  id: string;
  batch_number: string;
  category: string | null;
  type: string | null;
  total_count: number;
  vendor_name: string | null;
  vendor_contact: string | null;
  vendor_notes: string | null;
  status: BatchStatus;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface QRInventoryEvent {
  id: string;
  inventory_id: string;
  event_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
export interface InventoryCategorySetting {
  id: string;
  category: string;
  low_stock_threshold: number;
  reorder_count: number;
  alert_email: string | null;
  last_alerted_at: string | null;
  auto_generate: boolean;
  updated_at: string;
}
export interface LowStockAlert {
  id: string;
  category: string;
  current_stock: number;
  threshold: number;
  status: "open" | "resolved" | "dismissed";
  resolved_by_batch_id: string | null;
  created_at: string;
  resolved_at: string | null;
}
export interface Notification {
  id: string; title: string; message: string; target: string; created_at: string;
}
export interface SupportTicket {
  id: string; user_id: string | null; issue: string | null; response: string | null;
  status: string; created_at: string;
}
export interface Setting { key: string; value: string | null; updated_at: string; }

/* ═══════════════════════════════════════════════════
   USERS (admin view)
   ═══════════════════════════════════════════════════ */
export async function adminGetAllUsers() {
  await ensureFreshSession();
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return data ?? [];
}
export async function adminBlockUser(id: string): Promise<void> {
  const { error } = await supabase.from("user_profiles").update({ status: "blocked" }).eq("id", id);
  if (error) throwAsAuthError(error);
}
export async function adminUnblockUser(id: string): Promise<void> {
  const { error } = await supabase.from("user_profiles").update({ status: "active" }).eq("id", id);
  if (error) throwAsAuthError(error);
}

/**
 * Deletes a regular end-user account.
 *
 * This calls the backend /api/admin/delete-end-user endpoint which uses the
 * service role to:
 *   1. Clean up app-level rows (contact_requests, qr_codes, user_profiles)
 *   2. Delete the auth.users row (cascades to cart_items, anonymises orders)
 *
 * Doing this purely from the client via `supabase.from("user_profiles").delete()`
 * only removes the profile row and leaves the auth user able to sign in, and
 * can silently fail when RLS is restrictive.
 */
export async function adminDeleteUser(userId: string): Promise<void> {
  await ensureFreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/delete-end-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Delete failed (HTTP ${res.status})`);
  }
}
export async function adminGetUserQRCodes(userId: string) {
  const { data } = await supabase.from("qr_codes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data ?? [];
}
export async function adminGetContactRequestsByQR(qrId: string) {
  const { data } = await supabase.from("contact_requests").select("*").eq("qr_id", qrId).order("created_at", { ascending: false });
  return data ?? [];
}
export async function adminUpdateUserProfile(id: string, updates: Record<string, unknown>) {
  return supabase.from("user_profiles").upsert({ id, ...updates });
}
export async function adminGetAllContactRequestsForUser(userId: string) {
  const { data } = await supabase
    .from("contact_requests")
    .select("*, qr_codes!inner(id, name, user_id)")
    .eq("qr_codes.user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => {
    const qrInfo = row.qr_codes as { id: string; name: string; user_id: string } | null;
    const { qr_codes: _omit, ...rest } = row;
    return { ...rest, qr_name: qrInfo?.name ?? "—" };
  });
}
export async function adminGetQRCountsByUser(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase.from("qr_codes").select("user_id").in("user_id", userIds);
  const counts: Record<string, number> = {};
  userIds.forEach((id) => { counts[id] = 0; });
  (data ?? []).forEach((row) => {
    const uid = row.user_id as string;
    if (uid) counts[uid] = (counts[uid] ?? 0) + 1;
  });
  return counts;
}

/* ═══════════════════════════════════════════════════
   USER ACTIVITY LOGS (admin view)
   ═══════════════════════════════════════════════════ */
export interface ActivityLog {
  id: string;
  user_id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, string | null>;
}

export async function adminGetUserActivityLogCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("user_activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export async function adminGetUserActivityLogs(userId: string, limit = 30): Promise<ActivityLog[]> {
  const { data } = await supabase
    .from("user_activity_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityLog[];
}

export async function adminGetLastSeenByUsers(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("user_activity_logs")
    .select("user_id, created_at")
    .eq("event_type", "login")
    .in("user_id", userIds);
  const map: Record<string, string> = {};
  (data ?? []).forEach((row) => {
    const uid = row.user_id as string;
    const ts = row.created_at as string;
    if (!map[uid] || ts > map[uid]) map[uid] = ts;
  });
  return map;
}

/* ═══════════════════════════════════════════════════
   QR SCANS (admin view)
   ═══════════════════════════════════════════════════ */
export interface QRScan {
  id: string;
  qr_id: string;
  user_id: string | null;
  masked_ip: string | null;
  hashed_ip: string | null;
  encrypted_ip: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  session_id: string | null;
  intent: string | null;
  is_request_made: boolean;
  created_at: string;
}

export async function adminGetQRScans(qrId: string, limit = 30): Promise<QRScan[]> {
  const { data } = await supabase
    .from("qr_scans")
    .select("*")
    .eq("qr_id", qrId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as QRScan[];
}

export async function adminGetScansByQRIds(qrIds: string[], limit = 50): Promise<QRScan[]> {
  if (qrIds.length === 0) return [];
  const { data, error } = await supabase
    .from("qr_scans")
    .select("*")
    .in("qr_id", qrIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwAsAuthError(error);
  return (data ?? []) as QRScan[];
}

export async function adminGetScanCountByQRIds(qrIds: string[]): Promise<number> {
  if (qrIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("qr_scans")
    .select("id", { count: "exact", head: true })
    .in("qr_id", qrIds);
  if (error) throwAsAuthError(error);
  return count ?? 0;
}

/* ═══════════════════════════════════════════════════
   VISITOR LOG (all scans — global admin view)
   ═══════════════════════════════════════════════════ */
export type ScanFilter = "all" | "registered" | "strangers";

export interface ScanWithQRName extends QRScan {
  qr_name: string | null;
}

export async function adminGetAllScans(
  filter: ScanFilter = "all",
  limit = 30,
  offset = 0,
): Promise<ScanWithQRName[]> {
  let q = supabase
    .from("qr_scans")
    .select("*, qr_codes(name, display_code, type)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === "registered") q = q.not("user_id", "is", null);
  if (filter === "strangers") q = q.is("user_id", null);

  const { data, error } = await q;
  if (error) throwAsAuthError(error);

  return ((data ?? []) as unknown as (QRScan & { qr_codes: { name: string | null; display_code: string | null; type: string | null } | null })[]).map(
    (row) => ({
      ...row,
      qr_name: row.qr_codes?.name || row.qr_codes?.display_code || row.qr_codes?.type || null,
    }),
  );
}

export async function adminGetAllScansCount(filter: ScanFilter = "all"): Promise<number> {
  let q = supabase
    .from("qr_scans")
    .select("id", { count: "exact", head: true });

  if (filter === "registered") q = q.not("user_id", "is", null);
  if (filter === "strangers") q = q.is("user_id", null);

  const { count, error } = await q;
  if (error) throwAsAuthError(error);
  return count ?? 0;
}

export interface GeoBreakdownRow { country: string; count: number }
export interface DeviceBreakdownRow { device: string; count: number }

export async function adminGetGeoBreakdown(
  filter: ScanFilter = "all",
  from?: Date,
  to?: Date,
  topN = 10,
): Promise<GeoBreakdownRow[]> {
  let q = supabase.from("qr_scans").select("country").not("country", "is", null);
  if (filter === "registered") q = q.not("user_id", "is", null);
  if (filter === "strangers") q = q.is("user_id", null);
  if (from) q = q.gte("created_at", from.toISOString());
  if (to) q = q.lte("created_at", to.toISOString());

  const { data, error } = await q;
  if (error) throwAsAuthError(error);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const key = (row.country as string) || "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([country, count]) => ({ country, count }));
}

export async function adminGetDeviceBreakdown(
  filter: ScanFilter = "all",
  from?: Date,
  to?: Date,
): Promise<DeviceBreakdownRow[]> {
  let q = supabase.from("qr_scans").select("device");
  if (filter === "registered") q = q.not("user_id", "is", null);
  if (filter === "strangers") q = q.is("user_id", null);
  if (from) q = q.gte("created_at", from.toISOString());
  if (to) q = q.lte("created_at", to.toISOString());

  const { data, error } = await q;
  if (error) throwAsAuthError(error);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const key = (row.device as string) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, count }));
}

export interface ScanSummary { total: number; registered: number; strangers: number }

export async function adminGetScanSummary(from: Date, to: Date): Promise<ScanSummary> {
  const [allRes, regRes, stranRes] = await Promise.all([
    supabase.from("qr_scans").select("id", { count: "exact", head: true })
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
    supabase.from("qr_scans").select("id", { count: "exact", head: true })
      .not("user_id", "is", null)
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
    supabase.from("qr_scans").select("id", { count: "exact", head: true })
      .is("user_id", null)
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
  ]);
  return {
    total: allRes.count ?? 0,
    registered: regRes.count ?? 0,
    strangers: stranRes.count ?? 0,
  };
}

export interface ScanDaySplit { date: string; registered: number; strangers: number }

export async function getScansPerDayWithSplit(from: Date, to: Date): Promise<ScanDaySplit[]> {
  const { data } = await supabase
    .from("qr_scans")
    .select("created_at, user_id")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const reg: Record<string, number> = {};
  const str: Record<string, number> = {};
  const cur = new Date(from);
  while (cur <= to) {
    const k = cur.toISOString().slice(0, 10);
    reg[k] = 0;
    str[k] = 0;
    cur.setDate(cur.getDate() + 1);
  }
  (data ?? []).forEach((row) => {
    const k = (row.created_at as string).slice(0, 10);
    if (!(k in reg)) return;
    if (row.user_id) reg[k]++;
    else str[k]++;
  });
  return Object.keys(reg).sort().map((date) => ({
    date: date.slice(5),
    registered: reg[date],
    strangers: str[date],
  }));
}

export async function adminDecryptIP(
  encryptedIp: string,
  qrId?: string,
  scanId?: string,
): Promise<{ ip: string } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/decrypt-ip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ encrypted_ip: encryptedIp, qr_id: qrId, scan_id: scanId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { error: body.error ?? `Failed (${res.status})` };
  }
  return res.json() as Promise<{ ip: string }>;
}

/* ═══════════════════════════════════════════════════
   QR CODES (admin view)
   ═══════════════════════════════════════════════════ */
export async function adminGetAllQRCodes() {
  await ensureFreshSession();
  const { data, error } = await supabase.from("qr_codes").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return data ?? [];
}
export async function adminDisableQRCode(id: string): Promise<void> {
  const { error } = await supabase.from("qr_codes").update({ status: "inactive", is_active: false }).eq("id", id);
  if (error) throwAsAuthError(error);
}
export async function adminEnableQRCode(id: string): Promise<void> {
  const { error } = await supabase.from("qr_codes").update({ status: "active", is_active: true }).eq("id", id);
  if (error) throwAsAuthError(error);
}
export async function adminDeleteQRCode(id: string): Promise<void> {
  const { error } = await supabase.from("qr_codes").delete().eq("id", id);
  if (error) throwAsAuthError(error);
}
export async function adminUpdateQRCode(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("qr_codes").update(updates).eq("id", id);
  if (error) throwAsAuthError(error);
}

/* ═══════════════════════════════════════════════════
   CONTACT REQUESTS (admin view)
   ═══════════════════════════════════════════════════ */
export async function adminGetAllContactRequests() {
  await ensureFreshSession();
  const { data, error } = await supabase.from("contact_requests").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return data ?? [];
}
export async function adminResolveContactRequest(id: string) {
  return supabase.from("contact_requests").update({ status: "resolved" }).eq("id", id);
}
export async function adminRejectContactRequest(id: string) {
  return supabase.from("contact_requests").update({ status: "rejected" }).eq("id", id);
}

/* ═══════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════ */
export async function getDashboardStats() {
  await ensureFreshSession();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [users, qrs, todayReqs, emergencyReqs, orders] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }),
    supabase.from("qr_codes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("contact_requests").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("intent", "emergency"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);

  const firstError = users.error ?? qrs.error ?? todayReqs.error ?? emergencyReqs.error ?? orders.error;
  if (firstError) throwAsAuthError(firstError);

  return {
    totalUsers: users.count ?? 0,
    activeQRCodes: qrs.count ?? 0,
    todayRequests: todayReqs.count ?? 0,
    emergencyRequests: emergencyReqs.count ?? 0,
    totalOrders: orders.count ?? 0,
  };
}

export async function getScansPerDay(from: Date, to: Date): Promise<{ date: string; scans: number }[]> {
  const { data, error } = await supabase
    .from("qr_scans")
    .select("created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());
  if (error) throwAsAuthError(error);

  const counts: Record<string, number> = {};
  const cur = new Date(from);
  while (cur <= to) {
    counts[cur.toISOString().slice(0, 10)] = 0;
    cur.setDate(cur.getDate() + 1);
  }
  (data ?? []).forEach((row) => {
    const key = (row.created_at as string).slice(0, 10);
    if (key in counts) counts[key]++;
  });
  return Object.entries(counts).map(([date, scans]) => ({ date: date.slice(5), scans }));
}

export async function getRequestsByType(from?: Date, to?: Date): Promise<{ name: string; value: number }[]> {
  let q = supabase.from("contact_requests").select("intent");
  if (from) q = q.gte("created_at", from.toISOString());
  if (to) q = q.lte("created_at", to.toISOString());
  const { data, error } = await q;
  if (error) throwAsAuthError(error);
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const key = (row.intent as string) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

export async function getTopQRCategories(from?: Date, to?: Date): Promise<{ category: string; count: number }[]> {
  let q = supabase.from("qr_codes").select("type");
  if (from) q = q.gte("created_at", from.toISOString());
  if (to) q = q.lte("created_at", to.toISOString());
  const { data } = await q;
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const key = (row.type as string) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));
}

export async function getPeakHourData(from?: Date, to?: Date): Promise<{ hour: number; count: number }[]> {
  let q = supabase.from("qr_scans").select("created_at");
  if (from) q = q.gte("created_at", from.toISOString());
  if (to) q = q.lte("created_at", to.toISOString());
  const { data } = await q;

  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  (data ?? []).forEach((row) => {
    const h = new Date(row.created_at as string).getHours();
    hours[h].count++;
  });
  return hours;
}

/* ═══════════════════════════════════════════════════
   PRODUCTS — canonical admin API lives in productService.ts
   (adminGetAllProducts, adminCreateProduct, adminUpdateProduct,
   adminDeleteProduct, adminUpsertVariants, getProductVariants)
   Import directly from "@/services/productService" in product screens.
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   ORDERS — canonical admin API lives in orderService.ts.
   Re-exported here for convenience as required by task #31.
   ═══════════════════════════════════════════════════ */
export {
  adminGetOrders,
  adminGetOrdersCount,
  adminGetOrderById,
  adminUpdateOrderStatus,
  ORDER_STATUS_PIPELINE,
  ORDER_STATUS_LABELS,
} from "@/services/orderService";

/* ═══════════════════════════════════════════════════
   QR INVENTORY
   ═══════════════════════════════════════════════════ */

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureFreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-app-origin": typeof window !== "undefined" ? window.location.origin : "",
      ...(init.headers ?? {}),
    },
  });
}

// Legacy wrapper — keep for any external caller still importing it.
export async function getInventory(): Promise<QRInventoryItem[]> {
  await ensureFreshSession();
  const { data, error } = await supabase
    .from("qr_inventory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as QRInventoryItem[];
}

export interface InventoryFilters {
  status?: InventoryStatus | "all";
  type?: string | "all";
  batchId?: string | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getInventoryPaginated(
  filters: InventoryFilters = {},
): Promise<{ items: QRInventoryItem[]; total: number }> {
  await ensureFreshSession();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("qr_inventory").select("*", { count: "exact" });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
  if (filters.batchId && filters.batchId !== "all") q = q.eq("batch_id", filters.batchId);
  if (filters.search) {
    const s = filters.search.trim();
    // qr_code, display_code, or qr_url (case-insensitive partial match)
    q = q.or(`qr_code.ilike.%${s}%,display_code.ilike.%${s}%,qr_url.ilike.%${s}%`);
  }
  q = q.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throwAsAuthError(error);
  return { items: (data ?? []) as QRInventoryItem[], total: count ?? 0 };
}

export async function getInventoryCounts(): Promise<Record<InventoryStatus | "all", number>> {
  await ensureFreshSession();
  const statuses: InventoryStatus[] = ["unassigned", "sent_to_vendor", "in_stock", "assigned"];
  const results = await Promise.all([
    supabase.from("qr_inventory").select("id", { count: "exact", head: true }),
    ...statuses.map((s) =>
      supabase.from("qr_inventory").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  ]);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throwAsAuthError(firstError);
  return {
    all: results[0].count ?? 0,
    unassigned: results[1].count ?? 0,
    sent_to_vendor: results[2].count ?? 0,
    in_stock: results[3].count ?? 0,
    assigned: results[4].count ?? 0,
  };
}

export async function getInventoryById(
  id: string,
): Promise<{ item: QRInventoryItem | null; events: QRInventoryEvent[] }> {
  await ensureFreshSession();
  const [itemRes, eventsRes] = await Promise.all([
    supabase.from("qr_inventory").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("qr_inventory_events")
      .select("*")
      .eq("inventory_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (itemRes.error) throwAsAuthError(itemRes.error);
  if (eventsRes.error) throwAsAuthError(eventsRes.error);
  return {
    item: (itemRes.data as QRInventoryItem | null) ?? null,
    events: (eventsRes.data ?? []) as QRInventoryEvent[],
  };
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<Pick<QRInventoryItem, "type" | "category" | "vendor_name">>,
): Promise<void> {
  const { error } = await supabase
    .from("qr_inventory")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throwAsAuthError(error);
  await supabase.from("qr_inventory_events").insert({
    inventory_id: id,
    event_type: "edited",
    description: "Inventory row edited",
    metadata: { fields: Object.keys(updates) },
  });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const res = await authedFetch("/api/admin/inventory/bulk-delete", {
    method: "DELETE",
    body: JSON.stringify({ ids: [id] }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Delete failed (${res.status})`);
  }
}

export async function bulkDeleteInventory(ids: string[]): Promise<{ deleted: number }> {
  const res = await authedFetch("/api/admin/inventory/bulk-delete", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  const body = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Delete failed (${res.status})`);
  return { deleted: body.deleted ?? 0 };
}

export async function getInventoryEvents(inventoryId: string): Promise<QRInventoryEvent[]> {
  const { data, error } = await supabase
    .from("qr_inventory_events")
    .select("*")
    .eq("inventory_id", inventoryId)
    .order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as QRInventoryEvent[];
}

/* ─── Batches ─────────────────────────────────────────────────────────────── */

export interface BatchFilters {
  status?: BatchStatus | "all";
  page?: number;
  pageSize?: number;
}

export async function getBatches(
  filters: BatchFilters = {},
): Promise<{ batches: QRInventoryBatch[]; total: number }> {
  await ensureFreshSession();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase.from("qr_inventory_batches").select("*", { count: "exact" });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  q = q.order("created_at", { ascending: false }).range(from, to);
  const { data, error, count } = await q;
  if (error) throwAsAuthError(error);
  return { batches: (data ?? []) as QRInventoryBatch[], total: count ?? 0 };
}

export async function getBatchById(
  id: string,
): Promise<{ batch: QRInventoryBatch | null; items: QRInventoryItem[] }> {
  await ensureFreshSession();
  const [batchRes, itemsRes] = await Promise.all([
    supabase.from("qr_inventory_batches").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("qr_inventory")
      .select("*")
      .eq("batch_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (batchRes.error) throwAsAuthError(batchRes.error);
  if (itemsRes.error) throwAsAuthError(itemsRes.error);
  return {
    batch: (batchRes.data as QRInventoryBatch | null) ?? null,
    items: (itemsRes.data ?? []) as QRInventoryItem[],
  };
}

export async function updateBatch(
  id: string,
  updates: Partial<Pick<QRInventoryBatch, "vendor_name" | "vendor_contact" | "vendor_notes" | "category">>,
): Promise<void> {
  const { error } = await supabase
    .from("qr_inventory_batches")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throwAsAuthError(error);
}

export async function deleteBatch(id: string): Promise<void> {
  // Block deletion if any linked item is already assigned.
  const { count } = await supabase
    .from("qr_inventory")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", id)
    .eq("status", "assigned");
  if ((count ?? 0) > 0) {
    throw new Error(`Cannot delete batch — ${count} item(s) already assigned to users.`);
  }
  const { error } = await supabase.from("qr_inventory_batches").delete().eq("id", id);
  if (error) throwAsAuthError(error);
}

/* ─── Backend-wrapped operations ──────────────────────────────────────────── */

export interface BulkGenerateArgs {
  count: number;
  type: string;
  category?: string;
  vendor_name?: string;
  vendor_contact?: string;
  vendor_notes?: string;
}

export async function bulkGenerateInventory(
  args: BulkGenerateArgs,
): Promise<{ batch_id: string; batch_number: string; count: number; item_ids: string[] }> {
  const res = await authedFetch("/api/admin/inventory/bulk-generate", {
    method: "POST",
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => ({}))) as {
    batch_id?: string;
    batch_number?: string;
    count?: number;
    item_ids?: string[];
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? `Generate failed (${res.status})`);
  return {
    batch_id: body.batch_id ?? "",
    batch_number: body.batch_number ?? "",
    count: body.count ?? 0,
    item_ids: body.item_ids ?? [],
  };
}

export async function sendBatchToVendor(args: {
  batchId: string;
  vendorName?: string;
  vendorContact?: string;
  vendorNotes?: string;
}): Promise<{ updated: number }> {
  const res = await authedFetch("/api/admin/inventory/send-to-vendor", {
    method: "POST",
    body: JSON.stringify({
      batch_id: args.batchId,
      vendor_name: args.vendorName,
      vendor_contact: args.vendorContact,
      vendor_notes: args.vendorNotes,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { updated?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Send failed (${res.status})`);
  return { updated: body.updated ?? 0 };
}

export async function markBatchReceived(batchId: string): Promise<{ updated: number }> {
  const res = await authedFetch("/api/admin/inventory/mark-received", {
    method: "POST",
    body: JSON.stringify({ batch_id: batchId }),
  });
  const body = (await res.json().catch(() => ({}))) as { updated?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Mark-received failed (${res.status})`);
  return { updated: body.updated ?? 0 };
}

export async function bulkUpdateStatus(
  ids: string[],
  status: InventoryStatus,
): Promise<{ updated: number }> {
  const res = await authedFetch("/api/admin/inventory/bulk-status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
  const body = (await res.json().catch(() => ({}))) as { updated?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Status update failed (${res.status})`);
  return { updated: body.updated ?? 0 };
}

/* ─── Category settings & low-stock alerts ───────────────────────────────── */

export async function getInventorySettings(): Promise<InventoryCategorySetting[]> {
  await ensureFreshSession();
  const { data, error } = await supabase
    .from("inventory_category_settings")
    .select("*")
    .order("category");
  if (error) throwAsAuthError(error);
  return (data ?? []) as InventoryCategorySetting[];
}

export async function updateInventorySetting(
  category: string,
  updates: Partial<Pick<InventoryCategorySetting, "low_stock_threshold" | "reorder_count" | "alert_email">>,
): Promise<void> {
  const { error } = await supabase
    .from("inventory_category_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("category", category);
  if (error) throwAsAuthError(error);
}

export async function getOpenLowStockAlerts(): Promise<LowStockAlert[]> {
  const { data, error } = await supabase
    .from("inventory_low_stock_alerts")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as LowStockAlert[];
}

export async function dismissLowStockAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from("inventory_low_stock_alerts")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throwAsAuthError(error);
}

/* ─── Linked-user lookup (for the detail panel) ──────────────────────────── */

export async function getInventoryAssignedUser(
  linkedUserId: string,
): Promise<{ id: string; name: string | null; email: string | null } | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email")
    .eq("id", linkedUserId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; first_name: string | null; last_name: string | null; email: string | null };
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || null;
  return { id: row.id, name, email: row.email };
}

/* ═══════════════════════════════════════════════════
   PERMISSION DEFINITIONS
   ═══════════════════════════════════════════════════ */
export interface PermissionDefinition {
  key: string;
  label: string;
  sort_order: number;
}

export async function getPermissionDefinitions(): Promise<PermissionDefinition[]> {
  const { data, error } = await supabase
    .from("permission_definitions")
    .select("key, label, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return [];
  return data as PermissionDefinition[];
}

/* ═══════════════════════════════════════════════════
   TEAM / ADMIN USERS
   ═══════════════════════════════════════════════════ */
export async function getAdminUsers(): Promise<AdminUser[]> {
  await ensureFreshSession();
  const { data, error } = await supabase.from("admin_users").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as AdminUser[];
}
export async function addAdminUser(data: Partial<AdminUser> & { password?: string; confirmPassword?: string }): Promise<{ error?: string }> {
  const { password, confirmPassword: _confirm, ...rest } = data;
  if (password) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...rest, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { error: body.error ?? `Request failed (${res.status})` };
    }
    return {};
  }
  const { error } = await supabase.from("admin_users").insert(rest);
  return { error: error?.message };
}
export async function updateAdminUser(id: string, data: Partial<AdminUser>) {
  return supabase.from("admin_users").update(data).eq("id", id);
}
export async function removeAdminUser(id: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/delete-user", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ adminUsersId: id }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { error: body.error ?? `Delete failed (${res.status})` };
  }
  return {};
}

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════ */
export async function getNotifications(): Promise<Notification[]> {
  await ensureFreshSession();
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as Notification[];
}
export async function sendNotification(n: { title: string; message: string; target: string }) {
  return supabase.from("notifications").insert(n);
}

/* ═══════════════════════════════════════════════════
   SUPPORT
   ═══════════════════════════════════════════════════ */
export async function getSupportTickets(): Promise<SupportTicket[]> {
  await ensureFreshSession();
  const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
  if (error) throwAsAuthError(error);
  return (data ?? []) as SupportTicket[];
}
export async function respondToTicket(id: string, response: string) {
  return supabase.from("support_tickets").update({ response, status: "resolved" }).eq("id", id);
}
export async function resolveTicket(id: string) {
  return supabase.from("support_tickets").update({ status: "resolved" }).eq("id", id);
}

/* ═══════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════ */
export async function getSettings(): Promise<Setting[]> {
  await ensureFreshSession();
  const { data, error } = await supabase.from("settings").select("*").order("key");
  if (error) throwAsAuthError(error);
  return (data ?? []) as Setting[];
}
export async function upsertSetting(key: string, value: string) {
  return supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
}
