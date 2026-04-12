import { supabase } from "@/lib/supabase";

export interface ContactRequest {
  id?: string;
  qr_id: string;
  intent: string | null;
  message: string | null;
  action_type: string | null;
  requester_phone: string | null;
  ip_address?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scanner_name?: string | null;
  status: string;
  created_at?: string;
}

export async function createContactRequest(request: Omit<ContactRequest, "id" | "created_at">): Promise<{ error: string | null }> {
  const { error } = await supabase.from("contact_requests").insert(request);
  return { error: error?.message ?? null };
}

export async function getAllContactRequests(): Promise<ContactRequest[]> {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ContactRequest[];
}

export async function getContactRequestsByQR(qrId: string): Promise<ContactRequest[]> {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("qr_id", qrId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ContactRequest[];
}

export async function resolveContactRequest(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("contact_requests")
    .update({ status: "resolved" })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function rejectContactRequest(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("contact_requests")
    .update({ status: "rejected" })
    .eq("id", id);
  return { error: error?.message ?? null };
}
