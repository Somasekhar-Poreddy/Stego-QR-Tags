import { useEffect, useState, useCallback } from "react";
import { MessageSquare, X, CheckCircle, Send } from "lucide-react";
import { getSupportTickets, respondToTicket, resolveTicket, type SupportTicket } from "@/services/adminService";
import { ensureFreshSession } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | "resolved";

function statusColor(s: string) {
  if (s === "resolved") return "bg-green-100 text-green-700";
  if (s === "closed") return "bg-slate-100 text-slate-500";
  return "bg-amber-100 text-amber-700";
}

function RespondModal({ ticket, onClose, onSave }: { ticket: SupportTicket; onClose: () => void; onSave: (res: string) => void }) {
  const [response, setResponse] = useState(ticket.response || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Respond to Ticket</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">User Issue</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{ticket.issue || "No issue provided"}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Your Response</label>
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="Type your response here…" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(response)} disabled={!response.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

export function SupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<SupportTicket | null>(null);

  const reload = useCallback(() => {
    ensureFreshSession()
      .then(() => getSupportTickets())
      .then((d) => { setTickets(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const displayed = tickets.filter((t) => {
    if (filter === "open") return t.status !== "resolved" && t.status !== "closed";
    if (filter === "resolved") return t.status === "resolved";
    return true;
  });

  const handleRespond = async (res: string) => {
    if (!responding) return;
    await respondToTicket(responding.id, res);
    setResponding(null);
    reload();
  };

  const handleResolve = async (id: string) => { await resolveTicket(id); reload(); };

  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)} className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-all", filter === t.key ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="py-12 text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.issue || "No issue text"}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    User ID: {t.user_id?.slice(0, 12) || "anonymous"} · {t.created_at?.slice(0, 10)}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
              </div>

              {t.response && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Admin Response</p>
                  <p className="text-sm text-slate-700">{t.response}</p>
                </div>
              )}

              {t.status !== "resolved" && (
                <div className="flex gap-2">
                  <button onClick={() => setResponding(t)} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors">
                    <Send className="w-3.5 h-3.5" /> Respond
                  </button>
                  <button onClick={() => handleResolve(t.id)} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {responding && <RespondModal ticket={responding} onClose={() => setResponding(null)} onSave={handleRespond} />}
    </div>
  );
}
