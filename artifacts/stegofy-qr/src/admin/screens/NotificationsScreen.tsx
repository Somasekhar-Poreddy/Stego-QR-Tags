import { useEffect, useState } from "react";
import { Send, Bell, ChevronDown } from "lucide-react";
import { getNotifications, sendNotification, type Notification } from "@/services/adminService";

const TARGETS = ["all", "admins", "premium", "free"];

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", target: "all" });

  const reload = () => getNotifications().then((d) => { setNotifications(d); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true);
    await sendNotification(form);
    setForm({ title: "", message: "", target: "all" });
    setSending(false);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Compose Notification
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. New Feature Announcement" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Message</label>
            <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Write your message…" rows={3} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Target Audience</label>
            <div className="relative">
              <select value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white appearance-none transition-colors">
                {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <button onClick={handleSend} disabled={sending || !form.title.trim() || !form.message.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all">
            <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send Notification"}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Sent Notifications ({notifications.length})</h3>
        {loading ? (
          <div className="text-center py-6 text-sm text-slate-400">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">No notifications sent yet</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{n.target}</span>
                    <p className="text-[11px] text-slate-400 mt-1">{n.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
