import { logger } from "../lib/logger.js";
import { getCommsSettings } from "./commsCredentials.js";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getCredentials() {
  const s = await getCommsSettings();
  return {
    email: (s as Record<string, string>).shiprocket_email ?? "",
    password: (s as Record<string, string>).shiprocket_password ?? "",
    pickupPincode: (s as Record<string, string>).shiprocket_pickup_pincode ?? "",
    autoShip: (s as Record<string, string>).shiprocket_auto_ship === "true",
    defaultWeight: Number((s as Record<string, string>).shiprocket_default_weight) || 0.5,
    defaultLength: Number((s as Record<string, string>).shiprocket_default_length) || 10,
    defaultBreadth: Number((s as Record<string, string>).shiprocket_default_breadth) || 10,
    defaultHeight: Number((s as Record<string, string>).shiprocket_default_height) || 5,
  };
}

export async function isShiprocketConfigured(): Promise<boolean> {
  const { email, password } = await getCredentials();
  return Boolean(email && password);
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const { email, password } = await getCredentials();
  if (!email || !password) throw new Error("Shiprocket credentials not configured");

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await res.json() as { token?: string };
  if (!res.ok || !data.token) {
    throw new Error(`Shiprocket auth failed (HTTP ${res.status})`);
  }

  cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60_000 };
  return data.token;
}

async function srFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn({ status: res.status, path, response: json }, "Shiprocket API error");
    throw new Error(`Shiprocket ${path} failed (HTTP ${res.status})`);
  }
  return json;
}

export function invalidateShiprocketToken(): void {
  cachedToken = null;
}

export async function probeShiprocketCredentials(): Promise<{ ok: boolean; error: string | null }> {
  try {
    invalidateShiprocketToken();
    await getToken();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Auth failed" };
  }
}

export interface CourierRate {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  estimated_delivery_days: number;
  etd: string;
  cod: boolean;
  freight_charge: number;
}

export async function checkServiceability(args: {
  pickupPincode: string;
  deliveryPincode: string;
  weight?: number;
  cod?: boolean;
}): Promise<CourierRate[]> {
  const creds = await getCredentials();
  const weight = args.weight ?? creds.defaultWeight;
  const pickup = args.pickupPincode || creds.pickupPincode;

  const params = new URLSearchParams({
    pickup_postcode: pickup,
    delivery_postcode: args.deliveryPincode,
    weight: String(weight),
    cod: args.cod ? "1" : "0",
  });

  const data = await srFetch("GET", `/courier/serviceability/?${params}`) as {
    data?: { available_courier_companies?: Array<Record<string, unknown>> };
  };

  const couriers = data?.data?.available_courier_companies ?? [];
  return couriers.map((c) => ({
    courier_company_id: Number(c.courier_company_id) || 0,
    courier_name: String(c.courier_name ?? ""),
    rate: Number(c.rate) || 0,
    estimated_delivery_days: Number(c.estimated_delivery_days) || 0,
    etd: String(c.etd ?? ""),
    cod: Boolean(c.cod),
    freight_charge: Number(c.freight_charge) || 0,
  }));
}

export interface ShiprocketOrderResult {
  order_id: number;
  shipment_id: number;
  status: string;
  channel_order_id: string;
}

export async function createShiprocketOrder(args: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items: Array<{ name: string; sku: string; units: number; selling_price: number }>;
  paymentMethod: "COD" | "Prepaid";
  subtotal: number;
}): Promise<ShiprocketOrderResult> {
  const creds = await getCredentials();

  const body = {
    order_id: args.orderId,
    order_date: new Date().toISOString().split("T")[0],
    pickup_location: "Primary",
    billing_customer_name: args.customerName,
    billing_last_name: "",
    billing_address: args.address,
    billing_city: args.city,
    billing_pincode: args.pincode,
    billing_state: args.state,
    billing_country: "India",
    billing_email: args.customerEmail || "noreply@stegotags.com",
    billing_phone: args.customerPhone,
    shipping_is_billing: true,
    order_items: args.items,
    payment_method: args.paymentMethod,
    sub_total: args.subtotal,
    length: creds.defaultLength,
    breadth: creds.defaultBreadth,
    height: creds.defaultHeight,
    weight: creds.defaultWeight,
  };

  const data = await srFetch("POST", "/orders/create/adhoc", body) as {
    order_id?: number;
    shipment_id?: number;
    status?: string;
    channel_order_id?: string;
  };

  return {
    order_id: data.order_id ?? 0,
    shipment_id: data.shipment_id ?? 0,
    status: String(data.status ?? ""),
    channel_order_id: String(data.channel_order_id ?? ""),
  };
}

