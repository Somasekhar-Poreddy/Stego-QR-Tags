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

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function isUserIdAllowlisted(userId: string): boolean {
  const raw = import.meta.env.VITE_ADMIN_USER_IDS as string | undefined;
  if (!raw) return false;
  return raw.split(",").map((id) => id.trim()).includes(userId.trim());
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  if (isUserIdAllowlisted(userId)) {
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
