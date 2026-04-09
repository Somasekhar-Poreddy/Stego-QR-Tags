import { supabase } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  age_group: string | null;
  gender: string | null;
  created_at?: string;
  last_active?: string | null;
  status?: string | null;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function createUserProfile(profile: Partial<UserProfile>): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_profiles").insert(profile);
  return { error: error?.message ?? null };
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_profiles").upsert({ id: userId, ...updates });
  return { error: error?.message ?? null };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as UserProfile[];
}

export async function blockUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_profiles")
    .update({ status: "blocked" })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

export async function unblockUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_profiles")
    .update({ status: "active" })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

export async function deleteUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("id", userId);
  return { error: error?.message ?? null };
}
