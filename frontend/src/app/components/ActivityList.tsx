import { useEffect, useState } from "react";
import { Phone, MessageSquare, AlertCircle, Inbox, Loader2 } from "lucide-react";
import type {
  ActivityItem, ActivityCall, ActivityMessage, ActivityResponse,
} from "@/types/activity";
import { cn } from "@/lib/utils";

const CALL_STATUS_LABEL: Record<string, string> = {
  initiated: "Ringing",
  in_progress: "Connected",
  completed: "Connected",
  failed: "Failed",
  disconnected: "Ended",
};

const CALL_STATUS_COLOR: Record<string, string> = {
  initiated: "bg-amber-50 text-amber-600",
  in_progress: "bg-green-50 text-green-600",
  completed: "bg-green-50 text-green-600",
  failed: "bg-red-50 text-red-500",
  disconnected: "bg-slate-100 text-slate-500",
};

const MSG_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
};

const MSG_STATUS_COLOR: Record<string, string> = {
  queued: "bg-slate-100 text-slate-500",
  sent: "bg-blue-50 text-blue-600",
  delivered: "bg-green-50 text-green-600",
  failed: "bg-red-50 text-red-500",
};

function StatusPill({ kind, status }: { kind: "call" | "message"; status: string }) {
  const label =
    kind === "call"
      ? CALL_STATUS_LABEL[status] ?? status
      : MSG_STATUS_LABEL[status] ?? status;
  const color =
    kind === "call"
      ? CALL_STATUS_COLOR[status] ?? "bg-slate-100 text-slate-500"
      : MSG_STATUS_COLOR[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", color)}>
      {label}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatDuration(secs: number | null | undefined): string {
  if (!secs || secs <= 0) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function CallRow({ item, showQrName }: { item: ActivityCall; showQrName: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Phone className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {item.caller_phone ?? "Unknown caller"}
          </p>
          <StatusPill kind="call" status={item.status} />
        </div>
        <p className="text-[11px] text-slate-400">{formatTime(item.created_at)}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
          <span>Duration: {formatDuration(item.duration_seconds)}</span>
          {item.vehicle_last4 && (
            <span className="font-mono">Vehicle …{item.vehicle_last4}</span>
          )}
        </div>
        {showQrName && item.qr_name && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">For: {item.qr_name}</p>
        )}
        {item.error_message && (
          <p className="text-[11px] text-red-500 mt-1 truncate">{item.error_message}</p>
        )}
      </div>
    </div>
  );
}

function MessageRow({ item, showQrName }: { item: ActivityMessage; showQrName: boolean }) {
  const channelLabel = item.channel === "whatsapp" ? "WhatsApp" : item.channel.toUpperCase();
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
        <MessageSquare className="w-5 h-5 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {item.recipient_phone ?? "Unknown recipient"}
          </p>
          <StatusPill kind="message" status={item.status} />
        </div>
        <p className="text-[11px] text-slate-400">
          {channelLabel} · {formatTime(item.created_at)}
        </p>
        {item.payload_summary && (
          <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{item.payload_summary}</p>
        )}
        {showQrName && item.qr_name && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">For: {item.qr_name}</p>
        )}
        {item.error_message && (
          <p className="text-[11px] text-red-500 mt-1 truncate">{item.error_message}</p>
        )}
      </div>
    </div>
  );
}

export interface ActivityListProps {
  /** Async loader. Re-runs when `refreshKey` changes. */
  load: () => Promise<ActivityResponse>;
  /** Bump to force a reload (e.g. after switching tabs). */
  refreshKey?: string | number;
  /** Show the QR profile name on each row. Off when the screen is already
   * scoped to a single QR. */
  showQrName?: boolean;
  emptyMessage?: string;
}

export function ActivityList({
  load, refreshKey, showQrName = true,
  emptyMessage = "No activity yet. Calls and messages from your QR will appear here.",
}: ActivityListProps) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((res) => {
        if (cancelled) return;
        setItems(res.items ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading && !items) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs font-medium">Loading activity…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
        <AlertCircle className="w-7 h-7 text-red-400" />
        <p className="text-sm font-semibold">Couldn't load activity</p>
        <p className="text-xs text-slate-400 max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Inbox className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">No activity yet</p>
        <p className="text-xs text-slate-400 max-w-xs text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        item.kind === "call"
          ? <CallRow key={item.id} item={item} showQrName={showQrName} />
          : <MessageRow key={item.id} item={item} showQrName={showQrName} />
      ))}
    </div>
  );
}
