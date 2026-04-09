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

export async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Admin check failed:", error.message);
    return false;
  }
  return !!data;
}

export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdminUser;
}
