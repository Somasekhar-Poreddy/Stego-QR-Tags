import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  setLocalCart, clearLocalCart,
  mergeLocalCartToDB, clearDBCart,
} from "@/services/cartService";

/* ─── Types ─── */

export interface CartLineItem {
  productId: string;
  productName: string;
  price: number;
  image: string | null;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
}

interface CartContextValue {
  items: CartLineItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<CartLineItem, "quantity">, qty?: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQty: (productId: string, variantId: string | null, qty: number) => void;
  getQty: (productId: string, variantId: string | null) => number;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const FULL_CART_KEY = "stegofy_cart_full";

function loadFromStorage(): CartLineItem[] {
  try {
    const raw = localStorage.getItem(FULL_CART_KEY);
    return raw ? (JSON.parse(raw) as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartLineItem[]): void {
  try {
    localStorage.setItem(FULL_CART_KEY, JSON.stringify(items));
    setLocalCart(
      items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        quantity: i.quantity,
      })),
    );
  } catch { /* ignore */ }
}

function sameItem(a: CartLineItem, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLineItem[]>(() => loadFromStorage());
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        userIdRef.current = data.session.user.id;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_IN" && uid && userIdRef.current !== uid) {
        userIdRef.current = uid;
        try { await mergeLocalCartToDB(uid); } catch { /* fail silently */ }
      }
      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const addItem = useCallback((item: Omit<CartLineItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => sameItem(i, item.productId, item.variantId));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId: string | null) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => sameItem(i, productId, variantId));
      if (idx < 0) return prev;
      const next = [...prev];
      if (next[idx].quantity > 1) {
        next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
      } else {
        next.splice(idx, 1);
      }
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, variantId: string | null, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => !sameItem(i, productId, variantId));
      return prev.map((i) => sameItem(i, productId, variantId) ? { ...i, quantity: qty } : i);
    });
  }, []);

  const getQty = useCallback((productId: string, variantId: string | null) => {
    return items.find((i) => sameItem(i, productId, variantId))?.quantity ?? 0;
  }, [items]);

  const clearCart = useCallback(() => {
    setItems([]);
    clearLocalCart();
    try { localStorage.removeItem(FULL_CART_KEY); } catch { /* ignore */ }
    if (userIdRef.current) {
      clearDBCart(userIdRef.current).catch(() => { /* fail silently */ });
    }
  }, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQty, getQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
