/**
 * One-shot Zavu template setup for StegoTags.
 *
 * Run with:
 *   ZAVUDEV_API_KEY=zv_live_… ZAVU_SENDER_ID=snd_… \
 *     pnpm --filter @workspace/scripts exec tsx src/zavu-setup.ts
 *
 * Creates the 3 WhatsApp templates StegoTags needs (OTP, vehicle report,
 * scan alert), submits each for Meta approval, and prints the resulting
 * tpl_xxx IDs to paste into the SuperAdmin → API Keys settings.
 */
import Zavudev from "@zavudev/sdk";

const apiKey = process.env.ZAVUDEV_API_KEY;
const senderId = process.env.ZAVU_SENDER_ID;

if (!apiKey || !senderId) {
  console.error("Set ZAVUDEV_API_KEY and ZAVU_SENDER_ID env vars before running.");
  process.exit(1);
}

const SENDER_ID: string = senderId;
const zavu = new Zavudev({ apiKey });

async function setup(): Promise<void> {
  console.log("Creating templates in Zavu…\n");

  const otp = await zavu.templates.create({
    name: "stegotags_otp_v1",
    language: "en",
    body: "Your StegoTags verification code is {{1}}. It expires in 10 minutes.",
    whatsappCategory: "AUTHENTICATION",
    variables: ["otp_code"],
    addSecurityRecommendation: true,
    codeExpirationMinutes: 10,
  });
  await zavu.templates.submit(otp.id, { senderId: SENDER_ID, category: "AUTHENTICATION" });
  console.log(`  ✓ OTP template created and submitted: ${otp.id}`);

  const report = await zavu.templates.create({
    name: "stegotags_vehicle_report_v1",
    language: "en",
    body: "StegoTags: Someone reported about your vehicle ({{3}}): {{1}}. Their number: {{2}}.",
    whatsappCategory: "UTILITY",
    variables: ["message", "stranger_phone", "vehicle_label"],
  });
  await zavu.templates.submit(report.id, { senderId: SENDER_ID, category: "UTILITY" });
  console.log(`  ✓ Vehicle report template created and submitted: ${report.id}`);

  const scan = await zavu.templates.create({
    name: "stegotags_scan_alert_v1",
    language: "en",
    body: 'Your StegoTags QR "{{1}}" was scanned at {{2}} from {{3}}.',
    whatsappCategory: "UTILITY",
    variables: ["qr_name", "timestamp", "location"],
  });
  await zavu.templates.submit(scan.id, { senderId: SENDER_ID, category: "UTILITY" });
  console.log(`  ✓ Scan alert template created and submitted: ${scan.id}`);

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Paste these into your StegoTags admin → API Keys:");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  zavu_otp_template_id            = ${otp.id}`);
  console.log(`  zavu_vehicle_report_template_id = ${report.id}`);
  console.log(`  zavu_scan_alert_template_id     = ${scan.id}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log("\nAll templates submitted to Meta. Approval typically takes minutes to 24h.");
  console.log("Check status in Zavu dashboard → Templates.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
