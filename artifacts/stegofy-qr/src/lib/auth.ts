import { supabase } from "@/lib/supabase";

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: Record<string, boolean>;
  created_at: string;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function isAdmin(
  userId: string,
  appMetadataRole?: string
): Promise<boolean> {
  if (!userId) return false;

  const adminRoles = ["super_admin", "admin", "ops_manager", "support", "marketing", "viewer"];

  if (appMetadataRole && adminRoles.includes(appMetadataRole)) {
    return true;
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", userId)
        .limit(1),
      5000
    );
    if (error) {
      console.warn("Admin check failed:", error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.warn("Admin check timed out or threw:", err);
    return false;
  }
}

export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", userId)
        .limit(1),
      5000
    );
    if (error || !data || data.length === 0) return null;
    return data[0] as AdminUser;
  } catch {
    return null;
  }
}
