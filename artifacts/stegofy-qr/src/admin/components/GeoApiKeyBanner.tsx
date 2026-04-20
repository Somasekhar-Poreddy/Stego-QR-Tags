import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, X } from "lucide-react";
import { getConfigStatus } from "@/services/adminService";

const DISMISS_KEY = "admin.geoApiKeyBanner.dismissedAt";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

type Reason = "missing" | "invalid";

export function GeoApiKeyBanner() {
  const [reason, setReason] = useState<Reason | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isDismissed()) return;
    let cancelled = false;
    getConfigStatus()
      .then((status) => {
        if (cancelled) return;
        if (!status.ip2location_api_key_set) setReason("missing");
        else if (status.ip2location_api_key_status === "invalid_key") setReason("invalid");
      })
      .catch(() => {
        // Silently ignore — failing to fetch the status shouldn't show a misleading warning.
      });
    return () => { cancelled = true; };
  }, []);

  if (!reason) return null;
  const isInvalid = reason === "invalid";

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setReason(null);
  };

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          {isInvalid
            ? "Geo-lookup API key was rejected"
            : "Geo-lookup API key not configured"}
        </p>
        <p className="text-xs text-amber-700/90 mt-0.5">
          {isInvalid
            ? "IP2Location rejected the saved key on a recent scan. Geo-lookups are falling back to the unauthenticated tier (~500/day)."
            : "Scan locations are using the unauthenticated IP2Location tier (limited to ~500 lookups/day)."}
          {" "}
          <button
            type="button"
            onClick={() => {
              setLocation("/admin/settings");
              setTimeout(() => {
                document.getElementById("api-keys")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
            className="underline font-semibold hover:text-amber-900"
          >
            {isInvalid ? "Update the key in Settings" : "Add an API key in Settings"}
          </button>
          {" "}to avoid hitting the limit.
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
