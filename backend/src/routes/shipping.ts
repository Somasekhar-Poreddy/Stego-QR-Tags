import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import {
  checkServiceability,
  createShiprocketOrder,
  assignCourier,
  requestPickup,
  trackByOrderId,
  cancelShipment,
  createReturn,
  getNdrList,
  handleNdr,
  probeShiprocketCredentials,
  isShiprocketConfigured,
  invalidateShiprocketToken,
} from "../services/shiprocketService.js";
import { getCommsSettings } from "../services/commsCredentials.js";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Missing token" }); return null; }
  const authRes = await fetch(
    `${process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL}/auth/v1/user`,
    { headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" } },
  );
  if (!authRes.ok) { res.status(401).json({ error: "Invalid token" }); return null; }
  const user = await authRes.json() as { id?: string };
  return user.id ?? null;
}

// ── Public: Shipping rate calculator ──────────────────────────────────

router.post("/shipping/rates", async (req: Request, res: Response) => {
  const { delivery_pincode, weight, cod } = req.body as {
    delivery_pincode?: string;
    weight?: number;
    cod?: boolean;
  };

  if (!delivery_pincode || delivery_pincode.length < 6) {
    res.status(400).json({ error: "Valid delivery pincode is required" });
    return;
  }

  if (!(await isShiprocketConfigured())) {
    res.status(503).json({ error: "Shipping not configured" });
    return;
  }

  try {
    const rates = await checkServiceability({
      pickupPincode: "",
      deliveryPincode: delivery_pincode,
      weight,
      cod,
    });
    res.json({ rates });
  } catch (err) {
    logger.warn({ err }, "Shipping rates check failed");
    res.status(500).json({ error: "Could not fetch shipping rates" });
  }
});

// ── Admin: Test connection ────────────────────────────────────────────

router.post("/admin/shipping/test", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  invalidateShiprocketToken();
  const result = await probeShiprocketCredentials();
  res.json(result);
});

// ── Admin: Create order on Shiprocket ─────────────────────────────────

router.post("/admin/shipping/create-order", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { order_id } = req.body as { order_id?: string };
  if (!order_id) { res.status(400).json({ error: "order_id required" }); return; }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", order_id)
    .maybeSingle();

  if (error || !order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.shiprocket_order_id) {
    res.status(409).json({ error: "Order already pushed to Shiprocket" });
    return;
  }

  const shipping = (order.shipping_details ?? {}) as Record<string, string>;
  const items = ((order.order_items ?? []) as Array<Record<string, unknown>>).map((item, i) => ({
    name: String(item.product_name ?? item.name ?? `Item ${i + 1}`),
    sku: String(item.product_id ?? item.id ?? `SKU-${i}`),
    units: Number(item.quantity) || 1,
    selling_price: Number(item.price) || 0,
  }));

  try {
    const result = await createShiprocketOrder({
      orderId: order_id.slice(0, 8),
      customerName: shipping.name ?? "Customer",
      customerPhone: shipping.phone ?? "",
      customerEmail: shipping.email ?? "",
      address: [shipping.address, shipping.landmark].filter(Boolean).join(", "),
      city: shipping.city ?? "",
      state: shipping.state ?? "",
      pincode: shipping.pincode ?? "",
      items,
      paymentMethod: order.payment_type === "cod" ? "COD" : "Prepaid",
      subtotal: Number(order.total_price) || 0,
    });

    await supabaseAdmin.from("orders").update({
      shiprocket_order_id: String(result.order_id),
      shiprocket_shipment_id: String(result.shipment_id),
    }).eq("id", order_id);

    res.json(result);
  } catch (err) {
    logger.error({ err, order_id }, "Failed to create Shiprocket order");
    res.status(500).json({ error: err instanceof Error ? err.message : "Shiprocket order creation failed" });
  }
});

// ── Admin: Assign courier + generate AWB ──────────────────────────────

router.post("/admin/shipping/assign-courier", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { order_id, shipment_id, courier_id } = req.body as {
    order_id?: string;
    shipment_id?: number;
    courier_id?: number;
  };

  if (!order_id || !shipment_id || !courier_id) {
    res.status(400).json({ error: "order_id, shipment_id, and courier_id required" });
    return;
  }

  try {
    const result = await assignCourier(shipment_id, courier_id);

    await supabaseAdmin.from("orders").update({
      awb_code: result.awb_code,
      courier_name: result.courier_name,
      courier_id: result.courier_company_id,
    }).eq("id", order_id);

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to assign courier");
    res.status(500).json({ error: err instanceof Error ? err.message : "Courier assignment failed" });
  }
});

// ── Admin: Request pickup ─────────────────────────────────────────────

