import { useEffect, useState } from "react";
import { Send, Bell, ChevronDown, User } from "lucide-react";
import { getNotifications, sendNotification, adminGetAllUsers, type Notification } from "@/services/adminService";
import { cn } from "@/lib/utils";

type TargetMode = "broadcast" | "user";

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("broadcast");
  const [form, setForm] = useState({ title: "", message: "", target: "all", userId: "" });
  const [userSearch, setUserSearch] = useState("");

  const reload = () => getNotifications().then((d) => { setNotifications(d); setLoading(false); });
  useEffect(() => {
    reload();
    adminGetAllUsers().then((u) => setUsers(u as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]));
  }, []);

  const BROADCAST_TARGETS = ["all", "admins", "premium", "free"];

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return [u.first_name, u.last_name, u.email].some((v) => v?.toLowerCase().includes(q));
  }).slice(0, 8);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    if (targetMode === "user" && !form.userId) return;
    setSending(true);
    const target = targetMode === "user" ? `user:${form.userId}` : form.target;
    await sendNotification({ title: form.title, message: form.message, target });
    setForm({ title: "", message: "", target: "all", userId: "" });
    setUserSearch("");
    setSending(false);
    reload();
  };

  const canSend = form.title.trim() && form.message.trim() && (targetMode === "broadcast" || form.userId);

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Compose Notification
        </h3>
        <div className="space-y-4">
          {/* Target mode toggle */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block">Send To</label>
            <div className="flex gap-2">
              <button onClick={() => setTargetMode("broadcast")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold border transition-all", targetMode === "broadcast" ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                Broadcast Audience
              </button>
              <button onClick={() => setTargetMode("user")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-1.5", targetMode === "user" ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                <User className="w-3.5 h-3.5" /> Specific User
              </button>
            </div>
          </div>

          {targetMode === "broadcast" ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Audience</label>
              <div className="relative">
                <select value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white appearance-none transition-colors">
                  {BROADCAST_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Search User</label>
              <input
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setForm((f) => ({ ...f, userId: "" })); }}
                placeholder="Search by name or email…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors"
              />
              {userSearch && filteredUsers.length > 0 && !form.userId && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-md">
                  {filteredUsers.map((u) => (
                    <button key={u.id} onClick={() => { setForm((f) => ({ ...f, userId: u.id })); setUserSearch([u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                      <p className="text-sm font-semibold text-slate-800">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {form.userId && (
                <p className="text-xs text-green-600 mt-1.5 font-semibold">Target: {userSearch} (ID: {form.userId.slice(0, 12)}…)</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. New Feature Announcement" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Message</label>
            <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Write your message…" rows={3} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
          </div>

          <button onClick={handleSend} disabled={sending || !canSend} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all">
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {n.target.startsWith("user:") ? `👤 ${n.target.slice(5, 17)}…` : n.target}
                    </span>
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
