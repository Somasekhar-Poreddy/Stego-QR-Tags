import { createContext, useContext, useState, useCallback } from "react";

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

function sameItem(a: CartLineItem, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLineItem[]>([]);

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

  const clearCart = useCallback(() => setItems([]), []);

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
