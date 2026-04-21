import { supabase } from "@/lib/supabase";
import { ensureFreshSession, throwAsAuthError } from "@/lib/adminAuth";

/* ─── Types ─── */

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentType = "cod" | "online";

export interface ShippingDetails {
  name: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  address: string;
  landmark?: string;
  pincode: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  total_price: number;
  payment_type: PaymentType;
  order_status: OrderStatus;
  shipping_details: ShippingDetails;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  price: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface NewOrderItem {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  price: number;
}

/* ─── User-facing order functions ─── */

export async function createOrder(
  userId: string,
  items: NewOrderItem[],
  shipping: ShippingDetails,
  paymentType: PaymentType = "cod",
): Promise<{ orderId: string } | { error: string }> {
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      total_price: totalPrice,
      payment_type: paymentType,
      order_status: "placed",
      shipping_details: shipping,
    })
    .select("id")
    .single();

  if (orderErr || !orderData) {
    return { error: orderErr?.message ?? "Failed to create order" };
  }

  const orderId = (orderData as { id: string }).id;

  const orderItems = items.map((i) => ({
    order_id: orderId,
    product_id: i.product_id,
    variant_id: i.variant_id,
    product_name: i.product_name,
    variant_name: i.variant_name,
    quantity: i.quantity,
    price: i.price,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
  if (itemsErr) return { error: itemsErr.message };

  return { orderId };
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throwAsAuthError(error);
  return ((data ?? []) as unknown[]).map(normalizeOrder);
}

export async function getUserOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderData) return null;

  const { data: itemsData } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return {
    ...normalizeOrder(orderData),
    items: (itemsData ?? []) as OrderItem[],
  };
}

/* ─── Admin order functions ─── */

export async function adminGetOrders(
  status?: OrderStatus | "all",
  limit = 30,
  offset = 0,
): Promise<Order[]> {
  await ensureFreshSession();
  let q = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    q = q.eq("order_status", status);
  }

  const { data, error } = await q;
  if (error) throwAsAuthError(error);
  return ((data ?? []) as unknown[]).map(normalizeOrder);
}

export async function adminGetOrdersCount(status?: OrderStatus | "all"): Promise<number> {
  let q = supabase.from("orders").select("id", { count: "exact", head: true });
  if (status && status !== "all") q = q.eq("order_status", status);
  const { count, error } = await q;
  if (error) throwAsAuthError(error);
  return count ?? 0;
}

export async function adminGetOrderById(orderId: string): Promise<OrderWithItems | null> {
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderData) return null;

  const { data: itemsData } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return {
    ...normalizeOrder(orderData),
    items: (itemsData ?? []) as OrderItem[],
  };
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("orders")
    .update({ order_status: status })
    .eq("id", orderId);
  return { error: error?.message };
}

export const ORDER_STATUS_PIPELINE: OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/* ─── Helpers ─── */

function normalizeOrder(raw: unknown): Order {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    user_id: (r.user_id as string | null) ?? null,
    total_price: Number(r.total_price ?? 0),
    payment_type: (r.payment_type as PaymentType) ?? "cod",
    order_status: (r.order_status as OrderStatus) ?? "placed",
    shipping_details: (r.shipping_details as ShippingDetails) ?? ({} as ShippingDetails),
    created_at: r.created_at as string,
  };
}
