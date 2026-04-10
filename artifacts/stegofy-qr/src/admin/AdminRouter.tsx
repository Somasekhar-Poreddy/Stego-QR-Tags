import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
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
}

export function AdminRouter() {
  const [adminInfo, setAdminInfo] = useState<AdminInfo>({ name: "Guest", email: "", role: "" });

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setAdminInfo({ name: "Guest", email: "", role: "" });
          return;
        }

        const { data } = await supabase
          .from("admin_users")
          .select("name, role, email")
          .eq("user_id", user.id)
          .limit(1);

        const record = Array.isArray(data) && data.length > 0 ? data[0] : null;
        setAdminInfo({
          name: record?.name || user.email?.split("@")[0] || "Admin",
          email: record?.email || user.email || "",
          role: record?.role || "",
        });
      } catch {
      }
    }
    loadSession();
  }, []);

  return (
    <AdminLayout adminName={adminInfo.name} adminRole={adminInfo.role}>
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
