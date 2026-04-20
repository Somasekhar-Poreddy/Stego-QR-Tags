import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, X } from "lucide-react";
import { getCommsHealth, type CommsHealth } from "@/services/adminService";

const DISMISS_KEY = "admin.commsStatusBanner.dismissedAt";
// Spec: dismissed banner stays hidden for 24h; we re-prompt after that so a
// real outage isn't silenced indefinitely by a single click.
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch { return false; }
}

interface Issue {
  message: string;
  cta?: { label: string; section: string };
}

function deriveIssues(h: CommsHealth): Issue[] {
  const issues: Issue[] = [];
  if (!h.zavu_configured && h.whatsapp_enabled) {
    issues.push({
      message: "WhatsApp delivery is enabled but Zavu credentials are missing — fallback only.",
      cta: { label: "Add Zavu credentials", section: "api-keys" },
    });
  }
  if (!h.exotel_configured) {
    issues.push({
      message: "Exotel credentials are missing — masked calls and SMS fallback are unavailable.",
      cta: { label: "Add Exotel credentials", section: "api-keys" },
    });
  }
  if (h.cost.over_cap) {
    issues.push({
      message: `Daily comms spend cap reached (₹${h.cost.cap_inr}). New sends are blocked until tomorrow.`,
      cta: { label: "Adjust cost cap", section: "comms-routing" },
    });
  } else if (h.cost.over_warn && h.cost.warn_inr > 0) {
    issues.push({
      message: `Daily spend (₹${h.cost.today_inr}) crossed the warn threshold (₹${h.cost.warn_inr}).`,
      cta: { label: "Review cost settings", section: "comms-routing" },
    });
  }
  for (const [provider, stats] of Object.entries(h.provider_24h)) {
    if (stats.total >= 10 && stats.failureRate > 0.25) {
      issues.push({
        message: `${provider} has ${(stats.failureRate * 100).toFixed(0)}% failure rate over the last 24h.`,
        cta: { label: "Open analytics", section: "" },
      });
    }
  }
  return issues;
}

export function CommsStatusBanner() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isDismissed()) return;
    let cancelled = false;
    getCommsHealth()
      .then((health) => {
        if (cancelled) return;
        setIssues(deriveIssues(health));
      })
      .catch(() => { /* silently ignore */ });
    return () => { cancelled = true; };
  }, []);

  if (issues.length === 0) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setIssues([]);
  };

  const top = issues[0];
  const more = issues.length - 1;

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Communications need attention
        </p>
        <p className="text-xs text-amber-700/90 mt-0.5">
          {top.message}
          {top.cta && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => {
                  if (top.cta?.section) {
                    setLocation("/admin/settings");
                    setTimeout(() => {
                      document.getElementById(top.cta!.section)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  } else {
                    setLocation("/admin/communications");
                  }
                }}
                className="underline font-semibold hover:text-amber-900"
              >
                {top.cta.label}
              </button>
            </>
          )}
          {more > 0 && (
            <>
              {" "}· <span className="font-semibold">{more} more issue{more === 1 ? "" : "s"}</span>
            </>
          )}
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss warning"
        className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
