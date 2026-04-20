import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation } from "wouter";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useSessionKeepalive } from "@/hooks/useSessionKeepalive";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useAbsoluteSessionCap } from "@/hooks/useAbsoluteSessionCap";
import { IdleWarningModal } from "@/admin/components/IdleWarningModal";
import { SessionErrorBoundary } from "@/admin/SessionErrorBoundary";
import { MfaChallengeScreen } from "@/admin/MfaChallengeScreen";
import { MfaEnrollScreen } from "@/admin/MfaEnrollScreen";
import { useAuth } from "@/app/context/AuthContext";

import { DashboardScreen } from "@/admin/screens/DashboardScreen";
import { UsersScreen } from "@/admin/screens/UsersScreen";
import { QRCodesScreen } from "@/admin/screens/QRCodesScreen";
import { ContactRequestsScreen } from "@/admin/screens/ContactRequestsScreen";
import { ProductsScreen } from "@/admin/screens/ProductsScreen";
import { OrdersScreen } from "@/admin/screens/OrdersScreen";
import { InventoryScreen } from "@/admin/screens/InventoryScreen";
import { AnalyticsScreen } from "@/admin/screens/AnalyticsScreen";
import { TeamScreen } from "@/admin/screens/TeamScreen";
import { NotificationsScreen } from "@/admin/screens/NotificationsScreen";
import { SupportScreen } from "@/admin/screens/SupportScreen";
import { SettingsScreen } from "@/admin/screens/SettingsScreen";
import { VisitorLogScreen } from "@/admin/screens/VisitorLogScreen";
import { CommunicationsScreen } from "@/admin/screens/CommunicationsScreen";

interface AdminInfo {
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
}

let _cachedAdminInfo: AdminInfo | null = null;
let _cachedUserId: string | null = null;

// localStorage-backed cache so a newly-opened tab can render the correct
// admin name instantly, even before its own admin_users query returns — and
// so a tab whose query fails (lock contention / JWT race) doesn't fall back
// to the email-prefix display name when a sibling tab already knows the real
// one.
const ADMIN_INFO_STORAGE_PREFIX = "stegofy_admin_info_v1:";

function readAdminInfoFromStorage(userId: string): AdminInfo | null {
  try {
    const raw = localStorage.getItem(ADMIN_INFO_STORAGE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.name === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.role === "string" &&
      parsed.permissions &&
      typeof parsed.permissions === "object"
    ) {
      return parsed as AdminInfo;
    }
    return null;
  } catch {
    return null;
  }
}

function writeAdminInfoToStorage(userId: string, info: AdminInfo) {
  try {
    localStorage.setItem(ADMIN_INFO_STORAGE_PREFIX + userId, JSON.stringify(info));
  } catch {
    // quota / privacy mode — ignore
  }
}

function clearAdminInfoFromStorage(userId: string | null) {
  if (!userId) return;
  try {
    localStorage.removeItem(ADMIN_INFO_STORAGE_PREFIX + userId);
  } catch {}
}

function isLockContentionError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message?.toLowerCase?.() ?? "";
  return msg.includes("lock") && (msg.includes("stole") || msg.includes("released"));
}

