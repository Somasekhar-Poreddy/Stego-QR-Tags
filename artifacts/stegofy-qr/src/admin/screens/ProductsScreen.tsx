import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Package } from "lucide-react";
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
              <label className="text-xs font-semibold text-slate-500 mb-1 block capitalize">{k.replace("_", " ")}</label>
              <input value={(form[k] as string) || ""} onChange={(e) => set(k, e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Price (₹)</label>
              <input type="number" value={form.price ?? ""} onChange={(e) => set("price", parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Discount Price</label>
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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null | false>(false);

  const reload = () => getProducts().then((d) => { setProducts(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const handleSave = async (form: Partial<Product>) => {
    if (form.id) await updateProduct(form.id, form);
    else await createProduct(form);
    setEditing(false);
    reload();
  };

  const handleDelete = async (id: string) => { await deleteProduct(id); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{products.length} products</p>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p>No products yet</p>
            </div>
          ) : products.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
              <div className="h-40 bg-slate-50 flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-10 h-10 text-slate-200" />
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(p)} className="p-1.5 bg-white rounded-lg shadow text-blue-500 hover:text-blue-700"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 bg-white rounded-lg shadow text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="p-4">
                <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
                {p.category && <p className="text-[11px] text-slate-400 mb-2">{p.category}</p>}
                <div className="flex items-center gap-2">
                  {p.discount_price ? (
                    <>
                      <span className="text-primary font-extrabold">₹{p.discount_price}</span>
                      <span className="text-slate-400 line-through text-xs">₹{p.price}</span>
                    </>
                  ) : (
                    <span className="text-primary font-extrabold">{p.price != null ? `₹${p.price}` : "—"}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== false && (
        <Modal product={editing || null} onClose={() => setEditing(false)} onSave={handleSave} />
      )}
    </div>
  );
}
