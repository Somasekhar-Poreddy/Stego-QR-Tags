import { useState } from "react";
import { User, Phone, Mail, Shield, Bell, Lock, HelpCircle, LogOut, ChevronRight, Edit, Camera, ToggleRight, ToggleLeft } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { AppHeader } from "@/app/components/AppHeader";
import { cn } from "@/lib/utils";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [strictMode, setStrictMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "User");

  const MENU_ITEMS = [
    { icon: Bell, label: "Notifications", toggle: true, value: notifications, onToggle: () => setNotifications(!notifications) },
    { icon: Lock, label: "Privacy & Security", href: "#" },
    { icon: HelpCircle, label: "Help & Support", href: "#" },
    { icon: Shield, label: "Terms & Privacy", href: "#" },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader title="Profile" showNotification={false} />

      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-violet-600 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="flex-1">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base font-bold text-slate-900 border-b-2 border-primary outline-none w-full bg-transparent"
                />
              ) : (
                <p className="text-base font-bold text-slate-900">{name}</p>
              )}
              <p className="text-xs text-slate-400">{user?.phone || "+91 98*** ***12"}</p>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 bg-slate-100 rounded-xl"
            >
              <Edit className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Info rows */}
          <div className="space-y-2.5">
            {[
              { icon: Phone, label: "Mobile", value: user?.phone || "+91 98*** ***12" },
              { icon: Mail, label: "Email", value: "Not linked" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <row.icon className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400">{row.label}</p>
                  <p className="text-xs font-semibold text-slate-700">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strict Mode Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Strict Mode</p>
                <p className="text-xs text-slate-400">Require code for all contacts</p>
              </div>
            </div>
            <button
              onClick={() => setStrictMode(!strictMode)}
              className={cn("w-12 h-6 rounded-full relative transition-colors", strictMode ? "bg-primary" : "bg-slate-200")}
            >
              <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow", strictMode ? "right-0.5" : "left-0.5")} />
            </button>
          </div>
          {strictMode && (
            <p className="mt-3 text-xs bg-primary/5 text-primary rounded-xl px-3 py-2 font-medium">
              ✓ Strict mode is active — all contacts require tag code verification
            </p>
          )}
        </div>

        {/* Menu items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {MENU_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                <item.icon className="w-4 h-4 text-slate-600" />
              </div>
              <p className="flex-1 text-sm font-semibold text-slate-700">{item.label}</p>
              {item.toggle ? (
                <button
                  onClick={item.onToggle}
                  className={cn("w-10 h-5 rounded-full relative transition-colors", item.value ? "bg-primary" : "bg-slate-200")}
                >
                  <div className={cn("w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", item.value ? "right-0.5" : "left-0.5")} />
                </button>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-300" />
              )}
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-500 rounded-2xl font-semibold text-sm border border-red-100 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <p className="text-center text-[10px] text-slate-300">Stegofy v1.0.0</p>
      </div>
    </div>
  );
}