export interface AssignCourierResult {
  awb_code: string;
  courier_company_id: number;
  courier_name: string;
}

export async function assignCourier(shipmentId: number, courierId: number): Promise<AssignCourierResult> {
  const data = await srFetch("POST", "/courier/assign/awb", {
    shipment_id: shipmentId,
    courier_id: courierId,
  }) as { response?: { data?: { awb_code?: string; courier_company_id?: number; courier_name?: string } } };

  const d = data?.response?.data;
  return {
    awb_code: String(d?.awb_code ?? ""),
    courier_company_id: Number(d?.courier_company_id) || courierId,
    courier_name: String(d?.courier_name ?? ""),
  };
}

export async function requestPickup(shipmentId: number): Promise<{ status: string }> {
  const data = await srFetch("POST", "/shipments/pickup", {
    shipment_id: [shipmentId],
  }) as { pickup_status?: string };
  return { status: String(data.pickup_status ?? "scheduled") };
}

export interface TrackingResult {
  current_status: string;
  shipment_track: Array<{
    date: string;
    activity: string;
    location: string;
  }>;
  etd: string;
  tracking_url: string;
}

export async function trackByOrderId(orderId: string): Promise<TrackingResult> {
  const data = await srFetch("GET", `/courier/track?order_id=${encodeURIComponent(orderId)}`) as Record<string, unknown>;

  const trackData = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const trackingData = (trackData?.tracking_data as Record<string, unknown>) ?? {};
  const shipmentTrack = (trackingData.shipment_track as Array<Record<string, unknown>>) ?? [];

  return {
    current_status: String(trackingData.shipment_status ?? trackingData.current_status ?? ""),
    shipment_track: shipmentTrack.map((t) => ({
      date: String(t.date ?? ""),
      activity: String(t.activity ?? t["sr-status-label"] ?? ""),
      location: String(t.location ?? ""),
    })),
    etd: String(trackingData.etd ?? ""),
    tracking_url: String(trackingData.track_url ?? ""),
  };
}

export async function trackByAwb(awb: string): Promise<TrackingResult> {
  const data = await srFetch("GET", `/courier/track/awb/${encodeURIComponent(awb)}`) as Record<string, unknown>;

  const trackData = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const trackingData = (trackData?.tracking_data as Record<string, unknown>) ?? {};
  const shipmentTrack = (trackingData.shipment_track as Array<Record<string, unknown>>) ?? [];

  return {
    current_status: String(trackingData.shipment_status ?? trackingData.current_status ?? ""),
    shipment_track: shipmentTrack.map((t) => ({
      date: String(t.date ?? ""),
      activity: String(t.activity ?? t["sr-status-label"] ?? ""),
      location: String(t.location ?? ""),
    })),
    etd: String(trackingData.etd ?? ""),
    tracking_url: String(trackingData.track_url ?? ""),
  };
}

export async function cancelShipment(shiprocketOrderId: number): Promise<{ status: string }> {
  const data = await srFetch("POST", "/orders/cancel", {
    ids: [shiprocketOrderId],
  }) as Record<string, unknown>;
  return { status: String((data as Record<string, string>).status ?? "cancelled") };
}

export async function createReturn(args: {
  orderId: string;
  shiprocketOrderId: number;
  items: Array<{ name: string; sku: string; units: number; selling_price: number }>;
}): Promise<{ order_id: number; shipment_id: number }> {
  const creds = await getCredentials();
  const data = await srFetch("POST", "/orders/create/return", {
    order_id: args.shiprocketOrderId,
    order_date: new Date().toISOString().split("T")[0],
    pickup_location: "Primary",
    order_items: args.items,
    length: creds.defaultLength,
    breadth: creds.defaultBreadth,
    height: creds.defaultHeight,
    weight: creds.defaultWeight,
  }) as { order_id?: number; shipment_id?: number };

  return {
    order_id: data.order_id ?? 0,
    shipment_id: data.shipment_id ?? 0,
  };
}

export async function getNdrList(): Promise<Array<Record<string, unknown>>> {
  const data = await srFetch("GET", "/ndr") as { data?: Array<Record<string, unknown>> };
  return data?.data ?? [];
}

export async function handleNdr(ndrId: number, action: "re-attempt" | "return"): Promise<{ status: string }> {
  const data = await srFetch("POST", `/ndr/${ndrId}/action`, { action }) as Record<string, unknown>;
  return { status: String((data as Record<string, string>).status ?? "done") };
}