router.post("/admin/shipping/request-pickup", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { order_id, shipment_id } = req.body as { order_id?: string; shipment_id?: number };
  if (!shipment_id) { res.status(400).json({ error: "shipment_id required" }); return; }

  try {
    const result = await requestPickup(shipment_id);

    if (order_id) {
      await supabaseAdmin.from("orders").update({
        order_status: "shipped",
        shipped_at: new Date().toISOString(),
      }).eq("id", order_id);
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to request pickup");
    res.status(500).json({ error: err instanceof Error ? err.message : "Pickup request failed" });
  }
});

// ── Admin: Track shipment ─────────────────────────────────────────────

router.get("/admin/shipping/track/:orderId", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { orderId } = req.params;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("shiprocket_order_id, awb_code")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.shiprocket_order_id) {
    res.status(404).json({ error: "No Shiprocket order found" });
    return;
  }

  try {
    const tracking = await trackByOrderId(order.shiprocket_order_id as string);

    if (tracking.tracking_url) {
      await supabaseAdmin.from("orders").update({
        tracking_url: tracking.tracking_url,
      }).eq("id", orderId);
    }

    res.json(tracking);
  } catch (err) {
    logger.warn({ err, orderId }, "Tracking fetch failed");
    res.status(500).json({ error: "Could not fetch tracking" });
  }
});

// ── Admin: Cancel shipment ────────────────────────────────────────────

router.post("/admin/shipping/cancel/:orderId", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { orderId } = req.params;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("shiprocket_order_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.shiprocket_order_id) {
    res.status(404).json({ error: "No Shiprocket order found" });
    return;
  }

  try {
    await cancelShipment(Number(order.shiprocket_order_id));

    await supabaseAdmin.from("orders").update({
      order_status: "cancelled",
    }).eq("id", orderId);

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to cancel shipment");
    res.status(500).json({ error: err instanceof Error ? err.message : "Cancel failed" });
  }
});

// ── Admin: Create return ──────────────────────────────────────────────

router.post("/admin/shipping/return", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;

  const { order_id } = req.body as { order_id?: string };
  if (!order_id) { res.status(400).json({ error: "order_id required" }); return; }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", order_id)
    .maybeSingle();

  if (!order?.shiprocket_order_id) {
    res.status(404).json({ error: "No Shiprocket order found" });
    return;
  }

  const items = ((order.order_items ?? []) as Array<Record<string, unknown>>).map((item, i) => ({
    name: String(item.product_name ?? item.name ?? `Item ${i + 1}`),
    sku: String(item.product_id ?? item.id ?? `SKU-${i}`),
    units: Number(item.quantity) || 1,
    selling_price: Number(item.price) || 0,
  }));

  try {
    const result = await createReturn({
      orderId: order_id,
      shiprocketOrderId: Number(order.shiprocket_order_id),
      items,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to create return");
    res.status(500).json({ error: err instanceof Error ? err.message : "Return creation failed" });
  }
});

// ── Admin: NDR management ─────────────────────────────────────────────

router.get("/admin/shipping/ndr", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const list = await getNdrList();
    res.json({ data: list });
  } catch (err) {
    logger.warn({ err }, "NDR list fetch failed");
    res.status(500).json({ error: "Could not fetch NDR list" });
  }
});

router.post("/admin/shipping/ndr/:id/action", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const ndrId = Number(req.params.id);
  const { action } = req.body as { action?: "re-attempt" | "return" };
  if (!action) { res.status(400).json({ error: "action required" }); return; }

  try {
    const result = await handleNdr(ndrId, action);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "NDR action failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "NDR action failed" });
  }
});

// ── Webhook: Shiprocket delivery status updates ───────────────────────

router.post("/webhooks/shiprocket/status", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const awb = String(body.awb ?? body.awb_code ?? "");
  const status = String(body.current_status ?? body.shipment_status ?? "");
  const srOrderId = String(body.order_id ?? body.shiprocket_order_id ?? "");
  const etd = body.etd as string | undefined;

  logger.info({ awb, status, srOrderId }, "Shiprocket webhook received");

  if (!awb && !srOrderId) {
    res.status(200).json({ ok: true });
    return;
  }

  const statusMap: Record<string, string> = {
    "PICKED UP": "shipped",
    "IN TRANSIT": "shipped",
    "OUT FOR DELIVERY": "shipped",
    "DELIVERED": "delivered",
    "RTO INITIATED": "cancelled",
    "RTO DELIVERED": "cancelled",
    "CANCELED": "cancelled",
    "CANCELLED": "cancelled",
  };
  const mappedStatus = statusMap[status.toUpperCase()] ?? null;

  const updates: Record<string, unknown> = {};
  if (mappedStatus) updates.order_status = mappedStatus;
  if (mappedStatus === "delivered") updates.delivered_at = new Date().toISOString();
  if (etd) updates.estimated_delivery = etd;

  if (Object.keys(updates).length > 0) {
    let query = supabaseAdmin.from("orders").update(updates);
    if (awb) query = query.eq("awb_code", awb);
    else query = query.eq("shiprocket_order_id", srOrderId);
    await query;
  }

  res.status(200).json({ ok: true });
});

export default router;
