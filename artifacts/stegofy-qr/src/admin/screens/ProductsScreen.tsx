import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, X, Package, Search,
  ToggleLeft, ToggleRight, Star, Tag, Image,
  List, Table2, ChevronDown, ChevronUp, AlertCircle,
  Upload, Link as LinkIcon, Bold, Italic, Underline as UnderlineIcon,
  ListOrdered, Heading2,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import {
  adminGetAllProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUpsertVariants,
  getProductVariants,
  type Product,
  type ProductInput,
  type ProductVariant,
} from "@/services/productService";
import { supabase } from "@/lib/supabase";

/* ─── constants ─── */

const CATEGORIES = ["vehicle", "pet", "medical", "kids", "other"] as const;
type Category = typeof CATEGORIES[number];

const BADGES: { key: string; label: string; color: string }[] = [
  { key: "best_seller", label: "Best Seller", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "popular",     label: "Popular",     color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "new",         label: "New",         color: "bg-green-100 text-green-700 border-green-200" },
];

const BADGE_COLORS: Record<string, string> = {
  best_seller: "bg-amber-100 text-amber-700",
  popular:     "bg-violet-100 text-violet-700",
  new:         "bg-green-100 text-green-700",
};

/* ─── helpers ─── */

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatPrice(p: number | null | undefined) {
  if (p == null) return "—";
  return `₹${Number(p).toLocaleString("en-IN")}`;
}

/* ─── types ─── */

type FormVariant = { id?: string; variant_name: string; price: number | string; stock: number | string };
type FormData = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  images: string[];
  price: number | string;
  discount_price: number | string;
  rating: number | string;
  review_count: number | string;
  badges: string[];
  features: string[];
  specifications: { key: string; value: string }[];
  stock_quantity: number | string;
  is_active: boolean;
  variants: FormVariant[];
};

function emptyForm(): FormData {
  return {
    name: "", slug: "", description: "", category: "",
    images: [""], price: "", discount_price: "",
    rating: 0, review_count: 0,
    badges: [], features: [""],
    specifications: [{ key: "", value: "" }],
    stock_quantity: 0, is_active: true,
    variants: [],
  };
}

function productToForm(p: Product, variants: ProductVariant[]): FormData {
  return {
    id: p.id,
    name: p.name, slug: p.slug,
    description: p.description ?? "",
    category: p.category ?? "",
    images: p.images.length ? p.images : [""],
    price: p.price, discount_price: p.discount_price ?? "",
    rating: p.rating, review_count: p.review_count,
    badges: p.badges ?? [],
    features: p.features.length ? p.features : [""],
    specifications: Object.entries(p.specifications ?? {}).length
      ? Object.entries(p.specifications).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: "", value: "" }],
    stock_quantity: p.stock_quantity,
    is_active: p.is_active,
    variants: variants.map((v) => ({
      id: v.id, variant_name: v.variant_name,
      price: v.price, stock: v.stock,
    })),
  };
}

function isEmptyHtml(html: string): boolean {
  return !html.trim() || html.replace(/<[^>]*>/g, "").trim() === "";
}

function formToInput(f: FormData): ProductInput {
  const specs: Record<string, string> = {};
  f.specifications.forEach(({ key, value }) => {
    if (key.trim()) specs[key.trim()] = value.trim();
  });
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    description: isEmptyHtml(f.description) ? null : f.description.trim(),
    category: (f.category as Category) || null,
    images: f.images.filter((u) => u.trim()),
    price: Number(f.price) || 0,
    discount_price: f.discount_price !== "" ? Number(f.discount_price) : null,
    rating: Number(f.rating) || 0,
    review_count: Number(f.review_count) || 0,
    badges: f.badges,
    features: f.features.filter((ft) => ft.trim()),
    specifications: specs,
    stock_quantity: Number(f.stock_quantity) || 0,
    is_active: f.is_active,
  };
}

/* ─── Sub-components ─── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{children}</p>;
}

function Input({
  value, onChange, placeholder, type = "text", step, min, max,
}: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; step?: string; min?: number; max?: number;
}) {
  return (
    <input
      type={type} step={step} min={min} max={max}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors bg-white placeholder:text-slate-400"
    />
  );
}

/*
  REQUIRES: A public Supabase Storage bucket named "product-images".
  Create it in: Supabase Dashboard → Storage → New bucket → name: product-images → toggle Public ON.
*/

