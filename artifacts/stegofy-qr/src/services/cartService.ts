import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
}

export interface LocalCartItem {
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

const LOCAL_CART_KEY = "stegofy_cart";

/* ─── Local storage helpers (guest cart) ─── */

export function getLocalCart(): LocalCartItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    return raw ? (JSON.parse(raw) as LocalCartItem[]) : [];
  } catch {
    return [];
  }
}

export function setLocalCart(items: LocalCartItem[]): void {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
}

export function clearLocalCart(): void {
  localStorage.removeItem(LOCAL_CART_KEY);
}

export function addToLocalCart(
  productId: string,
  variantId: string | null,
  qty = 1,
): LocalCartItem[] {
  const cart = getLocalCart();
  const idx = cart.findIndex(
    (i) => i.product_id === productId && i.variant_id === variantId,
  );
  if (idx >= 0) {
    cart[idx].quantity += qty;
  } else {
    cart.push({ product_id: productId, variant_id: variantId, quantity: qty });
  }
  setLocalCart(cart);
  return cart;
}

export function removeFromLocalCart(
  productId: string,
  variantId: string | null,
): LocalCartItem[] {
  const cart = getLocalCart().filter(
    (i) => !(i.product_id === productId && i.variant_id === variantId),
  );
  setLocalCart(cart);
  return cart;
}

export function updateLocalCartQty(
  productId: string,
  variantId: string | null,
  qty: number,
): LocalCartItem[] {
  const cart = getLocalCart().map((i) =>
    i.product_id === productId && i.variant_id === variantId
      ? { ...i, quantity: qty }
      : i,
  );
  setLocalCart(cart);
  return cart;
}

/* ─── Supabase cart helpers (authenticated users) ─── */

export async function getDBCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CartItem[];
}

export async function addToDBCart(
  userId: string,
  productId: string,
  variantId: string | null,
  qty = 1,
): Promise<{ error?: string }> {
  let lookupQ = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId);

  // Use .eq() for a real UUID, .is() only for the NULL case
  if (variantId !== null) {
    lookupQ = lookupQ.eq("variant_id", variantId);
  } else {
    lookupQ = lookupQ.is("variant_id", null);
  }

  const { data: existing } = await lookupQ.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: (existing as { quantity: number }).quantity + qty })
      .eq("id", (existing as { id: string }).id);
    return { error: error?.message };
  }

  const { error } = await supabase.from("cart_items").insert({
    user_id: userId,
    product_id: productId,
    variant_id: variantId,
    quantity: qty,
  });
  return { error: error?.message };
}

export async function updateDBCartQty(
  itemId: string,
  qty: number,
): Promise<{ error?: string }> {
  if (qty <= 0) {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    return { error: error?.message };
  }
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: qty })
    .eq("id", itemId);
  return { error: error?.message };
}

export async function removeFromDBCart(itemId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  return { error: error?.message };
}

export async function clearDBCart(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  return { error: error?.message };
}

/**
 * Merge the guest local-storage cart into the DB cart for a newly logged-in user.
 * Local items that conflict (same product+variant) are summed.
 */
export async function mergeLocalCartToDB(userId: string): Promise<void> {
  const local = getLocalCart();
  if (local.length === 0) return;

  for (const item of local) {
    await addToDBCart(userId, item.product_id, item.variant_id, item.quantity);
  }
  clearLocalCart();
}
