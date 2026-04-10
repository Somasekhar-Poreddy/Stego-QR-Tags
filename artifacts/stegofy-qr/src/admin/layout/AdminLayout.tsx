import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Users, QrCode, MessageSquare,
  Package, ShoppingCart, Archive, BarChart2,
  UserCog, Bell, LifeBuoy, Settings,
  ChevronLeft, ChevronRight, Menu, X, LogOut, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/admin",              label: "Dashboard",         icon: LayoutDashboard },
  { path: "/admin/users",        label: "Users",             icon: Users },
  { path: "/admin/qr-codes",     label: "QR Codes",          icon: QrCode },
  { path: "/admin/requests",     label: "Contact Requests",  icon: MessageSquare },
  { path: "/admin/products",     label: "Products",          icon: Package },
  { path: "/admin/orders",       label: "Orders",            icon: ShoppingCart },
  { path: "/admin/inventory",    label: "QR Inventory",      icon: Archive },
  { path: "/admin/analytics",    label: "Analytics",         icon: BarChart2 },
  { path: "/admin/team",         label: "Team",              icon: UserCog },
  { path: "/admin/notifications",label: "Notifications",     icon: Bell },
  { path: "/admin/support",      label: "Support",           icon: LifeBuoy },
  { path: "/admin/settings",     label: "Settings",          icon: Settings },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  ops_manager: "Ops Manager",
  support: "Support",
  marketing: "Marketing",
  viewer: "Viewer",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function SidebarNav({
  collapsed,
  adminName,
  adminRole,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  adminName: string;
  adminRole: string;
  onToggle: () => void;
  onClose?: () => void;
}) {
  const [location, navigate] = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo area */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-slate-100", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 leading-tight truncate">Stegofy</p>
              <p className="text-[10px] font-semibold text-primary">Admin Panel</p>
            </div>
          </div>
        )}
        <button
          onClick={onClose ?? onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          {onClose
            ? <X className="w-4 h-4 text-slate-500" />
            : collapsed
              ? <ChevronRight className="w-4 h-4 text-slate-500" />
              : <ChevronLeft className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.path === "/admin"
            ? location === "/admin"
            : location.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose?.(); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                collapsed && "justify-center"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("w-4.5 h-4.5 flex-shrink-0", active ? "text-primary" : "text-slate-500")} style={{ width: 18, height: 18 }} />
              {!collapsed && (
                <span className={cn("text-sm font-semibold truncate", active ? "text-primary" : "")}>{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin profile + logout */}
      <div className={cn("border-t border-slate-100 px-2 py-3", collapsed ? "flex flex-col items-center gap-2" : "")}>
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-slate-400 truncate">Signed in as</p>
            <p className="text-sm font-bold text-slate-800 truncate">{adminName}</p>
            {adminRole && <p className="text-[11px] font-semibold text-primary mt-0.5">{roleLabel(adminRole)}</p>}
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-red-500 hover:bg-red-50 w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" style={{ width: 18, height: 18 }} />
          {!collapsed && <span className="text-sm font-semibold">Sign out</span>}
        </button>
      </div>
    </div>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  adminName: string;
  adminRole: string;
}

export function AdminLayout({ children, adminName, adminRole }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const [location] = useLocation();

  const pageTitle = NAV_ITEMS.find((item) =>
    item.path === "/admin"
      ? location === "/admin"
      : location.startsWith(item.path)
  )?.label ?? "Admin";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex flex-col flex-shrink-0 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <SidebarNav
            collapsed={collapsed}
            adminName={adminName}
            adminRole={adminRole}
            onToggle={() => setCollapsed((v) => !v)}
          />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 lg:hidden transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarNav
          collapsed={false}
          adminName={adminName}
          adminRole={adminRole}
          onToggle={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center gap-4 px-4 md:px-6 h-14 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{pageTitle}</h1>
          </div>

          {/* Top-right: name, role, logout */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-xs font-bold text-slate-800 leading-tight">{adminName}</p>
              {adminRole && <p className="text-[10px] font-semibold text-primary">{roleLabel(adminRole)}</p>}
            </div>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
