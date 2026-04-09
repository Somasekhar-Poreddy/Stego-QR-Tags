import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Package, Search } from "lucide-react";
import { getProducts, createProduct, updateProduct, deleteProduct, type Product } from "@/services/adminService";

function Modal({ product, onClose, onSave }: { product: Partial<Product> | null; onClose: () => void; onSave: (p: Partial<Product>) => void }) {
  const isNew = !product?.id;
  const [form, setForm] = useState<Partial<Product>>(product || {});
  const set = (k: keyof Product, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{isNew ? "Add Product" : "Edit Product"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
          {(["name", "description", "image_url", "category"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 mb-1 block capitalize">{k.replace(/_/g, " ")}</label>
              <input value={(form[k] as string) || ""} onChange={(e) => set(k, e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Price (₹)</label>
              <input type="number" value={form.price ?? ""} onChange={(e) => set("price", parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Discount (₹)</label>
              <input type="number" value={form.discount_price ?? ""} onChange={(e) => set("discount_price", parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">Save</button>
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

  const reload = () => getProducts().then((d) => { setProducts(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(products.filter((p) =>
      !q || [p.name, p.category, p.description].some((v) => v?.toLowerCase().includes(q))
    ));
  }, [search, products]);

  const handleSave = async (form: Partial<Product>) => {
    if (form.id) await updateProduct(form.id, form);
    else await createProduct(form);
    setEditing(false);
    reload();
  };

  const handleDelete = async (id: string) => { await deleteProduct(id); reload(); };

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
                <th className="px-4 py-3 text-left hidden xl:table-cell">Discount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm">No products yet</p>
                  </td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        {p.description && <p className="text-[11px] text-slate-400 truncate">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.category || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 hidden lg:table-cell">{p.price != null ? `₹${p.price}` : "—"}</td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {p.discount_price != null ? (
                      <span className="text-primary font-semibold">₹{p.discount_price}</span>
                    ) : "—"}
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
