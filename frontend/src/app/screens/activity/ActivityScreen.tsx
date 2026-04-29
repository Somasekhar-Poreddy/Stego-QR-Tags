import { useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ActivityList } from "@/app/components/ActivityList";
import { getMyActivity } from "@/services/activityService";

export function ActivityScreen() {
  const [, navigate] = useLocation();
  const load = useCallback(() => getMyActivity(100), []);

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center px-4 py-3 gap-2">
        <button
          onClick={() => navigate("/app/qr")}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors -ml-1"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <p className="flex-1 text-center font-bold text-slate-900 text-base">Activity</p>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <ActivityList
          load={load}
          showQrName
          emptyMessage="Calls and messages from any of your QR tags will appear here."
        />
      </div>
    </div>
  );
}
