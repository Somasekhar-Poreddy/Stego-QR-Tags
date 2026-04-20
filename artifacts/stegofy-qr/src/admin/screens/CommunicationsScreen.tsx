import { useEffect, useState } from "react";
import { Phone, MessageCircle, IndianRupee, Activity, RefreshCcw, ShieldCheck, AlertOctagon } from "lucide-react";
import {
  getCommsHealth, getCommsAnalytics,
  type CommsHealth, type CommsAnalytics,
} from "@/services/adminService";

function inr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClasses =
    tone === "good" ? "bg-green-50 border-green-100 text-green-800"
    : tone === "warn" ? "bg-amber-50 border-amber-200 text-amber-800"
    : tone === "bad" ? "bg-red-50 border-red-200 text-red-800"
    : "bg-white border-slate-100 text-slate-800";
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${toneClasses}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-70" />
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      </div>
      <p className="text-2xl font-extrabold mt-2">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

export function CommunicationsScreen() {
  const [health, setHealth] = useState<CommsHealth | null>(null);
  const [analytics, setAnalytics] = useState<CommsAnalytics | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const [h, a] = await Promise.all([getCommsHealth(), getCommsAnalytics(range)]);
      setHealth(h);
      setAnalytics(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communications data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(days); }, [days]);

  const totalMessages = analytics?.messages_daily.reduce((a, r) => a + r.sent, 0) ?? 0;
  const totalDelivered = analytics?.messages_daily.reduce((a, r) => a + r.delivered, 0) ?? 0;
  const totalFailed = analytics?.messages_daily.reduce((a, r) => a + r.failed, 0) ?? 0;
  const totalCalls = analytics?.calls_daily.reduce((a, r) => a + r.total, 0) ?? 0;
  const totalCallsCompleted = analytics?.calls_daily.reduce((a, r) => a + r.completed, 0) ?? 0;
  const totalCost =
    (analytics?.messages_daily.reduce((a, r) => a + r.cost_paise, 0) ?? 0) +
    (analytics?.calls_daily.reduce((a, r) => a + r.cost_paise, 0) ?? 0);
  const totalFallback = analytics?.messages_by_provider.reduce((a, r) => a + r.fallback_used, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Communications</h2>
          <p className="text-xs text-slate-500">Delivery, fallback usage and cost across Zavu and Exotel.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${days === d ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => load(days)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Health */}
      {health && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <p className="font-bold text-slate-900">Provider health</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <HealthBadge label="Zavu (WhatsApp)" ok={health.zavu_configured} okText="Configured" badText="Not configured" />
            <HealthBadge label="Exotel (SMS / Calls)" ok={health.exotel_configured} okText="Configured" badText="Not configured" />
            <HealthBadge label="WhatsApp" ok={health.whatsapp_enabled} okText="Enabled" badText="Disabled" />
            <HealthBadge label="Masked calls" ok={health.calls_enabled} okText="Enabled" badText="Disabled" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs text-slate-500">
            <RoutingPill label="WhatsApp routing" value={health.routing.whatsapp} />
            <RoutingPill label="SMS routing" value={health.routing.sms} />
            <RoutingPill label="Call routing" value={health.routing.call} />
            <RoutingPill label="OTP channel" value={health.routing.otp_channel} />
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={MessageCircle} label="Messages sent" value={String(totalMessages)} sub={`${totalDelivered} delivered · ${totalFailed} failed`} />
          <StatCard icon={Phone} label="Calls placed" value={String(totalCalls)} sub={`${totalCallsCompleted} completed`} />
          <StatCard
            icon={Activity} label="Fallback used" value={String(totalFallback)}
            sub="Messages routed to backup provider"
            tone={totalFallback > totalMessages * 0.2 ? "warn" : "default"}
          />
          <StatCard
            icon={IndianRupee} label={`Spend · last ${days}d`} value={inr(totalCost)}
            sub={health ? `Today: ${inr(health.cost.today_paise)} of ₹${health.cost.cap_inr || "—"}` : ""}
            tone={health?.cost.over_cap ? "bad" : health?.cost.over_warn ? "warn" : "default"}
          />
        </div>
      )}

      {/* Daily breakdown */}
      {analytics && (
        <div className="grid md:grid-cols-2 gap-4">
          <DailyTable
            title="Messages per day"
            rows={analytics.messages_daily.map((r) => ({
              day: r.day,
              cells: [
                { label: "Sent", value: r.sent },
                { label: "Delivered", value: r.delivered },
                { label: "Failed", value: r.failed, tone: r.failed > 0 ? "bad" : undefined },
                { label: "Cost", value: inr(r.cost_paise) },
              ],
            }))}
          />
          <DailyTable
            title="Calls per day"
            rows={analytics.calls_daily.map((r) => ({
              day: r.day,
              cells: [
                { label: "Total", value: r.total },
                { label: "Completed", value: r.completed },
                { label: "Failed", value: r.failed, tone: r.failed > 0 ? "bad" : undefined },
                { label: "Cost", value: inr(r.cost_paise) },
              ],
            }))}
          />
        </div>
      )}

      {/* Provider breakdown */}
      {analytics && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="font-bold text-slate-900 mb-3">Per provider</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2 text-left">Provider</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Failed</th>
                <th className="px-2 py-2 text-right">Fallback used</th>
                <th className="px-2 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analytics.messages_by_provider.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-slate-400">No messages yet.</td></tr>
              ) : analytics.messages_by_provider.map((p) => (
                <tr key={p.provider}>
                  <td className="px-2 py-2 font-semibold capitalize">{p.provider}</td>
                  <td className="px-2 py-2 text-right">{p.total}</td>
                  <td className={`px-2 py-2 text-right ${p.failed > 0 ? "text-red-600 font-semibold" : ""}`}>{p.failed}</td>
                  <td className="px-2 py-2 text-right">{p.fallback_used}</td>
                  <td className="px-2 py-2 text-right">{inr(p.cost_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading…</div>}
    </div>
  );
}

function HealthBadge({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2 bg-slate-50">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
        {ok ? okText : badText}
      </span>
    </div>
  );
}

function RoutingPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 rounded-xl px-3 py-2 bg-white">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{value}</p>
    </div>
  );
}

interface Cell { label: string; value: string | number; tone?: "bad" }
interface DailyRow { day: string; cells: Cell[] }
function DailyTable({ title, rows }: { title: string; rows: DailyRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="font-bold text-slate-900 mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No activity in this range.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-2 py-1.5 text-left">Day</th>
              {rows[0].cells.map((c) => <th key={c.label} className="px-2 py-1.5 text-right">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => (
              <tr key={r.day}>
                <td className="px-2 py-1.5 font-mono text-slate-500">{r.day.slice(0, 10)}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className={`px-2 py-1.5 text-right ${c.tone === "bad" ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                    {c.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
          <AlertOctagon className="w-3 h-3" /> Times shown in UTC.
        </p>
      )}
    </div>
  );
}
