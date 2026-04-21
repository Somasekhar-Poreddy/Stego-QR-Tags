import { useState, useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type RangeKey = "7d" | "30d" | "90d" | "month" | "custom";

export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d":     "Last 7 Days",
  "30d":    "Last 30 Days",
  "90d":    "Last 90 Days",
  "month":  "This Month",
  "custom": "Custom",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function getRangeDates(
  key: RangeKey,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();

  if (key === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (key === "30d") {
    from.setDate(from.getDate() - 29);
  } else if (key === "90d") {
    from.setDate(from.getDate() - 89);
  } else if (key === "month") {
    from.setDate(1);
  } else if (key === "custom" && customFrom && customTo) {
    const f = new Date(customFrom);
    const t = new Date(customTo);
    f.setHours(0, 0, 0, 0);
    t.setHours(23, 59, 59, 999);
    return { from: f, to: t };
  }
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export interface DateRangeState {
  rangeKey: RangeKey;
  customFrom: string;
  customTo: string;
  from: Date;
  to: Date;
}

export function useDateRange(initial: RangeKey = "7d"): DateRangeState & {
  setRangeKey: (k: RangeKey) => void;
  setCustomFrom: (s: string) => void;
  setCustomTo: (s: string) => void;
} {
  const today = new Date();
  const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 6);

  const [rangeKey, setRangeKey] = useState<RangeKey>(initial);
  const [customFrom, setCustomFrom] = useState(defaultFrom.toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(today.toISOString().slice(0, 10));

  const { from, to } = useMemo(
    () => getRangeDates(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );

  return { rangeKey, customFrom, customTo, from, to, setRangeKey, setCustomFrom, setCustomTo };
}

interface DateRangeBarProps {
  state: DateRangeState & {
    setRangeKey: (k: RangeKey) => void;
    setCustomFrom: (s: string) => void;
    setCustomTo: (s: string) => void;
  };
  label?: string;
}

export function DateRangeBar({ state, label = "Filter:" }: DateRangeBarProps) {
  const { rangeKey, customFrom, customTo, setRangeKey, setCustomFrom, setCustomTo } = state;

  const currentYear = new Date().getFullYear();
  const [monthPick, setMonthPick] = useState(new Date().getMonth());
  const [yearPick, setYearPick] = useState(currentYear);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const applyMonthYear = () => {
    const first = new Date(yearPick, monthPick, 1);
    const last = new Date(yearPick, monthPick + 1, 0);
    setCustomFrom(first.toISOString().slice(0, 10));
    setCustomTo(last.toISOString().slice(0, 10));
    setRangeKey("custom");
  };

  return (
    <div className="space-y-2">
      {/* Quick-pick buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 shrink-0">{label}</span>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setRangeKey(key)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
              rangeKey === key
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            {key === "custom" && <Calendar className="w-3 h-3" />}
            {RANGE_LABELS[key]}
            {key === "custom" && <ChevronDown className={cn("w-3 h-3 transition-transform", rangeKey === "custom" && "rotate-180")} />}
          </button>
        ))}
      </div>

      {/* Custom date inputs — shown only when "Custom" is selected */}
      {rangeKey === "custom" && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          {/* Date range pickers */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-500 shrink-0">From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-700"
              />
            </div>
            <span className="text-slate-300 text-xs font-bold">→</span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-500 shrink-0">To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-700"
              />
            </div>
          </div>

          {/* Month / Year shortcut */}
          <div className="border-t border-slate-200 pt-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Quick jump to a month</p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={monthPick}
                onChange={(e) => setMonthPick(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-700"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={yearPick}
                onChange={(e) => setYearPick(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-700"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={applyMonthYear}
                className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
