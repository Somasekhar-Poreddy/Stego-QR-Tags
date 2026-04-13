import { useEffect, useState, useCallback } from "react";
import { ShoppingBag, Plus, Minus, Star, Package, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { AppHeader } from "@/app/components/AppHeader";
import { useCart } from "@/app/context/CartContext";
import { getActiveProducts, type Product } from "@/services/productService";
import { cn } from "@/lib/utils";

/* ─── Category tabs ─── */

const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: "all",     label: "All",      emoji: "🛍️" },
  { key: "pet",     label: "Pets",     emoji: "🐾" },
  { key: "vehicle", label: "Vehicles", emoji: "🚗" },
  { key: "medical", label: "Medical",  emoji: "🏥" },
  { key: "kids",    label: "Kids",     emoji: "👦" },
  { key: "other",   label: "Other",    emoji: "📦" },
];

/* ─── Badge colors ─── */

const BADGE_COLORS: Record<string, string> = {
  best_seller: "bg-amber-500 text-white",
  popular:     "bg-violet-500 text-white",
  new:         "bg-green-500 text-white",
};

const BADGE_LABELS: Record<string, string> = {
  best_seller: "Best Seller",
  popular:     "Popular",
  new:         "New",
};

/* ─── Category gradient fallbacks ─── */

const CATEGORY_GRAD: Record<string, string> = {
  pet:     "from-rose-400 to-pink-500",
  vehicle: "from-blue-400 to-cyan-500",
  kids:    "from-green-400 to-emerald-500",
  medical: "from-red-400 to-orange-500",
  other:   "from-slate-400 to-slate-500",
  all:     "from-violet-400 to-purple-500",
};

function categoryGrad(cat: string | null) {
  return CATEGORY_GRAD[cat ?? "all"] ?? "from-violet-400 to-purple-500";
}

/* ─── Skeleton card ─── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="h-32 bg-slate-100 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-slate-100 animate-pulse rounded w-3/4" />
        <div className="h-3 bg-slate-100 animate-pulse rounded w-1/2" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-4 bg-slate-100 animate-pulse rounded w-12" />
          <div className="h-7 bg-slate-100 animate-pulse rounded-xl w-14" />
        </div>
      </div>
    </div>
  );
}

/* ─── Product card ─── */

function ProductCard({ product }: { product: Product }) {
  const { addItem, removeItem, getQty } = useCart();
  const [, navigate] = useLocation();

  const qty = getQty(product.id, null);
  const topBadge = product.badges[0];
  const img = product.images[0];
  const displayPrice = product.discount_price ?? product.price;
  const hasDiscount = product.discount_price != null && product.discount_price < product.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product.id,
      productName: product.name,
      price: displayPrice,
      image: img ?? null,
      variantId: null,
      variantName: null,
    });
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(product.id, null);
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => navigate(`/app/shop/${product.id}`)}
    >
      {/* Image area */}
      <div className="relative h-32">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${categoryGrad(product.category)} flex items-center justify-center`}>
            <Package className="w-10 h-10 text-white/60" />
          </div>
        )}
        {topBadge && (
          <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${BADGE_COLORS[topBadge] ?? "bg-slate-700 text-white"}`}>
            {BADGE_LABELS[topBadge] ?? topBadge}
          </span>
        )}
        {/* Tap for details hint */}
        <div className="absolute bottom-2 right-2 bg-black/30 backdrop-blur-sm rounded-xl px-1.5 py-0.5 flex items-center gap-0.5">
          <ChevronRight className="w-2.5 h-2.5 text-white" />
          <span className="text-[8px] text-white font-semibold">Details</span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-xs font-bold text-slate-800 leading-tight mb-0.5 truncate">{product.name}</h3>
        {product.description && (
          <p className="text-[10px] text-slate-400 mb-2 leading-tight line-clamp-2">{product.description}</p>
        )}

        {/* Rating */}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-semibold text-slate-600">{product.rating.toFixed(1)}</span>
            {product.review_count > 0 && (
              <span className="text-[10px] text-slate-400">({product.review_count})</span>
            )}
          </div>
        )}

        {/* Price + add button */}
        <div className="flex items-center justify-between gap-1">
          <div>
            <p className="text-sm font-bold text-slate-900">₹{displayPrice.toLocaleString("en-IN")}</p>
            {hasDiscount && (
              <p className="text-[10px] text-slate-400 line-through">₹{product.price.toLocaleString("en-IN")}</p>
            )}
          </div>

          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition-transform shadow-sm shadow-primary/30"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-2 py-1">
              <button onClick={handleRemove} className="text-primary p-0.5">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-primary w-4 text-center">{qty}</span>
              <button onClick={handleAdd} className="text-primary p-0.5">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sticky cart bar ─── */

export function StickyCartBar() {
  const { totalItems, totalPrice } = useCart();
  const [, navigate] = useLocation();

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-40">
      <div className="bg-gradient-to-r from-primary to-violet-600 rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl shadow-primary/40">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-xl w-8 h-8 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-bold">
              {totalItems} item{totalItems > 1 ? "s" : ""}
            </p>
            <p className="text-white/80 text-[10px] font-semibold">
              ₹{totalPrice.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/app/checkout")}
          className="bg-white text-primary text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shadow-sm"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}

/* ─── Main ShopScreen ─── */

export function ShopScreen() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((cat: string) => {
    setLoading(true);
    setError(null);
    getActiveProducts(cat === "all" ? undefined : cat)
      .then((data) => { setProducts(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(activeCategory); }, [load, activeCategory]);

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="Shop" showNotification={false} />

      {/* Category filter */}
      <div className="bg-white border-b border-slate-100 px-3 py-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all flex items-center gap-1",
                activeCategory === c.key
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="px-4 pt-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-12 h-12 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">Could not load products</p>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={() => load(activeCategory)}
              className="text-xs font-semibold text-primary underline"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-12 h-12 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">No products yet</p>
            <p className="text-xs text-slate-400">Check back soon for new items</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      {/* Bottom padding to prevent content hiding behind cart bar */}
      <div className="h-4" />

      <StickyCartBar />
    </div>
  );
}
