/* Shared types for the call/message Activity feed. The shape mirrors what
 * `backend/src/routes/activity.ts` returns. */

export type CallStatus =
  | "initiated"
  | "in_progress"
  | "completed"
  | "failed"
  | "disconnected";

export type MessageStatus = "queued" | "sent" | "delivered" | "failed";

export interface ActivityCall {
  kind: "call";
  id: string;
  qr_id: string | null;
  qr_name: string | null;
  caller_phone: string | null;
  callee_phone: string | null;
  status: CallStatus | string;
  duration_seconds: number | null;
  cost_paise: number | null;
  vehicle_last4: string | null;
  recording_url: string | null;
  provider: string;
  provider_call_id: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface ActivityMessage {
  kind: "message";
  id: string;
  qr_id: string | null;
  qr_name: string | null;
  recipient_phone: string | null;
  channel: string;
  provider: string;
  status: MessageStatus | string;
  template: string | null;
  payload_summary: string | null;
  cost_paise: number | null;
  error_code: string | null;
  error_message: string | null;
  fallback_from: string | null;
  created_at: string;
}

export type ActivityItem = ActivityCall | ActivityMessage;

export interface ActivityResponse {
  items: ActivityItem[];
  qr_count?: number;
}