/* Image upload + URL section */
function ImagesSection({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [dragging, setDragging] = useState(false);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setUploadError(null);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) { setUploadError(error.message); continue; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      if (data?.publicUrl) newUrls.push(data.publicUrl);
    }
    if (newUrls.length) onChange([...images.filter((u) => u.trim()), ...newUrls]);
    setUploading(false);
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange([...images.filter((u) => u.trim()), trimmed]);
    setUrlInput("");
  };

  const removeImage = (i: number) => onChange(images.filter((_, j) => j !== i));

  const validImages = images.filter((u) => u.trim());

  return (
    <div className="space-y-4">
      <FieldLabel>Product Images</FieldLabel>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
        />
        {uploading ? (
          <>
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-semibold">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-primary/60" />
            <p className="text-xs font-semibold text-slate-600">Click or drag images here to upload</p>
            <p className="text-[10px] text-slate-400">PNG, JPG, WebP supported</p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadError}
          {uploadError.includes("bucket") || uploadError.includes("not found") ? (
            <span className="font-semibold"> — Create a public bucket named &quot;product-images&quot; in Supabase Storage.</span>
          ) : null}
        </p>
      )}

      {/* URL input */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Or add by URL</p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
              placeholder="https://example.com/image.jpg"
              className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Thumbnail grid */}
      {validImages.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
            Images ({validImages.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {validImages.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                <img
                  src={url}
                  alt={`Product image ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = "none";
                    const parent = el.parentElement;
                    if (parent) parent.classList.add("flex", "items-center", "justify-center");
                  }}
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-md">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Rich text editor */
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, UnderlineExt],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-[120px] px-3 py-2.5 text-sm text-slate-800 outline-none leading-relaxed prose prose-sm max-w-none",
      },
    },
  });

  if (!editor) return null;

  const ToolBtn = ({
    active, onClick, children,
  }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 flex-wrap">
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/* Badges multi-select */
function BadgesSection({ selected, onChange }: { selected: string[]; onChange: (b: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  return (
    <div>
      <FieldLabel>Badges</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {BADGES.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => toggle(b.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selected.includes(b.key)
                ? b.color + " border-transparent shadow-sm"
                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Features list */
function FeaturesSection({ features, onChange }: { features: string[]; onChange: (f: string[]) => void }) {
  return (
    <div>
      <FieldLabel>Features</FieldLabel>
      <div className="space-y-2">
        {features.map((ft, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-0.5" />
            <Input
              value={ft}
              onChange={(v) => { const a = [...features]; a[i] = v; onChange(a); }}
              placeholder={`Feature ${i + 1}`}
            />
            {features.length > 1 && (
              <button type="button" onClick={() => onChange(features.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => onChange([...features, ""])} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80">
          <Plus className="w-3.5 h-3.5" /> Add feature
        </button>
      </div>
    </div>
  );
}

/* Specifications key-value */
function SpecsSection({ specs, onChange }: { specs: { key: string; value: string }[]; onChange: (s: { key: string; value: string }[]) => void }) {
  return (
    <div>
      <FieldLabel>Specifications</FieldLabel>
      <div className="space-y-2">
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={s.key}
              onChange={(e) => { const a = [...specs]; a[i] = { ...a[i], key: e.target.value }; onChange(a); }}
              placeholder="Key (e.g. Material)"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white"
            />
            <span className="text-slate-300 text-sm">:</span>
            <input
              value={s.value}
              onChange={(e) => { const a = [...specs]; a[i] = { ...a[i], value: e.target.value }; onChange(a); }}
              placeholder="Value"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white"
            />
            {specs.length > 1 && (
              <button type="button" onClick={() => onChange(specs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => onChange([...specs, { key: "", value: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80">
          <Plus className="w-3.5 h-3.5" /> Add specification
        </button>
      </div>
    </div>
  );
}

/* Variants table */
function VariantsSection({ variants, onChange }: { variants: FormVariant[]; onChange: (v: FormVariant[]) => void }) {
  const addRow = () => onChange([...variants, { variant_name: "", price: "", stock: 0 }]);
  const updateRow = <K extends keyof FormVariant>(i: number, key: K, value: FormVariant[K]) => {
    const a = [...variants];
    a[i] = { ...a[i], [key]: value };
    onChange(a);
  };
  const removeRow = (i: number) => onChange(variants.filter((_, j) => j !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <FieldLabel>Product Variants</FieldLabel>
        <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add variant
        </button>
      </div>
      {variants.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
          <Tag className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No variants yet — product will have a single price</p>
          <button type="button" onClick={addRow} className="mt-2 text-xs font-semibold text-primary hover:underline">Add a variant</button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold">
              <tr>
                <th className="px-3 py-2 text-left">Variant Name</th>
                <th className="px-3 py-2 text-left">Price (₹)</th>
                <th className="px-3 py-2 text-left">Stock</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map((v, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input
                      value={v.variant_name}
                      onChange={(e) => updateRow(i, "variant_name", e.target.value)}
                      placeholder="e.g. Car, Bike, Pet"
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      value={String(v.price)}
                      onChange={(e) => updateRow(i, "price", e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      value={String(v.stock)}
                      onChange={(e) => updateRow(i, "stock", e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Product Form Slide-over ─── */

function ProductForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: FormData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<"basic" | "media" | "details" | "variants">("basic");

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val })), []);

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: f.id ? f.slug : slugify(name) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Product name is required."); return; }
    if (!form.slug.trim()) { setError("Slug is required."); return; }
    setSaving(true); setError(null);

    const timeout = (ms: number) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Please try again.")), ms)
      );

    try {
      // Refresh auth session so the token doesn't expire mid-save
      await supabase.auth.refreshSession().catch(() => {});

      const input = formToInput(form);
      let productId = form.id;

      await Promise.race([
        (async () => {
          if (productId) {
            const { error: e } = await adminUpdateProduct(productId, input);
            if (e) throw new Error(e);
          } else {
            const result = await adminCreateProduct(input);
            if ("error" in result) throw new Error(result.error);
            productId = result.id;
          }

          // Save variants
          const variantRows = form.variants
            .filter((v) => v.variant_name.trim())
            .map((v) => ({
              variant_name: v.variant_name.trim(),
              price: Number(v.price) || 0,
              stock: Number(v.stock) || 0,
            }));
          const varResult = await adminUpsertVariants(productId!, variantRows);
          if (varResult.error) throw new Error(`Variants: ${varResult.error}`);

          onSaved();
        })(),
        timeout(15000),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { key: "basic",    label: "Basic",    icon: Package },
    { key: "media",    label: "Media",    icon: Image },
    { key: "details",  label: "Details",  icon: List },
    { key: "variants", label: "Variants", icon: Tag },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {form.id ? "Edit Product" : "New Product"}
            </h2>
            {form.slug && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{form.slug}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-slate-100 px-4 gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key as typeof section)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                section === key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {section === "basic" && (
            <>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <FieldLabel>Product Name *</FieldLabel>
                  <Input value={form.name} onChange={handleNameChange} placeholder="e.g. Stegofy Pet QR Tag" />
                </div>
                <div>
                  <FieldLabel>Slug *</FieldLabel>
                  <Input value={form.slug} onChange={(v) => set("slug", v)} placeholder="e.g. stegofy-pet-qr-tag" />
                  <p className="text-[10px] text-slate-400 mt-1">Auto-generated from name. Used in URLs.</p>
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <RichTextEditor value={form.description} onChange={(v) => set("description", v)} />
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-primary bg-white capitalize"
                  >
                    <option value="">Select category…</option>
                    {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Price (₹) *</FieldLabel>
                  <Input type="number" min={0} value={form.price} onChange={(v) => set("price", v)} placeholder="0" />
                </div>
                <div>
                  <FieldLabel>Discount Price (₹)</FieldLabel>
                  <Input type="number" min={0} value={form.discount_price} onChange={(v) => set("discount_price", v)} placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Stock Quantity</FieldLabel>
                  <Input type="number" min={0} value={form.stock_quantity} onChange={(v) => set("stock_quantity", v)} placeholder="0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Active</FieldLabel>
                  <button
                    type="button"
                    onClick={() => set("is_active", !form.is_active)}
                    className={`flex items-center gap-2 w-fit px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      form.is_active ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {form.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    {form.is_active ? "Visible in shop" : "Hidden from shop"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Rating (0–5)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={5} step="0.1" value={form.rating} onChange={(v) => set("rating", v)} placeholder="0" />
                    <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Review Count</FieldLabel>
                  <Input type="number" min={0} value={form.review_count} onChange={(v) => set("review_count", v)} placeholder="0" />
                </div>
              </div>

              <BadgesSection selected={form.badges} onChange={(b) => set("badges", b)} />
            </>
          )}

          {section === "media" && (
            <ImagesSection images={form.images} onChange={(imgs) => set("images", imgs)} />
          )}

          {section === "details" && (
            <>
              <FeaturesSection features={form.features} onChange={(f) => set("features", f)} />
              <SpecsSection specs={form.specifications} onChange={(s) => set("specifications", s)} />
            </>
          )}

          {section === "variants" && (
            <VariantsSection variants={form.variants} onChange={(v) => set("variants", v)} />
          )}
        </div>

        {/* Footer */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : form.id ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Product Row ─── */

function ProductRow({
  product,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const img = product.images?.[0];
  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {img ? (
            <img src={img} alt={product.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-slate-100" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-slate-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{product.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {product.badges.slice(0, 2).map((b) => (
                <span key={b} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${BADGE_COLORS[b] ?? "bg-slate-100 text-slate-500"}`}>
                  {b.replace(/_/g, " ")}
                </span>
              ))}
              <span className="text-[10px] text-slate-400 font-mono">{product.slug}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell capitalize">{product.category || "—"}</td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div>
          <span className="font-semibold text-slate-800 text-sm">{formatPrice(product.price)}</span>
          {product.discount_price != null && (
            <span className="text-xs text-primary font-semibold ml-1.5">{formatPrice(product.discount_price)}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-400" />
          <span className="text-sm text-slate-600">{product.rating}</span>
          <span className="text-xs text-slate-400">({product.review_count})</span>
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`text-sm font-semibold ${product.stock_quantity > 0 ? "text-slate-700" : "text-red-500"}`}>
          {product.stock_quantity}
        </span>
      </td>
      <td className="px-4 py-3">
        <button onClick={onToggle} className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
          product.is_active
            ? "bg-green-50 text-green-600 hover:bg-green-100"
            : "bg-slate-100 text-slate-400 hover:bg-slate-200"
        }`}>
          {product.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          <span className="hidden sm:inline">{product.is_active ? "Active" : "Inactive"}</span>
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Screen ─── */

export function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    adminGetAllProducts()
      .then((data) => { setProducts(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Apply filters
  useEffect(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        [p.name, p.category, p.description, p.slug].some((v) => v?.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== "all") list = list.filter((p) => p.category === categoryFilter);
    if (statusFilter === "active") list = list.filter((p) => p.is_active);
    if (statusFilter === "inactive") list = list.filter((p) => !p.is_active);
    list.sort((a, b) =>
      sortDir === "desc"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
    );
    setFiltered(list);
  }, [products, search, categoryFilter, statusFilter, sortDir]);

  const openCreate = () => setFormData(emptyForm());

  const openEdit = async (p: Product) => {
    try {
      const variants = await getProductVariants(p.id);
      setFormData(productToForm(p, variants));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product variants");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const result = await adminDeleteProduct(id);
    if (result.error) { setError(`Delete failed: ${result.error}`); return; }
    reload();
  };

  const handleToggle = async (p: Product) => {
    const result = await adminUpdateProduct(p.id, { is_active: !p.is_active });
    if (result.error) { setError(`Toggle failed: ${result.error}`); return; }
    reload();
  };

  const closeForm = () => setFormData(null);
  const handleSaved = () => { closeForm(); reload(); };

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Products</h2>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} total · {activeCount} active</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-primary capitalize"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {sortDir === "desc" ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <span>Date</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={reload} className="text-xs font-semibold text-red-600 underline">Retry</button>
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-slate-100 animate-pulse rounded w-1/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Price</th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Rating</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Stock</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Table2 className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500">No products found</p>
                      <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or add a product</p>
                      <button onClick={openCreate} className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                        <Plus className="w-4 h-4" /> Add Product
                      </button>
                    </td>
                  </tr>
                ) : filtered.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={() => openEdit(p)}
                    onDelete={() => handleDelete(p.id)}
                    onToggle={() => handleToggle(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary pills */}
      {!loading && products.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="px-3 py-1 bg-slate-100 rounded-full">
            Showing {filtered.length} of {products.length}
          </span>
          {categoryFilter !== "all" && (
            <button onClick={() => setCategoryFilter("all")} className="px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1 hover:bg-primary/20 transition-colors">
              Category: {categoryFilter} <X className="w-3 h-3" />
            </button>
          )}
          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")} className="px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1 hover:bg-primary/20 transition-colors">
              Status: {statusFilter} <X className="w-3 h-3" />
            </button>
          )}
          {search && (
            <button onClick={() => setSearch("")} className="px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1 hover:bg-primary/20 transition-colors">
              Search: "{search}" <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Form slide-over */}
      {formData && (
        <ProductForm initial={formData} onClose={closeForm} onSaved={handleSaved} />
      )}
    </div>
  );
}
