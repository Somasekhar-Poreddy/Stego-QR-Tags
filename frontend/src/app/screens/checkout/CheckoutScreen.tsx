import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ShoppingBag, MapPin, Phone, Mail, AlertCircle, Truck, RefreshCw } from "lucide-react";
import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/app/context/AuthContext";
import { createOrder, type ShippingDetails } from "@/services/orderService";
import { apiUrl } from "@/lib/apiUrl";
import { cn } from "@/lib/utils";

/* ─── Field component ─── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 block">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", required
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
    />
  );
}

/* ─── Cart summary ─── */

function CartSummary() {
  const { items, totalPrice } = useCart();
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-primary" /> Order Summary
      </h2>
      <div className="divide-y divide-slate-50">
        {items.map((item) => (
          <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3 py-2">
            {item.image ? (
              <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{item.productName}</p>
              {item.variantName && <p className="text-[10px] text-slate-400">{item.variantName}</p>}
              <p className="text-[10px] text-slate-500">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-bold text-slate-800 flex-shrink-0">
              ₹{(item.price * item.quantity).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm font-bold text-slate-800">Total</span>
        <span className="text-base font-bold text-primary">₹{totalPrice.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1.5 bg-green-50 text-green-700 rounded-xl px-3 py-2 text-xs font-semibold">
        <span>💵</span> Cash on Delivery (COD)
      </div>
    </div>
  );
}

/* ─── Main screen ─── */

export function CheckoutScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { items, totalItems, clearCart } = useCart();

  const [form, setForm] = useState<ShippingDetails>({
    name: user?.name ?? "",
    phone: user?.mobile ?? user?.phone ?? "",
    alternate_phone: "",
    email: user?.email ?? "",
    address: "",
    landmark: "",
    pincode: "",
    city: "",
    state: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shipping rates
  interface ShippingRate {
    courier_company_id: number;
    courier_name: string;
    rate: number;
    estimated_delivery_days: number;
    etd: string;
  }
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const lastFetchedPincode = useRef("");

  useEffect(() => {
    const pincode = form.pincode.replace(/\D/g, "");
    if (pincode.length !== 6 || pincode === lastFetchedPincode.current) return;
    lastFetchedPincode.current = pincode;
    setRatesLoading(true);
    setRatesError(null);
    setShippingRates([]);
    setSelectedShipping(null);
    setShippingCost(0);

    fetch(apiUrl("/api/shipping/rates"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_pincode: pincode, cod: true }),
    })
      .then((r) => r.json())
      .then((data: { rates?: ShippingRate[]; error?: string }) => {
        if (data.error) {
          setRatesError(data.error);
        } else {
          const rates = data.rates ?? [];
          setShippingRates(rates);
          if (rates.length > 0) {
            const cheapest = rates.reduce((a, b) => (a.rate < b.rate ? a : b));
            setSelectedShipping(cheapest.courier_company_id);
            setShippingCost(cheapest.rate);
          }
        }
      })
      .catch(() => setRatesError("Could not fetch shipping rates"))
      .finally(() => setRatesLoading(false));
  }, [form.pincode]);

  const set = (key: keyof ShippingDetails) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  if (totalItems === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-slate-50">
        <ShoppingBag className="w-16 h-16 text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Your cart is empty</p>
        <button
          onClick={() => navigate("/app/shop")}
          className="px-6 py-3 bg-primary text-white rounded-2xl text-sm font-semibold"
        >
          Browse Products
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setError(null);
    setSubmitting(true);

    const orderItems = items.map((i) => ({
      product_id: i.productId,
      variant_id: i.variantId,
      product_name: i.productName,
      variant_name: i.variantName,
      quantity: i.quantity,
      price: i.price,
    }));

    const shipping: ShippingDetails = {
      name: form.name,
      phone: form.phone,
      ...(form.alternate_phone && { alternate_phone: form.alternate_phone }),
      ...(form.email && { email: form.email }),
      address: form.address,
      ...(form.landmark && { landmark: form.landmark }),
      pincode: form.pincode,
      city: form.city,
      state: form.state,
    };

    const result = await createOrder(user.id, orderItems, shipping, "cod");

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    clearCart();
    navigate(`/app/order/confirm/${result.orderId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/shop")}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-base font-bold text-slate-900">Checkout</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-8">
        {/* Cart summary */}
        <CartSummary />

        {/* Shipping details */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Shipping Details
          </h2>

          <Field label="Full Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="Enter your name" required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" required>
              <Input value={form.phone} onChange={set("phone")} placeholder="10-digit number" type="tel" required />
            </Field>
            <Field label="Alternate Phone">
              <Input value={form.alternate_phone ?? ""} onChange={set("alternate_phone")} placeholder="Optional" type="tel" />
            </Field>
          </div>

          <Field label="Email">
            <Input value={form.email ?? ""} onChange={set("email")} placeholder="Optional" type="email" />
          </Field>

          <Field label="Address" required>
            <textarea
              value={form.address}
              onChange={(e) => set("address")(e.target.value)}
              placeholder="House / Flat / Street"
              required
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 resize-none"
            />
          </Field>

          <Field label="Landmark">
            <Input value={form.landmark ?? ""} onChange={set("landmark")} placeholder="Near school, temple…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pincode" required>
              <Input value={form.pincode} onChange={set("pincode")} placeholder="6 digits" required />
            </Field>
            <Field label="City" required>
              <Input value={form.city} onChange={set("city")} placeholder="City" required />
            </Field>
          </div>

          <Field label="State" required>
            <Input value={form.state} onChange={set("state")} placeholder="State" required />
          </Field>
        </div>

        {/* Shipping options */}
        {form.pincode.replace(/\D/g, "").length === 6 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" /> Shipping Options
            </h2>

            {ratesLoading && (
              <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" /> Checking delivery options…
              </div>
            )}

            {ratesError && (
              <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl px-3 py-2.5 text-xs font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {ratesError}
              </div>
            )}

            {!ratesLoading && shippingRates.length > 0 && (
              <div className="space-y-2">
                {shippingRates.map((r) => (
                  <label
                    key={r.courier_company_id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors",
                      selectedShipping === r.courier_company_id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShipping === r.courier_company_id}
                        onChange={() => {
                          setSelectedShipping(r.courier_company_id);
                          setShippingCost(r.rate);
                        }}
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.courier_name}</p>
                        <p className="text-xs text-slate-500">
                          {r.estimated_delivery_days} days{r.etd ? ` · by ${r.etd}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-800">₹{r.rate}</span>
                  </label>
                ))}
              </div>
            )}

            {!ratesLoading && shippingRates.length === 0 && !ratesError && (
              <p className="text-xs text-slate-400 text-center py-2">No delivery options available for this pincode.</p>
            )}

            {shippingCost > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Shipping</span>
                <span className="text-sm font-bold text-slate-700">₹{shippingCost.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-3 text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "w-full py-4 rounded-2xl text-white font-bold text-sm transition-all",
            submitting ? "bg-primary/60" : "bg-primary active:scale-[0.98]"
          )}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Placing Order…
            </span>
          ) : (
            `Place Order · ₹${(items.reduce((s, i) => s + i.price * i.quantity, 0) + shippingCost).toLocaleString()}`
          )}
        </button>
      </form>
    </div>
  );
}
