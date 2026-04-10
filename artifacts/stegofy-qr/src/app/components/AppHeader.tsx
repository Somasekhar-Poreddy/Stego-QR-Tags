import { Bell } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showNotification?: boolean;
}

export function AppHeader({ title, showBack, onBack, showNotification = true }: AppHeaderProps) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "User"
    : "User";

  const initials = user
    ? ((user.firstName?.[0] ?? user.name?.[0] ?? "U") + (user.lastName?.[0] ?? "")).toUpperCase()
    : "U";

  const isOnProfile = location.startsWith("/app/profile");

  return (
    <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack || (() => navigate("/app"))}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {title ? (
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
        ) : (
          <div>
            <p className="text-xs text-slate-400 font-medium leading-none">Welcome back 👋</p>
            {user ? (
              <p className="text-base font-bold text-slate-900 leading-tight">
                Hi, {fullName}
              </p>
            ) : (
              <div className="h-5 w-32 bg-slate-100 rounded animate-pulse mt-0.5" />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Profile avatar — always shown, navigates to /app/profile */}
        <button
          onClick={() => navigate("/app/profile")}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-all",
            isOnProfile
              ? "ring-2 ring-primary ring-offset-1 bg-gradient-to-br from-primary to-violet-600"
              : "bg-gradient-to-br from-primary to-violet-600 hover:opacity-90 active:scale-95"
          )}
          title="My Profile"
        >
          {initials}
        </button>

        {showNotification && (
          <button className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>
        )}
      </div>
    </header>
  );
}
