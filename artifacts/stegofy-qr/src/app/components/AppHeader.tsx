import { Bell, ChevronLeft } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "wouter";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showNotification?: boolean;
}

export function AppHeader({ title, showBack, onBack, showNotification = true }: AppHeaderProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack || (() => navigate("/app"))}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        )}
        {title ? (
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
        ) : (
          <div>
            <p className="text-xs text-slate-400 font-medium leading-none">Welcome back 👋</p>
            <p className="text-base font-bold text-slate-900 leading-tight">
              Hi, {user?.name || "User"}
            </p>
          </div>
        )}
      </div>
      {showNotification && (
        <button className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>
      )}
    </header>
  );
}
