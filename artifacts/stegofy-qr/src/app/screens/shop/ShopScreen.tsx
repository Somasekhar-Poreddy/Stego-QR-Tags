import { useState } from "react";
import { ShoppingBag, Plus, Minus, Check, Filter, Star } from "lucide-react";
import { AppHeader } from "@/app/components/AppHeader";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Pets", "Vehicles", "Kids", "Medical", "Bags"];

const PRODUCTS = [
  { id: 1, name: "Pet ID Tag", category: "Pets", emoji: "🐾", price: 299, originalPrice: 399, rating: 4.8, reviews: 234, tag: "Best Seller", color: "from-rose-400 to-pink-500", desc: "Waterproof NFC + QR combo tag for pets" },
  { id: 2, name: "Car Dashboard Tag", category: "Vehicles", emoji: "🚗", price: 399, originalPrice: 549, rating: 4.7, reviews: 189, tag: "Popular", color: "from-blue-400 to-cyan-500", desc: "Sticky tag for dashboards & windshields" },
  { id: 3, name: "Child Safety Band", category: "Kids", emoji: "👦", price: 499, originalPrice: 699, rating: 4.9, reviews: 312, tag: "Top Rated", color: "from-green-400 to-emerald-500", desc: "Soft silicone wristband with QR & NFC" },
  { id: 4, name: "Medical Alert Card", category: "Medical", emoji: "🏥", price: 249, originalPrice: 349, rating: 4.6, reviews: 156, tag: "New", color: "from-red-400 to-orange-500", desc: "Wallet-size card for emergency info" },
  { id: 5, name: "Luggage Tag", category: "Bags", emoji: "🧳", price: 199, originalPrice: 299, rating: 4.5, reviews: 98, tag: "Sale", color: "from-violet-400 to-purple-500", desc: "Durable tag for bags & luggage" },
  { id: 6, name: "NFC Smart Card", category: "All", emoji: "💳", price: 599, originalPrice: 799, rating: 4.8, reviews: 421, tag: "Premium", color: "from-amber-400 to-orange-500", desc: "Tap-to-connect slim card with 5 profiles" },
];

export function ShopScreen() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});

  const filtered = activeCategory === "All"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === activeCategory);

  const addToCart = (id: number) => setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const removeFromCart = (id: number) => setCart((prev) => {
    const next = { ...prev };
    if (next[id] > 1) next[id]--;
    else delete next[id];
    return next;
  });

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="Shop" showNotification={false} />

      {/* Category filter */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all",
                activeCategory === c
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-4 grid grid-cols-2 gap-3">
        {filtered.map((product) => {
          const qty = cart[product.id] || 0;
          return (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Product image */}
              <div className={cn("bg-gradient-to-br h-28 flex flex-col items-center justify-center relative", product.color)}>
                <span className="text-4xl">{product.emoji}</span>
                <span className="absolute top-2 left-2 bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {product.tag}
                </span>
              </div>

              <div className="p-3">
                <h3 className="text-xs font-bold text-slate-800 leading-tight mb-0.5">{product.name}</h3>
                <p className="text-[10px] text-slate-400 mb-2 leading-tight">{product.desc}</p>

                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-semibold text-slate-600">{product.rating}</span>
                  <span className="text-[10px] text-slate-400">({product.reviews})</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">₹{product.price}</p>
                    <p className="text-[10px] text-slate-400 line-through">₹{product.originalPrice}</p>
                  </div>

                  {qty === 0 ? (
                    <button
                      onClick={() => addToCart(product.id)}
                      className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition-transform shadow-sm shadow-primary/30"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-2 py-1">
                      <button onClick={() => removeFromCart(product.id)} className="text-primary">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-primary w-4 text-center">{qty}</span>
                      <button onClick={() => addToCart(product.id)} className="text-primary">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto">
          <div className="bg-gradient-to-r from-primary to-violet-600 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xl shadow-primary/40">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl w-8 h-8 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-xs font-semibold">{totalItems} item{totalItems > 1 ? "s" : ""} in cart</p>
                <p className="text-white/70 text-[10px]">₹{PRODUCTS.reduce((t, p) => t + (cart[p.id] || 0) * p.price, 0)}</p>
              </div>
            </div>
            <button className="bg-white text-primary text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
