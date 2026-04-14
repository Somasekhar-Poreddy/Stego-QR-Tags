import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useSessionKeepalive } from "@/hooks/useSessionKeepalive";
import { SessionErrorBoundary } from "@/admin/SessionErrorBoundary";
import { AUTH_EXPIRED_EVENT } from "@/lib/adminAuth";
import { useAuth } from "@/app/context/AuthContext";

import { DashboardScreen }       from "@/admin/screens/DashboardScreen";
import { UsersScreen }           from "@/admin/screens/UsersScreen";
import { QRCodesScreen }         from "@/admin/screens/QRCodesScreen";
import { ContactRequestsScreen } from "@/admin/screens/ContactRequestsScreen";
import { ProductsScreen }        from "@/admin/screens/ProductsScreen";
import { OrdersScreen }          from "@/admin/screens/OrdersScreen";
import { InventoryScreen }       from "@/admin/screens/InventoryScreen";
import { AnalyticsScreen }       from "@/admin/screens/AnalyticsScreen";
import { TeamScreen }            from "@/admin/screens/TeamScreen";
import { NotificationsScreen }   from "@/admin/screens/NotificationsScreen";
import { SupportScreen }         from "@/admin/screens/SupportScreen";
import { SettingsScreen }        from "@/admin/screens/SettingsScreen";
import { VisitorLogScreen }     from "@/admin/screens/VisitorLogScreen";

interface AdminInfo {
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
}

const ROUTE_PERMISSIONS: { path: string; permissionKey?: string }[] = [
  { path: "/admin/users",          permissionKey: "manage_users" },
  { path: "/admin/qr-codes",       permissionKey: "manage_qr_codes" },
  { path: "/admin/requests",       permissionKey: "manage_support" },
  { path: "/admin/products",       permissionKey: "manage_products" },
  { path: "/admin/orders",         permissionKey: "manage_orders" },
  { path: "/admin/inventory",      permissionKey: "manage_inventory" },
  { path: "/admin/analytics",      permissionKey: "view_analytics" },
  { path: "/admin/visitor-log",    permissionKey: "view_analytics" },
  { path: "/admin/team",           permissionKey: "manage_team" },
  { path: "/admin/notifications",  permissionKey: "send_notifications" },
  { path: "/admin/support",        permissionKey: "manage_support" },
  { path: "/admin/settings",       permissionKey: "manage_settings" },
];

function isPathAllowed(
  pathname: string,
  role: string,
  permissions: Record<string, boolean>,
): boolean {
  if (role === "super_admin") return true;
  const match = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.path));
  if (!match) return true;
  if (!match.permissionKey) return true;
  return permissions[match.permissionKey] === true;
}

export function AdminRouter() {
  const [location, navigate] = useLocation();
  const [checking, setChecking]   = useState(true);
  const [adminInfo, setAdminInfo] = useState<AdminInfo>({
    name: "", email: "", role: "", permissions: {},
  });

  // Session keepalive: refreshes on tab focus + auth events + periodic interval.
  // `refreshKey` increments after each TOKEN_REFRESHED event — used as a `key`
  // on the route tree so screens automatically remount and re-fetch data.
  const { sessionOk, reconnecting, refreshKey } = useSessionKeepalive();

  // Global auth-expired event listener: any async loading path that throws
  // AuthExpiredError dispatches AUTH_EXPIRED_EVENT on window. Centralising the
  // redirect here means individual screens do not need to import AuthExpiredError.
  useEffect(() => {
    const handler = () => navigate("/admin/login?reason=expired");
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/admin/login");
      return;
    }

    async function bootstrap() {
      let info: AdminInfo = {
        name:        user!.email?.split("@")[0] || "Admin",
        email:       user!.email || "",
        role:        "",
        permissions: {},
      };

      try {
        const { data } = await supabase
          .from("admin_users")
          .select("name, role, email, permissions")
          .eq("user_id", user!.id)
          .limit(1);

        const record = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (record) {
          info = {
            name:        record.name  || user!.email?.split("@")[0] || "Admin",
            email:       record.email || user!.email || "",
            role:        record.role  || "",
            permissions: (record.permissions as Record<string, boolean>) || {},
          };
        }
      } catch {
        // keep defaults
      }

      setAdminInfo(info);

      if (!isPathAllowed(location, info.role, info.permissions)) {
        navigate("/admin");
      }

      setChecking(false);
    }

    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (checking) return;
    if (!isPathAllowed(location, adminInfo.role, adminInfo.permissions)) {
      navigate("/admin");
    }
  }, [location, checking, adminInfo, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout
      adminName={adminInfo.name}
      adminRole={adminInfo.role}
      permissions={adminInfo.permissions}
    >
      {/* Amber banner shown while a visibility-triggered session refresh is in-flight */}
      {(reconnecting || !sessionOk) && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Reconnecting session…
        </div>
      )}

      {/*
        SessionErrorBoundary catches AuthExpiredError that bubbles up from
        any screen's render path. On auth error: auto-retries refreshSession()
        and remounts children on success; redirects to login on failure.
        The `key={refreshKey}` on the Switch causes all screens to remount
        (and re-fetch data) whenever the keepalive hook detects a successful
        TOKEN_REFRESHED event after a period of inactivity.
      */}
      <SessionErrorBoundary onExpired={() => navigate("/admin/login?reason=expired")}>
        <Switch key={refreshKey}>
          <Route path="/admin/users"         component={UsersScreen} />
          <Route path="/admin/qr-codes"      component={QRCodesScreen} />
          <Route path="/admin/requests"      component={ContactRequestsScreen} />
          <Route path="/admin/products"      component={ProductsScreen} />
          <Route path="/admin/orders"        component={OrdersScreen} />
          <Route path="/admin/inventory"     component={InventoryScreen} />
          <Route path="/admin/analytics"     component={AnalyticsScreen} />
          <Route path="/admin/team"          component={TeamScreen} />
          <Route path="/admin/notifications" component={NotificationsScreen} />
          <Route path="/admin/support"       component={SupportScreen} />
          <Route path="/admin/settings"      component={SettingsScreen} />
          <Route path="/admin/visitor-log"   component={VisitorLogScreen} />
          <Route                             component={DashboardScreen} />
        </Switch>
      </SessionErrorBoundary>
    </AdminLayout>
  );
}
