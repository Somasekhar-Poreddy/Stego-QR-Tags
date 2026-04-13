import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Package, Search, ToggleLeft, ToggleRight } from "lucide-react";
import {
  adminGetAllProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  type Product,
  type ProductInput,
} from "@/services/productService";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Modal({
  product,
  onClose,
  onSave,
}: {
  product: Partial<Product> | null;
  onClose: () => void;
  onSave: (p: Partial<ProductInput & { id?: string }>) => void;
}) {
  const isNew = !product?.id;
  const [form, setForm] = useState<Partial<ProductInput & { id?: string }>>({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "",
    images: product?.images ?? [],
    price: product?.price ?? 0,
    discount_price: product?.discount_price ?? undefined,
    badges: product?.badges ?? [],
    features: product?.features ?? [],
    specifications: product?.specifications ?? {},
    stock_quantity: product?.stock_quantity ?? 0,
    is_active: product?.is_active ?? true,
    rating: product?.rating ?? 0,
    review_count: product?.review_count ?? 0,
    id: product?.id,
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const imageUrl = form.images?.[0] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{isNew ? "Add Product" : "Edit Product"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto max-h-[72vh]">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Name</label>
            <input
              value={form.name ?? ""}
              onChange={(e) => {
                set("name", e.target.value);
                if (isNew) set("slug", slugify(e.target.value));
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Slug</label>
            <input value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Description</label>
            <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
              <select value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white">
                <option value="">Select…</option>
                {["vehicle", "pet", "medical", "kids", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Stock Qty</label>
              <input type="number" min={0} value={form.stock_quantity ?? 0} onChange={(e) => set("stock_quantity", parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Image URL (first image)</label>
            <input value={imageUrl} onChange={(e) => set("images", e.target.value ? [e.target.value] : [])} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Price (₹)</label>
              <input type="number" min={0} value={form.price ?? 0} onChange={(e) => set("price", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Discount (₹)</label>
              <input type="number" min={0} value={form.discount_price ?? ""} onChange={(e) => set("discount_price", e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Rating (0-5)</label>
              <input type="number" min={0} max={5} step={0.1} value={form.rating ?? 0} onChange={(e) => set("rating", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Review Count</label>
              <input type="number" min={0} value={form.review_count ?? 0} onChange={(e) => set("review_count", parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Badges (comma-separated)</label>
            <input
              value={(form.badges ?? []).join(", ")}
              onChange={(e) => set("badges", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="best_seller, popular, new"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Features (one per line)</label>
            <textarea
              value={(form.features ?? []).join("\n")}
              onChange={(e) => set("features", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary resize-none"
              placeholder="Waterproof&#10;QR code on front"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Active</span>
            <button type="button" onClick={() => set("is_active", !form.is_active)} className="text-primary">
              {form.is_active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
            </button>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90">Save</button>
        </div>
      </div>
    </div>
  );
}

export function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null | false>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    adminGetAllProducts()
      .then((d) => { setProducts(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(products.filter((p) =>
      !q || [p.name, p.category, p.description].some((v) => v?.toLowerCase().includes(q))
    ));
  }, [search, products]);

  const handleSave = async (form: Partial<ProductInput & { id?: string }>) => {
    const { id, ...rest } = form;
    if (id) {
      await adminUpdateProduct(id, rest as Partial<ProductInput>);
    } else {
      await adminCreateProduct(rest as ProductInput);
    }
    setEditing(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await adminDeleteProduct(id);
    reload();
  };

  const handleToggle = async (p: Product) => {
    await adminUpdateProduct(p.id, { is_active: !p.is_active });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} products</span>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Price</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">Stock</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm">No products yet</p>
                  </td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{p.badges?.join(", ") || p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell capitalize">{p.category || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-semibold text-slate-800">₹{p.price}</span>
                    {p.discount_price != null && (
                      <span className="text-xs text-primary ml-1">/ ₹{p.discount_price}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden xl:table-cell">{p.stock_quantity}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button onClick={() => handleToggle(p)} className={`text-lg ${p.is_active ? "text-primary" : "text-slate-300"}`}>
                      {p.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== false && <Modal product={editing} onClose={() => setEditing(false)} onSave={handleSave} />}
    </div>
  );
}
