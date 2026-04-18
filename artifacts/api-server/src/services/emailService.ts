import { Resend } from "resend";

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY ?? "").trim());
}

export interface SendVendorEmailOptions {
  to: string;
  subject: string;
  html: string;
  pdfBase64?: string;
  pdfFilename?: string;
  fromName?: string;
}

export async function sendVendorEmail(opts: SendVendorEmailOptions): Promise<void> {
  const client = getClient();
  if (!client) {
    throw new Error("RESEND_API_KEY is not configured. Add it as a Replit Secret.");
  }

  const from = opts.fromName
    ? `${opts.fromName} <onboarding@resend.dev>`
    : "Stegofy Admin <onboarding@resend.dev>";

  const attachments: Array<{ filename: string; content: string }> = [];
  if (opts.pdfBase64 && opts.pdfFilename) {
    const base64Data = opts.pdfBase64.includes(",")
      ? opts.pdfBase64.split(",")[1]
      : opts.pdfBase64;
    attachments.push({ filename: opts.pdfFilename, content: base64Data });
  }

  const plainText = opts.html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  const { error } = await client.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: plainText,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
