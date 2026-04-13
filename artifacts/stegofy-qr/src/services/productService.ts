import { supabase } from "@/lib/supabase";
import { ensureFreshSession } from "@/lib/adminAuth";

/* ─── Types ─── */

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  images: string[];
  price: number;
  discount_price: number | null;
  rating: number;
  review_count: number;
  badges: string[];
  features: string[];
  specifications: Record<string, string>;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price: number;
  stock: number;
  created_at: string;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

/* ─── Simple in-memory cache (5-minute TTL) ─── */

const _productListCache = new Map<string, { data: Product[]; ts: number }>();
const _productDetailCache = new Map<string, { data: ProductWithVariants; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function invalidateProductCache(): void {
  _productListCache.clear();
  _productDetailCache.clear();
}

/* ─── Public read functions ─── */

export async function getActiveProducts(category?: string): Promise<Product[]> {
  const key = category && category !== "all" ? category : "all";
  const cached = _productListCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  let q = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    q = q.eq("category", category);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const result = ((data ?? []) as unknown[]).map(normalizeProduct);
  _productListCache.set(key, { data: result, ts: Date.now() });
  return result;
}

export async function getProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  const variants = await getProductVariants((data as { id: string }).id);
  return { ...normalizeProduct(data), variants };
}

export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const cached = _productDetailCache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const variants = await getProductVariants(id);
  const result = { ...normalizeProduct(data), variants };
  _productDetailCache.set(id, { data: result, ts: Date.now() });
  return result;
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProductVariant[];
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Review[];
}

/* ─── Admin CRUD ─── */

export type ProductInput = Omit<Product, "id" | "created_at">;

export async function adminGetAllProducts(): Promise<Product[]> {
  await ensureFreshSession();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(normalizeProduct);
}

export async function adminCreateProduct(
  input: ProductInput,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("products")
    .insert(serializeProduct(input))
    .select("id")
    .single();
  if (error) return { error: error.message };
  invalidateProductCache();
  return { id: (data as { id: string }).id };
}

export async function adminUpdateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("products")
    .update(serializeProduct(input as ProductInput))
    .eq("id", id);
  if (!error) invalidateProductCache();
  return { error: error?.message };
}

export async function adminDeleteProduct(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (!error) invalidateProductCache();
  return { error: error?.message };
}

export async function adminUpsertVariants(
  productId: string,
  variants: Omit<ProductVariant, "id" | "product_id" | "created_at">[],
): Promise<{ error?: string }> {
  const { error: delErr } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId);
  if (delErr) return { error: delErr.message };

  if (variants.length === 0) return {};

  const rows = variants.map((v) => ({ ...v, product_id: productId }));
  const { error } = await supabase.from("product_variants").insert(rows);
  return { error: error?.message };
}

/* ─── Helpers ─── */

function normalizeProduct(raw: unknown): Product {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: (r.description as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    images: (r.images as string[] | null) ?? [],
    price: Number(r.price ?? 0),
    discount_price: r.discount_price != null ? Number(r.discount_price) : null,
    rating: Number(r.rating ?? 0),
    review_count: Number(r.review_count ?? 0),
    badges: (r.badges as string[] | null) ?? [],
    features: (r.features as string[] | null) ?? [],
    specifications: (r.specifications as Record<string, string> | null) ?? {},
    stock_quantity: Number(r.stock_quantity ?? 0),
    is_active: Boolean(r.is_active ?? true),
    created_at: r.created_at as string,
  };
}

function serializeProduct(input: Partial<ProductInput>): Record<string, unknown> {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.images !== undefined && { images: input.images }),
    ...(input.price !== undefined && { price: input.price }),
    ...(input.discount_price !== undefined && { discount_price: input.discount_price }),
    ...(input.rating !== undefined && { rating: input.rating }),
    ...(input.review_count !== undefined && { review_count: input.review_count }),
    ...(input.badges !== undefined && { badges: input.badges }),
    ...(input.features !== undefined && { features: input.features }),
    ...(input.specifications !== undefined && { specifications: input.specifications }),
    ...(input.stock_quantity !== undefined && { stock_quantity: input.stock_quantity }),
    ...(input.is_active !== undefined && { is_active: input.is_active }),
  };
}
