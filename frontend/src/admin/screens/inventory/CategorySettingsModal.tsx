import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  getInventorySettings,
  updateInventorySetting,
  type InventoryCategorySetting,
} from "@/services/adminService";

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export function CategorySettingsModal({ onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<InventoryCategorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getInventorySettings()
      .then((rows) => alive && setSettings(rows))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load settings."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const patch = (category: string, patch: Partial<InventoryCategorySetting>) => {
    setSettings((prev) => prev.map((row) => (row.category === category ? { ...row, ...patch } : row)));
  };

  const handleSave = async (row: InventoryCategorySetting) => {
    setError(null);
    setSaving(row.category);
    try {
      await updateInventorySetting(row.category, {
        low_stock_threshold: Number(row.low_stock_threshold),
        reorder_count: Number(row.reorder_count),
        alert_email: row.alert_email?.trim() || null,
      });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Low-stock settings</h3>
            <p className="text-xs text-slate-500 mt-0.5">Thresholds, reorder counts, and email alert recipients per category.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-left">Alert when below</th>
                    <th className="px-2 py-2 text-left">Reorder count</th>
                    <th className="px-2 py-2 text-left">Alert email</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.map((row) => (
                    <tr key={row.category}>
                      <td className="px-2 py-2 capitalize font-semibold text-slate-700">{row.category}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={row.low_stock_threshold}
                          onChange={(e) => patch(row.category, { low_stock_threshold: parseInt(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={row.reorder_count}
                          onChange={(e) => patch(row.category, { reorder_count: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="email"
                          value={row.alert_email ?? ""}
                          placeholder="(all super_admins)"
                          onChange={(e) => patch(row.category, { alert_email: e.target.value })}
                          className="w-full min-w-[180px] px-2 py-1 rounded-lg border border-slate-200 text-sm outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => handleSave(row)}
                          disabled={saving === row.category}
                          className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {saving === row.category && <Loader2 className="w-3 h-3 animate-spin" />}
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="py-2 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}
