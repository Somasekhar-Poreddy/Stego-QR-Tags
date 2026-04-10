import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { supabase } from "@/lib/supabase";

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

interface AdminInfo {
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
}

// Maps each route path to its required permission key.
// Entries with no key (Dashboard) are always accessible.
const ROUTE_PERMISSIONS: { path: string; permissionKey?: string }[] = [
  { path: "/admin/users",          permissionKey: "manage_users" },
  { path: "/admin/qr-codes",       permissionKey: "manage_qr_codes" },
  { path: "/admin/requests",       permissionKey: "manage_support" },
  { path: "/admin/products",       permissionKey: "manage_products" },
  { path: "/admin/orders",         permissionKey: "manage_orders" },
  { path: "/admin/inventory",      permissionKey: "manage_inventory" },
  { path: "/admin/analytics",      permissionKey: "view_analytics" },
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
  if (!match) return true; // Dashboard or unknown — always allow
  if (!match.permissionKey) return true;
  return permissions[match.permissionKey] === true;
}

export function AdminRouter() {
  const [location, navigate] = useLocation();
  const [checking, setChecking]   = useState(true);
  const [adminInfo, setAdminInfo] = useState<AdminInfo>({
    name: "", email: "", role: "", permissions: {},
  });

  // Bootstrap: verify session and load permissions once on mount.
  useEffect(() => {
    async function bootstrap() {
      // getSession() reads from localStorage — instant, no network required.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/admin/login");
        return;
      }

      const user = session.user;
      let info: AdminInfo = {
        name:        user.email?.split("@")[0] || "Admin",
        email:       user.email || "",
        role:        "",
        permissions: {},
      };

      // Fetch name, role, email, permissions from admin_users for display + enforcement.
      try {
        const { data } = await supabase
          .from("admin_users")
          .select("name, role, email, permissions")
          .eq("user_id", user.id)
          .limit(1);

        const record = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (record) {
          info = {
            name:        record.name  || user.email?.split("@")[0] || "Admin",
            email:       record.email || user.email || "",
            role:        record.role  || "",
            permissions: (record.permissions as Record<string, boolean>) || {},
          };
        }
      } catch {
        // keep defaults
      }

      setAdminInfo(info);

      // Route guard: redirect to dashboard if current path is not permitted.
      if (!isPathAllowed(location, info.role, info.permissions)) {
        navigate("/admin");
      }

      setChecking(false);
    }

    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuous guard: re-check on every in-app location change after bootstrap.
  useEffect(() => {
    if (checking) return; // skip until permissions are loaded
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
      <Switch>
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
        <Route                             component={DashboardScreen} />
      </Switch>
    </AdminLayout>
  );
}
