import { useEffect, useRef, useState } from "react";
import { Star, Plus, Minus, ChevronLeft, Package, CheckCircle2, ChevronRight, ShoppingBag, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useCart } from "@/app/context/CartContext";
import { getProductById, getProductReviews, type ProductWithVariants, type Review } from "@/services/productService";
import { useDataFetch } from "@/hooks/useDataFetch";
import { cn } from "@/lib/utils";
import { StickyCartBar } from "@/app/screens/shop/ShopScreen";

/* ─── Helpers ─── */

function getTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m > 1 ? "s" : ""} ago`;
  return `${Math.floor(m / 12)} year${Math.floor(m / 12) > 1 ? "s" : ""} ago`;
}

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn("w-3 h-3", i < Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")}
        />
      ))}
    </div>
  );
}

/* ─── Image slider ─── */

function ImageSlider({ images, name, category }: { images: string[]; name: string; category: string | null }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="w-full h-56 bg-gradient-to-br from-primary/20 to-violet-200 flex items-center justify-center">
        <Package className="w-16 h-16 text-primary/40" />
      </div>
    );
  }

  const GRAD: Record<string, string> = {
    pet: "from-rose-400 to-pink-500",
    vehicle: "from-blue-400 to-cyan-500",
    kids: "from-green-400 to-emerald-500",
    medical: "from-red-400 to-orange-500",
    other: "from-slate-400 to-slate-500",
  };
  const fallbackGrad = GRAD[category ?? ""] ?? "from-violet-400 to-purple-500";

  return (
    <div className="relative w-full h-56 bg-slate-100 select-none">
      <img
        src={images[active]}
        alt={`${name} – image ${active + 1}`}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.style.display = "none";
          const parent = el.parentElement;
          if (parent) {
            parent.classList.add(`bg-gradient-to-br`, ...fallbackGrad.split(" "), "flex", "items-center", "justify-center");
          }
        }}
      />

      {/* Prev / Next arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            disabled={active === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-slate-700" />
          </button>
          <button
            onClick={() => setActive((a) => Math.min(images.length - 1, a + 1))}
            disabled={active === images.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn("rounded-full transition-all", i === active ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Reviews section ─── */

function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-start justify-between mb-1">
        <StarRow rating={review.rating} />
        <span className="text-[10px] text-slate-400">{getTimeAgo(review.created_at)}</span>
      </div>
      {review.comment && (
        <p className="text-xs text-slate-600 leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
}

/* ─── Main ─── */

export function ProductDetailScreen({ productId }: { productId: string }) {
  const [, navigate] = useLocation();
  const { addItem, removeItem, getQty } = useCart();

  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // prevProduct ref ensures a transient fetch error never clears an already-loaded product
  const prevProduct = useRef<ProductWithVariants | null>(null);

  // Product fetch — manual because getProductById returns a single object (not T[])
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProductById(productId)
      .then((prod) => {
        if (cancelled) return;
        if (!prod) { setError("Product not found"); setLoading(false); return; }
        prevProduct.current = prod;
        setProduct(prod);
        if (prod.variants.length > 0) setSelectedVariantId(prod.variants[0].id);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load product";
        // Preserve the previously loaded product — don't blank the screen on error
        if (prevProduct.current) setProduct(prevProduct.current);
        setError(msg);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  // Reviews fetch — useDataFetch handles auth guard, prev-state preservation, and cleanup
  const { data: reviews } = useDataFetch<Review>(
    () => getProductReviews(productId),
    [productId],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <div className="w-8 h-8 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="w-full h-56 bg-slate-100 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-5 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
          <div className="h-6 bg-slate-100 rounded animate-pulse w-24" />
        </div>
      </div>
    );
  }

  // No product at all (not found, or first-ever load failed with nothing cached)
  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button onClick={() => navigate("/app/shop")} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Product</h1>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
          <AlertCircle className="w-12 h-12 text-rose-300" />
          <p className="text-sm font-semibold text-slate-600 text-center">{error ?? "Product not found"}</p>
          <button onClick={() => navigate("/app/shop")} className="text-sm font-semibold text-primary underline">
            Back to shop
          </button>
        </div>
      </div>
    );
  }

  /* Selected variant */
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? null;
  const effectivePrice = selectedVariant?.price ?? product.discount_price ?? product.price;
  const hasDiscount = !selectedVariant && product.discount_price != null && product.discount_price < product.price;
  const qty = getQty(product.id, selectedVariantId);
  const inStock = selectedVariant ? selectedVariant.stock > 0 : product.stock_quantity > 0;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name + (selectedVariant ? ` – ${selectedVariant.variant_name}` : ""),
      price: effectivePrice,
      image: product.images[0] ?? null,
      variantId: selectedVariantId,
      variantName: selectedVariant?.variant_name ?? null,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  const specEntries = Object.entries(product.specifications ?? {});

  return (
    <div className="min-h-screen bg-slate-50 pb-36">
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={() => navigate("/app/shop")} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-base font-bold text-slate-900 truncate flex-1">{product.name}</h1>

      {/* Non-blocking inline error banner — product data is still shown from cache */}
      {error && (
        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <p className="text-[10px] text-rose-600 leading-tight">Refresh failed</p>
        </div>
      )}
        {qty > 0 && (
          <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
            {qty}
          </div>
        )}
      </div>

      {/* Image slider */}
      <ImageSlider images={product.images} name={product.name} category={product.category} />

      {/* Main info card */}
      <div className="bg-white mx-4 -mt-4 rounded-2xl shadow-sm border border-slate-100 p-4 relative z-10">
        {/* Badges */}
        {product.badges.length > 0 && (
          <div className="flex gap-1.5 mb-2">
            {product.badges.map((b) => (
              <span
                key={b}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  b === "best_seller" ? "bg-amber-100 text-amber-700" :
                  b === "popular" ? "bg-violet-100 text-violet-700" :
                  "bg-green-100 text-green-700"
                )}
              >
                {b === "best_seller" ? "Best Seller" : b === "popular" ? "Popular" : "New"}
              </span>
            ))}
          </div>
        )}

        <h2 className="text-lg font-bold text-slate-900 leading-tight mb-1">{product.name}</h2>

        {/* Rating row */}
        {product.rating > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <StarRow rating={product.rating} />
            <span className="text-xs font-bold text-slate-700">{product.rating.toFixed(1)}</span>
            {product.review_count > 0 && (
              <span className="text-xs text-slate-400">({product.review_count} review{product.review_count !== 1 ? "s" : ""})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-extrabold text-slate-900">₹{effectivePrice.toLocaleString("en-IN")}</span>
          {hasDiscount && (
            <>
              <span className="text-sm text-slate-400 line-through">₹{product.price.toLocaleString("en-IN")}</span>
              <span className="text-xs font-bold text-green-600">
                {Math.round(((product.price - product.discount_price!) / product.price) * 100)}% off
              </span>
            </>
          )}
        </div>

        {/* In-stock status */}
        {!inStock && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold mb-2">
            <AlertCircle className="w-3.5 h-3.5" /> Out of stock
          </div>
        )}

        {/* Description */}
        {product.description && (
          product.description.startsWith("<") ? (
            <div
              className="text-sm text-slate-600 leading-relaxed mb-3 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-h2:text-base prose-h2:font-bold prose-h2:text-slate-800 prose-h2:mb-1"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{product.description}</p>
          )
        )}

        {/* Variant selector */}
        {product.variants.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Options</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  disabled={v.stock === 0}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    v.stock === 0
                      ? "border-slate-200 text-slate-300 cursor-not-allowed"
                      : selectedVariantId === v.id
                        ? "bg-primary text-white border-primary shadow-sm shadow-primary/30"
                        : "border-slate-200 text-slate-700 hover:border-primary hover:text-primary"
                  )}
                >
                  {v.variant_name}
                  {v.price !== product.price && (
                    <span className="ml-1 opacity-70">· ₹{v.price.toLocaleString("en-IN")}</span>
                  )}
                  {v.stock === 0 && <span className="ml-1 text-[9px]">(OOS)</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add to cart row */}
        <div className="flex items-center gap-3">
          {qty > 0 ? (
            <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2 flex-1 justify-center">
              <button onClick={() => removeItem(product.id, selectedVariantId)} className="text-primary">
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-primary w-6 text-center">{qty}</span>
              <button onClick={() => addItem({
                productId: product.id,
                productName: product.name + (selectedVariant ? ` – ${selectedVariant.variant_name}` : ""),
                price: effectivePrice,
                image: product.images[0] ?? null,
                variantId: selectedVariantId,
                variantName: selectedVariant?.variant_name ?? null,
              })} className="text-primary">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                inStock
                  ? "bg-primary text-white shadow-lg shadow-primary/30 active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              {addedFeedback ? (
                <><CheckCircle2 className="w-4 h-4" /> Added!</>
              ) : (
                <><ShoppingBag className="w-4 h-4" /> Add to Cart</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Features */}
      {product.features.length > 0 && (
        <div className="bg-white mx-4 mt-3 rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Features</h3>
          <div className="grid grid-cols-1 gap-2">
            {product.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 leading-relaxed">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specifications */}
      {specEntries.length > 0 && (
        <div className="bg-white mx-4 mt-3 rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Specifications</h3>
          <div className="divide-y divide-slate-50">
            {specEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 gap-3">
                <span className="text-xs text-slate-400 font-medium">{k}</span>
                <span className="text-xs text-slate-700 font-semibold text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <div className="bg-white mx-4 mt-3 rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Reviews
            <span className="ml-2 text-xs font-normal text-slate-400">({reviews.length})</span>
          </h3>
          {reviews.slice(0, 5).map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
          {reviews.length > 5 && (
            <p className="text-xs text-slate-400 text-center mt-2">{reviews.length - 5} more review{reviews.length - 5 > 1 ? "s" : ""}</p>
          )}
        </div>
      )}

      <StickyCartBar />
    </div>
  );
}
