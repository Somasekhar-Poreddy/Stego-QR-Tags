import { Switch, Route } from "wouter";
import { AdminLayout } from "@/admin/layout/AdminLayout";

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

export function AdminRouter() {
  return (
    <AdminLayout adminName="Super Admin">
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
