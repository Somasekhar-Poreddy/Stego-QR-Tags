import { Clock, LogOut } from "lucide-react";

interface IdleWarningModalProps {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

/**
 * Modal shown during the final countdown of the idle window. Lets the admin
 * either extend their session or sign out immediately. Designed to be
 * unobtrusive — it dims the page but doesn't block the underlying screen
 * from rendering, so admins don't lose visual context.
 */
export function IdleWarningModal({
  open,
  secondsLeft,
  onStay,
  onLogout,
}: IdleWarningModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="idle-warning-title" className="text-base font-bold text-slate-900">
              Are you still there?
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              You'll be signed out due to inactivity in
              {" "}<span className="font-semibold text-slate-700">{secondsLeft}s</span>.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
          <button
            type="button"
            onClick={onStay}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
