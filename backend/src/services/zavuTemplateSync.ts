import Zavudev, { APIError } from "@zavudev/sdk";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getCommsSettings, invalidateCommsCache } from "./commsCredentials.js";
import { logger } from "../lib/logger.js";

const WEBHOOK_URL = "https://stegotags.stegofy.com/api/webhooks/zavu/status";
const WEBHOOK_EVENTS = ["message.delivered", "message.failed", "message.sent"];

interface TemplateSpec {
  name: string;
  settingKey: string;
  body: string;
  whatsappCategory: "AUTHENTICATION" | "UTILITY" | "MARKETING";
  variables: string[];
  addSecurityRecommendation?: boolean;
  codeExpirationMinutes?: number;
}

const TEMPLATES: TemplateSpec[] = [
  {
    name: "stegotags_otp_v3",
    settingKey: "zavu_otp_template_id",
    body: "Your StegoTags verification code is {{1}} — it expires in 10 minutes. Do not share this code with anyone.",
    whatsappCategory: "UTILITY",
    variables: ["otp_code"],
  },
  {
    name: "stegotags_vehicle_report_v2",
    settingKey: "zavu_vehicle_report_template_id",
    body: "StegoTags Alert: Someone reported about your vehicle ({{3}}). Reason: {{1}}. You can reach them at {{2}} to follow up.",
    whatsappCategory: "UTILITY",
    variables: ["message", "stranger_phone", "vehicle_label"],
  },
  {
    name: "stegotags_scan_alert_v2",
    settingKey: "zavu_scan_alert_template_id",
    body: 'Your StegoTags QR tag "{{1}}" was just scanned at {{2}} from {{3}}. Open StegoTags to view details.',
    whatsappCategory: "UTILITY",
    variables: ["qr_name", "timestamp", "location"],
  },
];

export async function reconcileZavuTemplates(): Promise<void> {
  const settings = await getCommsSettings();
  if (!settings.zavu_api_key) {
    logger.debug("Zavu template sync skipped — no API key configured");
    return;
  }

  const client = new Zavudev({ apiKey: settings.zavu_api_key });

  // Discover sender (auto-pick if only one, use saved if available).
  let senderId = settings.zavu_sender_id?.trim() || null;
  if (!senderId) {
    try {
      const senders = await client.senders.list({ limit: 5 });
      const items = senders.items ?? [];
      if (items.length === 0) {
        logger.warn("Zavu template sync: no senders found — skipping");
        return;
      }
      senderId = items[0].id;
      await upsertSetting("zavu_sender_id", senderId);
      logger.info({ senderId }, "Zavu template sync: auto-picked sender");
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : err }, "Zavu template sync: failed to list senders");
      return;
    }
  }

  // Configure webhook on the sender if not already set.
  try {
    await client.senders.update(senderId, {
      webhookUrl: WEBHOOK_URL,
      webhookEvents: WEBHOOK_EVENTS,
      webhookActive: true,
    } as Parameters<typeof client.senders.update>[1]);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "Zavu template sync: webhook config failed (non-blocking)");
  }

  // Load existing templates from Zavu.
  let existingByName: Map<string, { id: string; status?: string }>;
  try {
    const existing = await client.templates.list({ limit: 100 });
    existingByName = new Map(
      (existing.items ?? []).map((t) => {
        const anyT = t as unknown as { id: string; name: string; status?: string };
        return [t.name, { id: anyT.id, status: anyT.status }];
      }),
    );
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "Zavu template sync: failed to list templates");
    return;
  }

  // Reconcile each template.
  const toUpsert: Array<{ key: string; value: string }> = [];
  let changed = false;

  for (const tpl of TEMPLATES) {
    const currentId = settings[tpl.settingKey]?.trim() || null;
    const found = existingByName.get(tpl.name);

    if (found && found.status !== "rejected") {
      // Template exists and is approved or pending — just make sure the ID is saved.
      if (currentId !== found.id) {
        toUpsert.push({ key: tpl.settingKey, value: found.id });
        changed = true;
        logger.info({ template: tpl.name, id: found.id, status: found.status }, "Zavu template sync: saved existing template ID");
      }
      continue;
    }

    if (found && found.status === "rejected") {
      logger.info({ template: tpl.name }, "Zavu template sync: template was rejected — skipping auto-recreate (update template body in code and bump the version name)");
      continue;
    }

    // Template doesn't exist — create + submit.
    try {
      const createParams = {
        name: tpl.name,
        language: "en",
        body: tpl.body,
        whatsappCategory: tpl.whatsappCategory,
        variables: tpl.variables,
        ...(tpl.addSecurityRecommendation ? { addSecurityRecommendation: true } : {}),
        ...(tpl.codeExpirationMinutes ? { codeExpirationMinutes: tpl.codeExpirationMinutes } : {}),
      };
      const created = await client.templates.create(createParams as Parameters<typeof client.templates.create>[0]);
      await client.templates.submit(created.id, { senderId, category: tpl.whatsappCategory });
      toUpsert.push({ key: tpl.settingKey, value: created.id });
      changed = true;
      logger.info({ template: tpl.name, id: created.id }, "Zavu template sync: created + submitted for Meta approval");
    } catch (err) {
      if (err instanceof APIError) {
        logger.warn({ template: tpl.name, status: err.status, msg: err.message }, "Zavu template sync: create failed");
      } else {
        logger.warn({ template: tpl.name, err: err instanceof Error ? err.message : err }, "Zavu template sync: create failed");
      }
    }
  }

  // Persist any new/changed template IDs.
  if (toUpsert.length > 0) {
    const { error } = await supabaseAdmin.from("settings").upsert(toUpsert, { onConflict: "key" });
    if (error) {
      logger.warn({ err: error.message }, "Zavu template sync: failed to save settings");
    } else {
      invalidateCommsCache();
      logger.info({ saved: toUpsert.map((s) => s.key) }, "Zavu template sync: settings updated");
    }
  }

  if (!changed) {
    logger.info("Zavu template sync: all templates up to date");
  }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await supabaseAdmin.from("settings").upsert({ key, value }, { onConflict: "key" });
}
