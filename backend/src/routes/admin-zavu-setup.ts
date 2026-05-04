import { Router, type IRouter, type Request, type Response } from "express";
import Zavudev, { APIError } from "@zavudev/sdk";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getCommsSettings, invalidateCommsCache } from "../services/commsCredentials.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

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

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

async function requireSuperAdmin(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return null;
  }
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Server configuration missing" });
    return null;
  }
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  const userData = (await userRes.json()) as { id?: string };
  const userId = userData.id;
  if (!userId) {
    res.status(401).json({ error: "Could not identify user" });
    return null;
  }
  const allowedIds = (process.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  if (allowedIds.includes(userId)) return userId;
  const { data: adminRow } = await supabaseAdmin
    .from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  const role = (adminRow as { role?: string } | null)?.role ?? null;
  if (role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can access this endpoint" });
    return null;
  }
  return userId;
}

interface SenderSummary {
  id: string;
  name: string | null;
  phoneNumber: string | null;
}

function summarizeSender(s: { id: string; name?: string | null }): SenderSummary {
  const anyS = s as Record<string, unknown>;
  return {
    id: s.id,
    name: s.name ?? null,
    phoneNumber: typeof anyS.phoneNumber === "string" ? (anyS.phoneNumber as string) : null,
  };
}

router.post("/admin/zavu/setup", async (req: Request, res: Response) => {
  const callerId = await requireSuperAdmin(req, res);
  if (!callerId) return;

  const settings = await getCommsSettings();
  if (!settings.zavu_api_key) {
    res.status(400).json({ error: "Set zavu_api_key in admin settings first." });
    return;
  }

  const { senderId, regenerateSecret } = (req.body ?? {}) as {
    senderId?: string;
    regenerateSecret?: boolean;
  };

  const zavu = new Zavudev({ apiKey: settings.zavu_api_key });

  try {
    const senders = await zavu.senders.list({ limit: 20 });
    const items = senders.items ?? [];
    if (items.length === 0) {
      res.status(409).json({
        error: "No Zavu senders found. Create one in your Zavu dashboard first.",
      });
      return;
    }

    if (!senderId) {
      const summary = items.map(summarizeSender);
      if (items.length === 1) {
        res.json({
          needsSenderChoice: false,
          senderId: items[0].id,
          senders: summary,
        });
        return;
      }
      res.json({ needsSenderChoice: true, senders: summary });
      return;
    }

    if (!items.some((s) => s.id === senderId)) {
      res.status(400).json({ error: `Sender ${senderId} not found in your Zavu account.` });
      return;
    }

    // Configure webhook on the chosen sender.
    await zavu.senders.update(senderId, {
      webhookUrl: WEBHOOK_URL,
      webhookEvents: WEBHOOK_EVENTS,
      webhookActive: true,
    } as Parameters<typeof zavu.senders.update>[1]);

    let webhookSecret: string | null = null;
    if (regenerateSecret) {
      try {
        const sendersAny = zavu.senders as unknown as {
          webhookSecret: { regenerate: (args: { senderId: string }) => Promise<{ secret?: string; webhookSecret?: string }> };
        };
        const result = await sendersAny.webhookSecret.regenerate({ senderId });
        webhookSecret = result.secret ?? result.webhookSecret ?? null;
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : err }, "Failed to regenerate Zavu webhook secret");
      }
    }

    // Look up existing templates so we don't duplicate.
    const existing = await zavu.templates.list({ limit: 100 });
    const existingByName = new Map<string, { id: string; status?: string }>();
    for (const t of existing.items ?? []) {
      const anyT = t as unknown as { id: string; name: string; status?: string };
      existingByName.set(t.name, { id: anyT.id, status: anyT.status });
    }

    const templateResults: Array<{
      key: string;
      id: string;
      name: string;
      status: string;
      created: boolean;
    }> = [];

    for (const tpl of TEMPLATES) {
      const found = existingByName.get(tpl.name);
      if (found) {
        templateResults.push({
          key: tpl.settingKey,
          id: found.id,
          name: tpl.name,
          status: found.status ?? "?",
          created: false,
        });
        continue;
      }
      const createParams = {
        name: tpl.name,
        language: "en",
        body: tpl.body,
        whatsappCategory: tpl.whatsappCategory,
        variables: tpl.variables,
        ...(tpl.addSecurityRecommendation ? { addSecurityRecommendation: true } : {}),
        ...(tpl.codeExpirationMinutes ? { codeExpirationMinutes: tpl.codeExpirationMinutes } : {}),
      };
      const created = await zavu.templates.create(createParams as Parameters<typeof zavu.templates.create>[0]);
      await zavu.templates.submit(created.id, { senderId, category: tpl.whatsappCategory });
      templateResults.push({
        key: tpl.settingKey,
        id: created.id,
        name: tpl.name,
        status: "pending",
        created: true,
      });
    }

    // Persist the discovered/created IDs into the settings table so the
    // admin form picks them up on reload.
    const toUpsert: Array<{ key: string; value: string }> = [
      { key: "zavu_sender_id", value: senderId },
      ...templateResults.map((r) => ({ key: r.key, value: r.id })),
    ];
    if (webhookSecret) toUpsert.push({ key: "zavu_webhook_secret", value: webhookSecret });

    const { error: upsertError } = await supabaseAdmin
      .from("settings")
      .upsert(toUpsert, { onConflict: "key" });
    if (upsertError) {
      logger.warn({ err: upsertError.message }, "Failed to persist Zavu setup results");
    }

    invalidateCommsCache();

    res.json({
      done: true,
      senderId,
      webhookUrl: WEBHOOK_URL,
      webhookSecret,
      templates: templateResults,
      savedSettings: toUpsert.map((s) => s.key),
    });
  } catch (err) {
    if (err instanceof APIError) {
      const hint = err.status === 403 && /allowlist/i.test(err.message)
        ? " Add the Render service's outbound IPs to your Zavu API key allowlist."
        : "";
      res.status(502).json({ error: `Zavu API error (${err.status}): ${err.message}.${hint}` });
      return;
    }
    logger.error({ err }, "Zavu setup failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Setup failed" });
  }
});

export default router;
