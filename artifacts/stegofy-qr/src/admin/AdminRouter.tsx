import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Shield } from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { AdminDashboard } from "@/admin/screens/AdminDashboard";
import { isAdmin, getAdminUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
      <p className="text-lg font-bold text-slate-800 mb-2">{title}</p>
      <p className="text-sm text-slate-500">This module will be built in Task #4 (Super Admin Panel).</p>
    </div>
  );
}

export function AdminRouter() {
  const [adminState, setAdminState] = useState<AdminState>("loading");
  const [adminName, setAdminName] = useState("Admin");
  const [, navigate] = useLocation();

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) navigate("/");
          return;
        }

        const ok = await isAdmin(user.id);
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
      }
    }

    checkAccess();
    return () => { mounted = false; };
  }, []);

  if (adminState === "loading") return <AdminLoader />;
  if (adminState === "denied") return <AccessDenied />;

  return (
    <AdminLayout adminName={adminName}>
      <Switch>
        <Route path="/admin/users"         component={() => <PlaceholderScreen title="Users" />} />
        <Route path="/admin/qr-codes"      component={() => <PlaceholderScreen title="QR Codes" />} />
        <Route path="/admin/requests"      component={() => <PlaceholderScreen title="Contact Requests" />} />
        <Route path="/admin/products"      component={() => <PlaceholderScreen title="Products" />} />
        <Route path="/admin/orders"        component={() => <PlaceholderScreen title="Orders" />} />
        <Route path="/admin/inventory"     component={() => <PlaceholderScreen title="QR Inventory" />} />
        <Route path="/admin/analytics"     component={() => <PlaceholderScreen title="Analytics" />} />
        <Route path="/admin/team"          component={() => <PlaceholderScreen title="Team" />} />
        <Route path="/admin/notifications" component={() => <PlaceholderScreen title="Notifications" />} />
        <Route path="/admin/support"       component={() => <PlaceholderScreen title="Support" />} />
        <Route path="/admin/settings"      component={() => <PlaceholderScreen title="Settings" />} />
        <Route                             component={AdminDashboard} />
      </Switch>
    </AdminLayout>
  );
}
