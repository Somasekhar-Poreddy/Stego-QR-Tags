// =========================================================================
// Supabase Edge Function: inventory-low-stock-alert
// =========================================================================
//
// Fires whenever a row is inserted into `inventory_low_stock_alerts`. Looks
// up the category's alert recipient (or falls back to all super_admins) and
// sends an email via Resend with a one-click CTA to the admin deep-link
// `/admin/inventory?restock=<category>` — which pre-fills the Bulk-Generate
// modal with the category's configured reorder count.
//
// HOW TO DEPLOY
// -------------
// 1. From the project root:
//      supabase functions new inventory-low-stock-alert
//    then replace the generated index.ts with this file.
// 2. Confirm secrets in Supabase Dashboard → Edge Functions → Secrets:
//      RESEND_API_KEY (reused from admin-login-alert)
//      EMAIL_FROM     (reused)
//      ADMIN_APP_URL  (e.g. https://stegofy.app) — used for the CTA link
// 3. Deploy: `supabase functions deploy inventory-low-stock-alert`
// 4. Wire the trigger: Supabase Dashboard → Database → Webhooks → New
//      Source table: inventory_low_stock_alerts
//      Events:       Insert
//      URL:          https://<project>.functions.supabase.co/inventory-low-stock-alert
//      Headers:      Authorization: Bearer <service-role-key>
//
// DB-level dedup is handled by `check_inventory_low_stock()`: an alert is
// only inserted when `last_alerted_at` is older than 24h for that category,
// so this function will not email-spam even when the cron job runs every
// 30 minutes.
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
// @ts-expect-error
const ADMIN_APP_URL = Deno.env.get("ADMIN_APP_URL") ?? "https://stegofy.app";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface AlertRow {
  id: string;
  category: string;
  current_stock: number;
  threshold: number;
  status: string;
  created_at: string;
}

interface WebhookPayload {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: AlertRow;
  row?: AlertRow;
}

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("[inventory-low-stock-alert] RESEND_API_KEY not set — skipping send.");
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
    console.error("[inventory-low-stock-alert] Email send failed:", res.status, body);
  }
}

async function resolveRecipients(category: string): Promise<string[]> {
  // First preference: per-category alert_email on inventory_category_settings.
  const { data: setting } = await supabase
    .from("inventory_category_settings")
    .select("alert_email, reorder_count")
    .eq("category", category)
    .maybeSingle();
  const specific = setting?.alert_email?.trim();
  if (specific) return [specific];

  // Fallback: every super_admin on admin_users.
  const { data: admins } = await supabase
    .from("admin_users")
    .select("email, role")
    .eq("role", "super_admin");
  return (admins ?? [])
    .map((a: { email: string | null }) => a.email)
    .filter((e: string | null): e is string => !!e);
}

async function resolveReorderCount(category: string): Promise<number> {
  const { data } = await supabase
    .from("inventory_category_settings")
    .select("reorder_count")
    .eq("category", category)
    .maybeSingle();
  return data?.reorder_count ?? 100;
}

serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const row = payload.record ?? payload.row;
    if (!row || row.status !== "open") return new Response("ignored", { status: 200 });

    const [recipients, reorderCount] = await Promise.all([
      resolveRecipients(row.category),
      resolveReorderCount(row.category),
    ]);
    if (recipients.length === 0) return new Response("no recipients", { status: 200 });

    const ctaUrl = `${ADMIN_APP_URL.replace(/\/$/, "")}/admin/inventory?restock=${encodeURIComponent(row.category)}`;
    const subject = `[Stegofy] Low stock: only ${row.current_stock} ${row.category} QR codes left`;
    const html = `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
        <h2 style="color:#b45309;margin-bottom:4px;">Low QR inventory alert</h2>
        <p style="margin-top:0;color:#475569;">A category has dropped below its configured threshold.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;color:#64748b;">Category</td><td style="padding:6px 12px;font-weight:600;text-transform:capitalize;">${row.category}</td></tr>
          <tr><td style="padding:6px 12px;color:#64748b;">Current stock</td><td style="padding:6px 12px;font-weight:600;">${row.current_stock}</td></tr>
          <tr><td style="padding:6px 12px;color:#64748b;">Threshold</td><td style="padding:6px 12px;">${row.threshold}</td></tr>
          <tr><td style="padding:6px 12px;color:#64748b;">Suggested reorder</td><td style="padding:6px 12px;">${reorderCount}</td></tr>
        </table>
        <p>
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#7c3aed;color:#fff;font-weight:600;text-decoration:none;">
            Generate ${reorderCount} more ${row.category} QRs
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          You're receiving this because you're listed as the alert recipient for this category — or because no specific recipient was configured. Manage thresholds and recipients under Inventory → Low-stock settings.
        </p>
      </div>
    `;

    await sendEmail(recipients, subject, html);
    return new Response("alerted", { status: 200 });
  } catch (e) {
    console.error("[inventory-low-stock-alert] error:", e);
    return new Response("error", { status: 500 });
  }
});
