import { supabase } from "@/lib/supabase";

export interface QRPublicData {
  id: string;
  type: string;
  data: Record<string, string | boolean>;
  pin_code: string | null;
  is_active: boolean;
  allow_contact: boolean;
  strict_mode: boolean;
  emergency_contact: string | null;
  name: string | null;
  privacy?: Record<string, boolean>;
}

export interface QRCodeRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  status: string;
  primary_contact: string;
  privacy_mode: string;
  pin_code: string | null;
  display_code: string | null;
  data: Record<string, unknown>;
  qr_url: string | null;
  privacy: Record<string, boolean> | null;
  is_active: boolean | null;
  allow_contact: boolean | null;
  strict_mode: boolean | null;
  whatsapp_enabled: boolean | null;
  allow_video_call: boolean | null;
  secondary_phone: string | null;
  emergency_contact: string | null;
  call_masking_disabled: boolean | null;
  scans: number | null;
  created_at: string;
}

export async function getQRById(id: string): Promise<QRPublicData | null> {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, type, data, pin_code, is_active, allow_contact, strict_mode, emergency_contact, name, privacy")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as QRPublicData;
}

export async function getUserQRCodes(userId: string): Promise<QRCodeRow[]> {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as QRCodeRow[];
}

export async function createQRCode(payload: Partial<QRCodeRow>): Promise<{ error: string | null }> {
  const { error } = await supabase.from("qr_codes").insert(payload);
  return { error: error?.message ?? null };
}

export async function updateQRCode(id: string, updates: Partial<QRCodeRow>): Promise<{ error: string | null }> {
  const { error } = await supabase.from("qr_codes").update(updates).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteQRCode(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("qr_codes").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function getAllQRCodes(): Promise<QRCodeRow[]> {
  const { data, error } = await supabase
    .from("qr_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as QRCodeRow[];
}

export async function disableQRCode(id: string): Promise<{ error: string | null }> {
  return updateQRCode(id, { status: "inactive", is_active: false } as Partial<QRCodeRow>);
}
