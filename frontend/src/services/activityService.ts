import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/apiUrl";
import { ensureFreshSession, isLockContentionError } from "@/lib/adminAuth";
import type { ActivityResponse } from "@/types/activity";

async function withLockRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt < retries && isLockContentionError(e)) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("withLockRetry: unreachable");
}

async function activityFetch(path: string): Promise<ActivityResponse> {
  return withLockRetry(async () => {
    await ensureFreshSession();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(apiUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-app-origin": typeof window !== "undefined" ? window.location.origin : "",
      },
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return (await res.json()) as ActivityResponse;
  });
}

export async function getMyActivity(limit = 50): Promise<ActivityResponse> {
  return activityFetch(`/api/me/activity?limit=${limit}`);
}

export async function getQRActivity(qrId: string, limit = 50): Promise<ActivityResponse> {
  return activityFetch(`/api/me/qr/${encodeURIComponent(qrId)}/activity?limit=${limit}`);
}

export async function getUserActivityAdmin(userId: string, limit = 100): Promise<ActivityResponse> {
  return activityFetch(`/api/admin/users/${encodeURIComponent(userId)}/activity?limit=${limit}`);
}