const ROUTE_PERMISSIONS: { path: string; permissionKey?: string }[] = [
  { path: "/admin/users", permissionKey: "manage_users" },
  { path: "/admin/qr-codes", permissionKey: "manage_qr_codes" },
  { path: "/admin/requests", permissionKey: "manage_support" },
  { path: "/admin/products", permissionKey: "manage_products" },
  { path: "/admin/orders", permissionKey: "manage_orders" },
  { path: "/admin/inventory", permissionKey: "manage_inventory" },
  { path: "/admin/analytics", permissionKey: "view_analytics" },
  { path: "/admin/communications", permissionKey: "view_analytics" },
  { path: "/admin/visitor-log", permissionKey: "view_analytics" },
  { path: "/admin/team", permissionKey: "manage_team" },
  { path: "/admin/notifications", permissionKey: "send_notifications" },
  { path: "/admin/support", permissionKey: "manage_support" },
  { path: "/admin/settings", permissionKey: "manage_settings" },
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

// Idle window: 30 minutes of no activity → forced logout. Last 60s shows
// the warning modal so the admin can stay signed in if they're still there.
const IDLE_LOGOUT_MS = 30 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
// Absolute cap: even an actively-clicking admin gets booted after 12 hours.
const ABSOLUTE_CAP_MS = 12 * 60 * 60 * 1000;

export function AdminRouter() {
  const [location, navigate] = useLocation();
  const { user, loading: authLoading, recovering, logout } = useAuth();
  const { sessionOk, reconnecting } = useSessionKeepalive();

  // Cache lookup precedence: module-level (same tab, instant) → localStorage
  // (different tab, same browser window — still instant and avoids the
  // "fallback name during race" bug).
  const storageSeed = user?.id ? readAdminInfoFromStorage(user.id) : null;
  const moduleCache =
    _cachedAdminInfo !== null && _cachedUserId === (user?.id ?? null)
      ? _cachedAdminInfo
      : null;
  const seedInfo = moduleCache ?? storageSeed;

  const cacheHit = seedInfo !== null;
  const [checking, setChecking] = useState(!cacheHit);
  const [adminInfo, setAdminInfo] = useState<AdminInfo>(
    seedInfo ?? { name: "", email: "", role: "", permissions: {} },
  );

  // MFA gate state. `unknown` means we haven't checked yet; `ok` means the
  // session is at AAL2 (or MFA isn't required for this role); `challenge`
  // means MFA is enrolled but not satisfied for this session; `enroll` means
  // a super_admin needs to set up MFA for the first time.
  const [mfaState, setMfaState] = useState<"unknown" | "ok" | "challenge" | "enroll">("unknown");

  // Auto sign-out + redirect helper, shared by idle timeout, absolute cap,
  // and the warning-modal "Sign out" button.
  const forceSignOut = useCallback(
    async (reason: "idle" | "absolute" | "manual" = "idle") => {
      const signedOutUserId = user?.id ?? _cachedUserId;
      // Go through AuthContext.logout so explicitLogoutRef is set. Without
      // that flag the user-side SIGNED_OUT handler tries to refreshSession
      // for ~1–3s before giving up, which makes a subsequent user login
      // appear to hang.
      try {
        await logout();
      } catch {
        // Fallback: if logout() threw for any reason, at least kill the
        // session so the admin isn't left signed-in on the login screen.
        try { await supabase.auth.signOut(); } catch {}
      }
      // Clear admin info cache so the next login re-bootstraps cleanly.
      _cachedAdminInfo = null;
      _cachedUserId = null;
      clearAdminInfoFromStorage(signedOutUserId ?? null);
      navigate(`/admin/login?reason=${reason}`);
    },
    [navigate, user?.id, logout],
  );

  // Tier 1.1 — idle logout. Only enabled once we've actually got an admin
  // user; otherwise the hook would tick on the login screen for no reason.
  const enabledIdle = !!user && !authLoading && !checking;
  const { warning: idleWarning, secondsLeft, reset: resetIdle } = useIdleLogout({
    idleMs: IDLE_LOGOUT_MS,
    warningMs: IDLE_WARNING_MS,
    enabled: enabledIdle,
    onLogout: () => forceSignOut("idle"),
  });

  // Tier 1.2 — absolute session cap.
  useAbsoluteSessionCap({
    capMs: ABSOLUTE_CAP_MS,
    enabled: enabledIdle,
    onExpired: () => forceSignOut("absolute"),
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (recovering) return;
      // Before redirecting, confirm there is genuinely no Supabase session.
      // This guards against the race where AdminLogin navigates to /admin
      // before AuthContext has finished processing the SIGNED_IN event.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) navigate("/admin/login");
        // If a session exists, AuthContext will finish building the user
        // and re-trigger this effect — no redirect needed yet.
      });
      return;
    }

    if (_cachedUserId !== user.id) {
      setChecking(true);
    }

    // Capture the (already null-checked above) user into a local so the
    // narrowing survives across the async function boundary inside bootstrap.
    const currentUser = user;

    // Retry the admin_users lookup once after a short delay if we hit the
    // Supabase multi-tab lock error — a sibling tab refreshing the token
    // can briefly invalidate ours, and by the time we retry the other tab
    // has finished.
    async function lookupAdminRecord(): Promise<
      | { ok: true; record: { name: string; role: string; email: string; permissions: Record<string, boolean> } | null }
      | { ok: false; reason: "lock" | "error" }
    > {
      try {
        const { data, error } = await supabase
          .from("admin_users")
          .select("name, role, email, permissions")
          .eq("user_id", currentUser.id)
          .limit(1);
        if (error) {
          return { ok: false, reason: isLockContentionError(error) ? "lock" : "error" };
        }
        const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!first) return { ok: true, record: null };
        return {
          ok: true,
          record: {
            name: (first.name as string) ?? "",
            role: (first.role as string) ?? "",
            email: (first.email as string) ?? "",
            permissions: (first.permissions as Record<string, boolean>) ?? {},
          },
        };
      } catch (e) {
        return { ok: false, reason: isLockContentionError(e) ? "lock" : "error" };
      }
    }

    async function bootstrap() {
      // Env-based allowlist, mirrors the Express backend — lets super-admins
      // predate the admin_users table / be the initial bootstrap admin.
      const allowedIds = ((import.meta.env.VITE_ADMIN_USER_IDS ?? "") as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const isAllowlisted = !!currentUser.id && allowedIds.includes(currentUser.id);

      // Start one: first attempt.
      let result = await lookupAdminRecord();

      // If it's lock-contention, retry once after 600ms.
      if (!result.ok && result.reason === "lock") {
        await new Promise((r) => setTimeout(r, 600));
        result = await lookupAdminRecord();
      }

      const verifiedAdmin = result.ok && result.record !== null;
      const lookupFailed = !result.ok;

      // Build the info object, in priority order:
      //   1. the admin_users row if we just loaded it
      //   2. cached info from localStorage (set by a previous successful load
      //      in THIS or a sibling tab) — preserves display name on transient
      //      query failure
      //   3. the email-prefix fallback (last resort)
      const cachedInfo = currentUser.id ? readAdminInfoFromStorage(currentUser.id) : null;

      let info: AdminInfo;
      if (result.ok && result.record) {
        info = {
          name: result.record.name || currentUser.email?.split("@")[0] || "Admin",
          email: result.record.email || currentUser.email || "",
          role: result.record.role || "",
          permissions: result.record.permissions || {},
        };
      } else if (cachedInfo) {
        // Keep the last-known-good info rather than degrade to email prefix.
        info = cachedInfo;
      } else {
        info = {
          name: currentUser.email?.split("@")[0] || "Admin",
          email: currentUser.email || "",
          role: isAllowlisted ? "super_admin" : "",
          permissions: {},
        };
      }

      // ── ADMIN GATE ──────────────────────────────────────────────────
      // If the user is neither in admin_users nor on the env allowlist,
      // refuse access. Lookup-failure + no cache + no allowlist = refuse
      // (fail closed). If the lookup failed but we have cached info from a
      // previous success OR the user is allowlisted, trust that — the
      // lookup failure is almost certainly transient lock contention.
      const hasAcceptableCredentials =
        verifiedAdmin || isAllowlisted || (lookupFailed && cachedInfo !== null);

      if (!hasAcceptableCredentials) {
        try {
          await logout();
        } catch {
          try { await supabase.auth.signOut(); } catch {}
        }
        _cachedAdminInfo = null;
        _cachedUserId = null;
        clearAdminInfoFromStorage(currentUser.id ?? null);
        const reason = lookupFailed ? "admin-check-failed" : "not-admin";
        navigate(`/admin/login?reason=${reason}`);
        return;
      }

      // Allowlisted super-admins who aren't in admin_users get super_admin
      // role by default so the permission model works consistently. Only
      // apply when the DB didn't give us a real record.
      if (isAllowlisted && !verifiedAdmin && !info.role) {
        info = { ...info, role: "super_admin" };
      }

      _cachedAdminInfo = info;
      _cachedUserId = currentUser.id ?? null;
      if (currentUser.id && (verifiedAdmin || isAllowlisted)) {
        // Persist so sibling tabs see the real name instantly.
        writeAdminInfoToStorage(currentUser.id, info);
      }
      setAdminInfo(info);

      if (!isPathAllowed(location, info.role, info.permissions)) {
        navigate("/admin");
      }

      setChecking(false);
    }

    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, recovering]);

  useEffect(() => {
    if (checking) return;
    if (!isPathAllowed(location, adminInfo.role, adminInfo.permissions)) {
      navigate("/admin");
    }
  }, [location, checking, adminInfo, navigate]);

  // MFA enforcement. Runs once we know the admin role.
  // - super_admin must have a verified TOTP factor.
  // - any role that has enrolled MFA must satisfy it for this session.
  useEffect(() => {
    if (checking || !user) return;

    let cancelled = false;
    async function evaluateMfa() {
      try {
        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;

        // currentLevel === 'aal2' means MFA already satisfied for this session.
        if (aal.data?.currentLevel === "aal2") {
          setMfaState("ok");
          return;
        }

        // currentLevel === 'aal1' but nextLevel === 'aal2' means MFA is
        // enrolled but not satisfied — challenge required.
        if (aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2") {
          setMfaState("challenge");
          return;
        }

        // No MFA enrolled. Force enrollment for super_admin only; let other
        // roles in without it (they can opt-in later via Settings).
        if (adminInfo.role === "super_admin") {
          setMfaState("enroll");
        } else {
          setMfaState("ok");
        }
      } catch {
        // If the MFA check itself fails we don't want to lock everyone out
        // of the dashboard — fall open and let the regular session checks
        // handle the auth path.
        if (!cancelled) setMfaState("ok");
      }
    }

    evaluateMfa();
    return () => {
      cancelled = true;
    };
  }, [checking, user?.id, adminInfo.role]);

  if (checking || mfaState === "unknown") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mfaState === "challenge") {
    return <MfaChallengeScreen onVerified={() => setMfaState("ok")} />;
  }

  if (mfaState === "enroll") {
    return <MfaEnrollScreen onEnrolled={() => setMfaState("ok")} />;
  }

  return (
    <AdminLayout
      adminName={adminInfo.name}
      adminRole={adminInfo.role}
      permissions={adminInfo.permissions}
    >
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

      <IdleWarningModal
        open={idleWarning}
        secondsLeft={secondsLeft}
        onStay={resetIdle}
        onLogout={() => forceSignOut("manual")}
      />

      <SessionErrorBoundary onExpired={() => navigate("/admin/login?reason=expired")}>
        <Switch>
          <Route path="/admin/users" component={UsersScreen} />
          <Route path="/admin/qr-codes" component={QRCodesScreen} />
          <Route path="/admin/requests" component={ContactRequestsScreen} />
          <Route path="/admin/products" component={ProductsScreen} />
          <Route path="/admin/orders" component={OrdersScreen} />
          <Route path="/admin/inventory" component={InventoryScreen} />
          <Route path="/admin/analytics" component={AnalyticsScreen} />
          <Route path="/admin/communications" component={CommunicationsScreen} />
          <Route path="/admin/team" component={TeamScreen} />
          <Route path="/admin/notifications" component={NotificationsScreen} />
          <Route path="/admin/support" component={SupportScreen} />
          <Route path="/admin/settings" component={SettingsScreen} />
          <Route path="/admin/visitor-log" component={VisitorLogScreen} />
          <Route component={DashboardScreen} />
        </Switch>
      </SessionErrorBoundary>
    </AdminLayout>
  );
}