import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

/* ─── Re-exported types shared with other modules ─── */
export type { UserProfile } from "@/services/userService";
export type { QRCodeRow } from "@/services/qrService";
export type { ContactRequest } from "@/services/contactRequestService";

/* ─── Admin-specific types ─── */
export interface AdminUser {
  id: string; user_id: string | null; email: string; name: string | null;
  role: string; permissions: Record<string, boolean>; created_at: string;
}
export interface Product {
  id: string; name: string; description: string | null; price: number | null;
  discount_price: number | null; image_url: string | null; category: string | null;
  rating: number; review_count: number; created_at: string;
}
export interface Order {
  id: string; customer_name: string | null; phone: string | null;
  alternate_phone: string | null; email: string | null;
  address_line_1: string | null; address_line_2: string | null;
  landmark: string | null; pincode: string | null; city: string | null;
  state: string | null; product_id: string | null; order_status: string;
  created_at: string;
}
export interface QRInventoryItem {
  id: string; qr_code: string; type: string | null; category: string | null;
  status: string; created_at: string;
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
  const { data } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
export async function adminBlockUser(id: string) {
  return supabase.from("user_profiles").update({ status: "blocked" }).eq("id", id);
}
export async function adminUnblockUser(id: string) {
  return supabase.from("user_profiles").update({ status: "active" }).eq("id", id);
}
export async function adminDeleteUser(id: string) {
  return supabase.from("user_profiles").delete().eq("id", id);
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
  const { data } = await supabase
    .from("qr_scans")
    .select("*")
    .in("qr_id", qrIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as QRScan[];
}

export async function adminGetScanCountByQRIds(qrIds: string[]): Promise<number> {
  if (qrIds.length === 0) return 0;
  const { count } = await supabase
    .from("qr_scans")
    .select("id", { count: "exact", head: true })
    .in("qr_id", qrIds);
  return count ?? 0;
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
  const { data } = await supabase.from("qr_codes").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
export async function adminDisableQRCode(id: string) {
  return supabase.from("qr_codes").update({ status: "inactive", is_active: false }).eq("id", id);
}
export async function adminEnableQRCode(id: string) {
  return supabase.from("qr_codes").update({ status: "active", is_active: true }).eq("id", id);
}
export async function adminDeleteQRCode(id: string) {
  return supabase.from("qr_codes").delete().eq("id", id);
}
export async function adminUpdateQRCode(id: string, updates: Record<string, unknown>) {
  return supabase.from("qr_codes").update(updates).eq("id", id);
}

/* ═══════════════════════════════════════════════════
   CONTACT REQUESTS (admin view)
   ═══════════════════════════════════════════════════ */
export async function adminGetAllContactRequests() {
  const { data } = await supabase.from("contact_requests").select("*").order("created_at", { ascending: false });
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [users, qrs, todayReqs, emergencyReqs, orders] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }),
    supabase.from("qr_codes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("contact_requests").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("intent", "emergency"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalUsers: users.count ?? 0,
    activeQRCodes: qrs.count ?? 0,
    todayRequests: todayReqs.count ?? 0,
    emergencyRequests: emergencyReqs.count ?? 0,
    totalOrders: orders.count ?? 0,
  };
}

export async function getScansPerDay(days = 7): Promise<{ date: string; scans: number }[]> {
  const since = new Date(); since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("activity_logs")
    .select("created_at")
    .eq("action_type", "scan")
    .gte("created_at", since.toISOString());

  const counts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  (data ?? []).forEach((row) => {
    const key = (row.created_at as string).slice(0, 10);
    if (key in counts) counts[key]++;
  });
  return Object.entries(counts).map(([date, scans]) => ({ date: date.slice(5), scans }));
}

export async function getRequestsByType(): Promise<{ name: string; value: number }[]> {
  const { data } = await supabase.from("contact_requests").select("intent");
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

export async function getTopQRCategories(): Promise<{ category: string; count: number }[]> {
  const { data } = await supabase.from("qr_codes").select("type");
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

export async function getPeakHourData(): Promise<{ hour: number; count: number }[]> {
  const { data } = await supabase
    .from("activity_logs")
    .select("created_at")
    .eq("action_type", "scan");

  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  (data ?? []).forEach((row) => {
    const h = new Date(row.created_at as string).getHours();
    hours[h].count++;
  });
  return hours;
}

/* ═══════════════════════════════════════════════════
   PRODUCTS
   ═══════════════════════════════════════════════════ */
export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}
export async function createProduct(p: Partial<Product>) {
  return supabase.from("products").insert(p);
}
export async function updateProduct(id: string, p: Partial<Product>) {
  return supabase.from("products").update(p).eq("id", id);
}
export async function deleteProduct(id: string) {
  return supabase.from("products").delete().eq("id", id);
}

/* ═══════════════════════════════════════════════════
   ORDERS
   ═══════════════════════════════════════════════════ */
export async function getOrders(): Promise<Order[]> {
  const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Order[];
}
export async function updateOrderStatus(id: string, status: string) {
  return supabase.from("orders").update({ order_status: status }).eq("id", id);
}

/* ═══════════════════════════════════════════════════
   QR INVENTORY
   ═══════════════════════════════════════════════════ */
export async function getInventory(): Promise<QRInventoryItem[]> {
  const { data } = await supabase.from("qr_inventory").select("*").order("created_at", { ascending: false });
  return (data ?? []) as QRInventoryItem[];
}
export async function bulkGenerateInventory(count: number, type: string, category: string) {
  const rows = Array.from({ length: count }, () => ({
    qr_code: `STG-INV-${uuidv4().slice(0, 8).toUpperCase()}`,
    type: type || null,
    category: category || null,
    status: "unclaimed",
  }));
  return supabase.from("qr_inventory").insert(rows);
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
  const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: false });
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
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Notification[];
}
export async function sendNotification(n: { title: string; message: string; target: string }) {
  return supabase.from("notifications").insert(n);
}

/* ═══════════════════════════════════════════════════
   SUPPORT
   ═══════════════════════════════════════════════════ */
export async function getSupportTickets(): Promise<SupportTicket[]> {
  const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
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
  const { data } = await supabase.from("settings").select("*").order("key");
  return (data ?? []) as Setting[];
}
export async function upsertSetting(key: string, value: string) {
  return supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
}
