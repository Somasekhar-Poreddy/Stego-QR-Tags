import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Shield } from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { isAdmin, getAdminUser } from "@/lib/auth";
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

type AdminState = "loading" | "denied" | "ready";

function AdminLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-violet-600 gap-4">
      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
        <Shield className="w-8 h-8 text-white" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center gap-5">
      <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center">
        <Shield className="w-10 h-10 text-red-500" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          You don't have permission to access the admin panel. Please contact a super admin.
        </p>
      </div>
      <a
        href="/"
        className="px-6 py-3 bg-primary text-white font-semibold rounded-2xl text-sm hover:bg-primary/90 transition-colors"
      >
        Go to Homepage
      </a>
    </div>
  );
}

export function AdminRouter() {
  const [adminState, setAdminState] = useState<AdminState>("loading");
  const [adminName, setAdminName] = useState("Admin");
  const [, navigate] = useLocation();

  useEffect(() => {
    let mounted = true;

    const timeout = setTimeout(() => {
      if (mounted) setAdminState("denied");
    }, 10000);

    async function checkAccess() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) {
          if (mounted) navigate("/");
          return;
        }

        const appRole = (user.app_metadata as Record<string, string> | undefined)?.role;
        const ok = await isAdmin(user.id, appRole);
        if (!ok) {
          if (mounted) setAdminState("denied");
          return;
        }

        const adminUser = await getAdminUser(user.id);
        if (mounted) {
          setAdminName(adminUser?.name || user.email || "Admin");
          setAdminState("ready");
        }
      } catch {
        if (mounted) setAdminState("denied");
      } finally {
        clearTimeout(timeout);
      }
    }

    checkAccess();
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  if (adminState === "loading") return <AdminLoader />;
  if (adminState === "denied") return <AccessDenied />;

  return (
    <AdminLayout adminName={adminName}>
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
