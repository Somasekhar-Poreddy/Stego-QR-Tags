/**
 * One-shot Zavu setup for StegoTags.
 *
 * Run from your local machine (where your IP is in the Zavu allowlist):
 *
 *   # First run — discover your sender:
 *   ZAVUDEV_API_KEY=zv_live_… \
 *     pnpm --filter @workspace/scripts exec tsx src/zavu-setup.ts
 *
 *   # Second run — with the sender ID:
 *   ZAVUDEV_API_KEY=zv_live_… ZAVU_SENDER_ID=snd_… \
 *     pnpm --filter @workspace/scripts exec tsx src/zavu-setup.ts
 *
 * What it does:
 *   1. Lists your Zavu senders (and exits if ZAVU_SENDER_ID not set)
 *   2. Configures the webhook URL + events on the chosen sender
 *   3. Optionally regenerates the webhook secret (only if --regen-secret)
 *   4. Creates the 3 StegoTags templates if they don't already exist
 *   5. Submits each new template for Meta approval
 *   6. Prints the values to paste into StegoTags admin → API Keys
 */
import Zavudev, { APIError } from "@zavudev/sdk";

const apiKey = process.env.ZAVUDEV_API_KEY;
const senderId = process.env.ZAVU_SENDER_ID;
const regenSecret = process.argv.includes("--regen-secret");

const WEBHOOK_URL = "https://stegotags.stegofy.com/api/webhooks/zavu/status";
const WEBHOOK_EVENTS = ["message.delivered", "message.failed", "message.sent"];

const TEMPLATES = [
  {
    name: "stegotags_otp_v4",
    settingKey: "zavu_otp_template_id",
    body: "{{1}} is your verification code.",
    whatsappCategory: "AUTHENTICATION" as const,
    variables: ["otp_code"],
    addSecurityRecommendation: true,
    codeExpirationMinutes: 10,
  },
  {
    name: "stegotags_vehicle_report_v2",
    settingKey: "zavu_vehicle_report_template_id",
    body: "StegoTags Alert: Someone reported about your vehicle ({{3}}). Reason: {{1}}. You can reach them at {{2}} to follow up.",
    whatsappCategory: "UTILITY" as const,
    variables: ["message", "stranger_phone", "vehicle_label"],
  },
  {
    name: "stegotags_scan_alert_v2",
    settingKey: "zavu_scan_alert_template_id",
    body: 'Your StegoTags QR tag "{{1}}" was just scanned at {{2}} from {{3}}. Open StegoTags to view details.',
    whatsappCategory: "UTILITY" as const,
    variables: ["qr_name", "timestamp", "location"],
  },
];

if (!apiKey) {
  console.error("Missing ZAVUDEV_API_KEY. Get one from your Zavu dashboard → API Keys.");
  process.exit(1);
}

const zavu = new Zavudev({ apiKey });

async function main(): Promise<void> {
  // ─── Step 1: List senders ──────────────────────────────────────────────
  console.log("Listing your Zavu senders…\n");
  const senders = await zavu.senders.list({ limit: 20 });
  if (!senders.items || senders.items.length === 0) {
    console.error("No senders found. Create one in Zavu dashboard → Senders first.");
    process.exit(1);
  }

  for (const s of senders.items) {
    console.log(`  ${s.id}  ${s.name ?? "(no name)"}  ${(s as any).phoneNumber ?? ""}`);
  }
  console.log();

  if (!senderId) {
    console.log("Re-run with ZAVU_SENDER_ID=snd_… to continue with one of the above.");
    process.exit(0);
  }

  const SENDER_ID: string = senderId;

  // ─── Step 2: Configure webhook on the sender ──────────────────────────
  console.log(`Configuring webhook on ${SENDER_ID}…`);
  try {
    await zavu.senders.update(SENDER_ID, {
      webhookUrl: WEBHOOK_URL,
      webhookEvents: WEBHOOK_EVENTS as any,
      webhookActive: true,
    } as any);
    console.log(`  ✓ Webhook URL set to ${WEBHOOK_URL}`);
    console.log(`  ✓ Subscribed to: ${WEBHOOK_EVENTS.join(", ")}`);
  } catch (err) {
    if (err instanceof APIError) {
      console.error(`  ✗ Failed to update webhook: ${err.status} ${err.message}`);
    } else {
      throw err;
    }
  }

  let webhookSecret: string | null = null;
  if (regenSecret) {
    console.log("\nRegenerating webhook secret (--regen-secret given)…");
    try {
      const result = await (zavu as any).senders.webhookSecret.regenerate({ senderId: SENDER_ID });
      webhookSecret = result.secret ?? result.webhookSecret ?? null;
      console.log("  ✓ New secret generated (shown below — save it now)");
    } catch (err) {
      console.error(`  ✗ Could not regenerate secret: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Step 3: Create templates (skip if they already exist) ────────────
  console.log("\nChecking for existing templates…");
  const existing = await zavu.templates.list({ limit: 100 });
  const existingByName = new Map<string, { id: string; status: string }>();
  for (const t of existing.items ?? []) {
    existingByName.set(t.name, { id: t.id, status: (t as any).status ?? "?" });
  }

  const results: Array<{ settingKey: string; id: string; name: string; created: boolean; status: string }> = [];

  for (const tpl of TEMPLATES) {
    const found = existingByName.get(tpl.name);
    if (found) {
      console.log(`  · ${tpl.name} already exists (${found.status}) → ${found.id}`);
      results.push({ settingKey: tpl.settingKey, id: found.id, name: tpl.name, created: false, status: found.status });
      continue;
    }

    const created = await zavu.templates.create(tpl as any);
    await zavu.templates.submit(created.id, { senderId: SENDER_ID, category: tpl.whatsappCategory });
    console.log(`  ✓ Created + submitted: ${tpl.name} → ${created.id}`);
    results.push({ settingKey: tpl.settingKey, id: created.id, name: tpl.name, created: true, status: "pending" });
  }

  // ─── Step 4: Summary ──────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Paste these into StegoTags SuperAdmin → Settings → API Keys:");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  zavu_sender_id                  = ${SENDER_ID}`);
  if (webhookSecret) {
    console.log(`  zavu_webhook_secret             = ${webhookSecret}`);
  } else {
    console.log(`  zavu_webhook_secret             = (use existing, or re-run with --regen-secret)`);
  }
  for (const r of results) {
    console.log(`  ${r.settingKey.padEnd(32)}= ${r.id}`);
  }
  console.log("────────────────────────────────────────────────────────────\n");

  const newCount = results.filter((r) => r.created).length;
  if (newCount > 0) {
    console.log(`Submitted ${newCount} new template(s) to Meta. Approval typically takes minutes to 24h.`);
    console.log("Track approval in Zavu dashboard → Templates.");
  } else {
    console.log("All templates already existed — nothing new to submit.");
  }
}

main().catch((err) => {
  if (err instanceof APIError) {
    console.error(`\nZavu API error (${err.status}): ${err.message}`);
    if (err.status === 403 && /allowlist/i.test(err.message)) {
      console.error("\n→ Your API key has an IP allowlist. Run this from your local machine,");
      console.error("  or add this server's IP to the allowlist in Zavu dashboard → API Keys.");
    }
  } else {
    console.error("\nSetup failed:", err);
  }
  process.exit(1);
});
