import { Component, type ReactNode } from "react";
import { AuthExpiredError } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

interface Props {
  children: ReactNode;
  onExpired: () => void;
}

interface State {
  hasError: boolean;
  isAuthError: boolean;
  retrying: boolean;
}

/**
 * Error boundary that wraps the admin route tree.
 *
 * Catches AuthExpiredError (which propagates from any screen's render path)
 * and shows an inline "Reconnecting…" state instead of a blank/crash screen.
 *
 * Auto-retry flow:
 *   1. Error caught → show reconnecting UI + attempt session refresh.
 *   2. Refresh succeeds → reset state so children re-mount with fresh session.
 *   3. Refresh fails → call onExpired() which navigates to /admin/login?reason=expired.
 *
 * Non-auth errors show a generic fallback with a page-reload button.
 */
export class SessionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isAuthError: false, retrying: false };
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      hasError: true,
      isAuthError: error instanceof AuthExpiredError,
    };
  }

  componentDidCatch(error: unknown) {
    if (error instanceof AuthExpiredError) {
      this.attemptReconnect();
    }
  }

  attemptReconnect = async () => {
    this.setState({ retrying: true });
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      this.setState({ retrying: false });
      this.props.onExpired();
    } else {
      this.setState({ hasError: false, isAuthError: false, retrying: false });
    }
  };

  render() {
    const { hasError, isAuthError, retrying } = this.state;

    if (hasError && isAuthError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
            <svg
              className={`h-7 w-7 ${retrying ? "animate-spin text-amber-500" : "text-amber-600"}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              {retrying ? (
                <>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              )}
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">
              {retrying ? "Reconnecting session…" : "Session expired"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {retrying
                ? "Please wait while we restore your session."
                : "Your session could not be restored."}
            </p>
          </div>
          {!retrying && (
            <button
              onClick={this.attemptReconnect}
              className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-base font-semibold text-slate-800">Something went wrong</p>
          <p className="text-sm text-slate-500">An unexpected error occurred.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
