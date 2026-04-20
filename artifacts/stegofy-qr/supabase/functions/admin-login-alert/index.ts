// =========================================================================
// Supabase Edge Function: admin-login-alert
// =========================================================================
//
// Triggered for every successful admin login. Compares the incoming login's
// device_fingerprint to the most recent prior admin_login event for the
// same user. If the fingerprint is new (i.e. the admin signed in from a
// device they haven't used before), sends a notification email so account
// compromise is visible within minutes.
//
// HOW TO DEPLOY
// -------------
// 1. Install the Supabase CLI: `npm i -g supabase`
// 2. From the project root:
//      supabase functions new admin-login-alert
//    then replace the generated index.ts with this file.
// 3. Configure the email provider env vars in the Supabase Dashboard:
//      Settings → Edge Functions → Secrets
//      RESEND_API_KEY=re_xxxxxx
//      EMAIL_FROM=alerts@yourdomain.com
//    (or swap the sendEmail() implementation below for SendGrid / Postmark
//    / SMTP — the rest of the function is provider-agnostic.)
// 4. Deploy: `supabase functions deploy admin-login-alert`
// 5. Wire up the trigger. Two options:
//    A. DATABASE WEBHOOK (preferred — fires on every INSERT):
//       Supabase Dashboard → Database → Webhooks → "New webhook"
//       Source table:  user_activity_logs
//       Events:        Insert
//       URL:           https://<project>.functions.supabase.co/admin-login-alert
//       HTTP headers:  Authorization: Bearer <service-role-key>
//    B. CALL DIRECTLY from the frontend after a successful admin login
//       via supabase.functions.invoke("admin-login-alert", { body: {...} }).
//       Less reliable (depends on the browser staying open) but no DB
//       webhook setup required.
//
// IMPORTANT — BEFORE ENABLING IN PRODUCTION
// -----------------------------------------
// - Confirm this code path runs only for `event_type = 'admin_login'` rows.
//   Filter inside the function (already done below) AND in the webhook if
//   your provider supports it, so you don't email-spam on every user login.
// - Add a rate limit per email (e.g. max 1 alert / 5 min) to defend against
//   alert-flood scenarios.
// - Make the From: address SPF/DKIM-aligned with your domain or providers
//   may dump alerts to spam.
// =========================================================================

// @ts-expect-error — Deno globals are present at runtime in Supabase Edge Functions.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error — same
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error — Deno provided at runtime
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// @ts-expect-error
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// @ts-expect-error
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@example.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface ActivityRow {
  user_id: string;
  event_type: string;
  device_fingerprint: string | null;
  metadata: Record<string, string | null> | null;
  created_at: string;
}

interface WebhookPayload {
  // Database-webhook shape:
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: ActivityRow;
  // Direct-invocation shape:
  row?: ActivityRow;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("[admin-login-alert] RESEND_API_KEY not set — skipping send.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[admin-login-alert] Email send failed:", res.status, body);
  }
}

async function getAdminEmail(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("admin_users")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.email ?? null;
}

async function isNewDevice(userId: string, fingerprint: string): Promise<boolean> {
  if (!fingerprint) return false; // can't compare without one
  const { data } = await supabase
    .from("user_activity_logs")
    .select("device_fingerprint")
    .eq("user_id", userId)
    .eq("event_type", "admin_login")
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data?.length) return true; // first ever admin login — alert
  return !data.some((row) => row.device_fingerprint === fingerprint);
}

serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const row = payload.record ?? payload.row;
    if (!row || row.event_type !== "admin_login") {
      return new Response("ignored", { status: 200 });
    }

    const newDevice = await isNewDevice(row.user_id, row.device_fingerprint ?? "");
    if (!newDevice) return new Response("known device", { status: 200 });

    const adminEmail = await getAdminEmail(row.user_id);
    if (!adminEmail) return new Response("no admin email on file", { status: 200 });

    const ua = row.metadata?.user_agent ?? "Unknown browser";
    const platform = row.metadata?.platform ?? "Unknown platform";
    const when = new Date(row.created_at).toUTCString();

    await sendEmail(
      adminEmail,
      "New Stegofy admin sign-in detected",
      `
        <h2>New admin sign-in to Stegofy</h2>
        <p>We noticed a sign-in to your admin account from a device we haven't seen before.</p>
        <ul>
          <li><strong>Time (UTC):</strong> ${when}</li>
          <li><strong>Browser:</strong> ${ua}</li>
          <li><strong>Platform:</strong> ${platform}</li>
        </ul>
        <p>If this was you, no action is needed.</p>
        <p>If this <strong>wasn't</strong> you, change your password immediately and review your active sessions in the admin Settings page.</p>
      `,
    );

    return new Response("alerted", { status: 200 });
  } catch (e) {
    console.error("[admin-login-alert] error:", e);
    return new Response("error", { status: 500 });
  }
});
