import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/apiUrl";
import { ensureFreshSession } from "@/lib/adminAuth";
import type { ActivityResponse } from "@/types/activity";

async function bearerToken(): Promise<string | null> {
  await ensureFreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function getJson<T>(path: string): Promise<T> {
  const token = await bearerToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json() as { error?: string };
      if (body?.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function getMyActivity(limit = 50): Promise<ActivityResponse> {
  return getJson<ActivityResponse>(`/api/me/activity?limit=${limit}`);
}

export async function getQRActivity(qrId: string, limit = 50): Promise<ActivityResponse> {
  return getJson<ActivityResponse>(`/api/me/qr/${encodeURIComponent(qrId)}/activity?limit=${limit}`);
}

export async function getUserActivityAdmin(userId: string, limit = 100): Promise<ActivityResponse> {
  return getJson<ActivityResponse>(`/api/admin/users/${encodeURIComponent(userId)}/activity?limit=${limit}`);
}
