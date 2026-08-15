import { env } from "@config/env";
import { logger } from "@utils/logger";
import { isBaileysConnected, sendBaileysText } from "@services/baileys.service";

const META_GRAPH_VERSION = "v22.0";
const DIALOG_API_URL = "https://waba-v2.360dialog.io";

export type TemplateParameter =
  | { type: "text"; text: string }
  | { type: "currency"; currency: string; amount_1000: number }
  | { type: "date_time"; fallback_value: string };

/**
 * Thin abstraction over the WhatsApp providers so the rest of the app never
 * needs to know which one is active. meta/360dialog speak the Meta payload
 * format; unipile/baileys drive a real WhatsApp account and render
 * templates locally as plain text.
 */

export function isWhatsAppConfigured(): boolean {
  if (!env.whatsapp.enabled) return false; // master kill switch
  if (env.whatsapp.provider === "baileys") return isBaileysConnected();
  if (env.whatsapp.provider === "unipile") {
    return Boolean(env.whatsapp.unipileApiKey && env.whatsapp.unipileAccountId);
  }
  if (!env.whatsapp.phoneNumberId) return false;
  if (env.whatsapp.provider === "meta") return Boolean(env.whatsapp.accessToken);
  if (env.whatsapp.provider === "360dialog") return Boolean(env.whatsapp.apiKey);
  return false;
}

/** Converts any local format ("6 90 12 34 56", "+237...", "237...") to E.164 (+237...). */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("237")) return `+${digits}`;
  return `+237${digits}`;
}

function metaUrl(): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${env.whatsapp.phoneNumberId}/messages`;
}

function dialogUrl(): string {
  return `${DIALOG_API_URL}/${env.whatsapp.phoneNumberId}/messages`;
}

async function callProvider(payload: Record<string, unknown>): Promise<unknown> {
  const provider = env.whatsapp.provider;

  if (provider === "meta") {
    const url = metaUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta Cloud API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  if (provider === "360dialog") {
    const url = dialogUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": env.whatsapp.apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`360dialog API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  throw new Error(`Unknown WhatsApp provider: ${provider}`);
}

/**
 * unipile/baileys have no template system (they drive a real WhatsApp
 * account), so templates are rendered locally into plain text. Positional
 * {{n}} placeholders mirror the Meta template variables.
 */
const TEXT_TEMPLATE_BODIES: Record<string, string> = {
  smartledger_otp:
    "Your SmartLedger verification code is {{1}}. It expires in 10 minutes. Do not share this code with anyone.",
  daily_sales_summary:
    "{{1}}, here's your daily summary - Income: {{2}}, Expenses: {{3}}, Profit: {{4}}. Keep growing with SmartLedger!",
  low_stock_alert:
    "Low stock at {{1}}: {{2}} is down to {{3}} remaining. Restock soon - SmartLedger",
};

function renderTextTemplate(templateName: string, parameters: TemplateParameter[]): string {
  const body = TEXT_TEMPLATE_BODIES[templateName];
  if (!body) {
    throw new Error(`No text mapping for template "${templateName}"`);
  }
  return body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => {
    const param = parameters[Number(index) - 1];
    if (!param) return "";
    if (param.type === "text") return param.text;
    if (param.type === "currency") return `${param.currency} ${param.amount_1000 / 1000}`;
    return param.fallback_value;
  });
}

/**
 * Unipile sends are chat-scoped. Two paths:
 * - Existing chat (cached): POST /api/v1/chats/{chat_id}/messages.
 * - New contact: POST /api/v1/chats with attendees_ids AND text in one call —
 *   Unipile cannot create an empty chat with a non-contact, the first
 *   message must be sent atomically with chat creation (ChatStarted).
 */
const unipileChatIds = new Map<string, string>();

function unipileJid(phone: string): string {
  return `${toE164(phone).replace("+", "")}@s.whatsapp.net`;
}

function unipileHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": env.whatsapp.unipileApiKey,
    accept: "application/json",
  };
}

/** Finds the chat id for a JID in the account's chat list, caching it. */
async function findUnipileChatId(jid: string): Promise<string | null> {
  const listRes = await fetch(
    `${env.whatsapp.unipileBaseUrl}/api/v1/chats?account_id=${env.whatsapp.unipileAccountId}`,
    { headers: unipileHeaders() }
  );
  if (listRes.ok) {
    const data = (await listRes.json()) as {
      items?: { id: string; attendee_public_identifier?: string; provider_id?: string }[];
    };
    const existing = data.items?.find(
      (c) => c.attendee_public_identifier === jid || c.provider_id === jid
    );
    if (existing) {
      unipileChatIds.set(jid, existing.id);
      return existing.id;
    }
  }
  return null;
}

async function sendViaUnipile(to: string, text: string): Promise<unknown> {
  const jid = unipileJid(to);

  // Fast path: we already know the chat.
  const cached = unipileChatIds.get(jid);
  if (cached) {
    const res = await fetch(
      `${env.whatsapp.unipileBaseUrl}/api/v1/chats/${cached}/messages`,
      {
        method: "POST",
        headers: unipileHeaders(),
        body: JSON.stringify({ account_id: env.whatsapp.unipileAccountId, text }),
      }
    );
    if (res.ok) return res.json();
    // Cache may be stale (chat deleted); fall through and re-resolve.
    unipileChatIds.delete(jid);
  }

  // If a chat already exists with this contact, send into it.
  const existingId = await findUnipileChatId(jid);
  if (existingId) {
    const res = await fetch(
      `${env.whatsapp.unipileBaseUrl}/api/v1/chats/${existingId}/messages`,
      {
        method: "POST",
        headers: unipileHeaders(),
        body: JSON.stringify({ account_id: env.whatsapp.unipileAccountId, text }),
      }
    );
    if (!res.ok) {
      throw await unipileError(res, to);
    }
    return res.json();
  }

  // New contact: create the chat AND send the first message in one call.
  // Without `text` this returns 422 — an empty chat can't be opened with
  // a number the account has never talked to.
  const createRes = await fetch(`${env.whatsapp.unipileBaseUrl}/api/v1/chats`, {
    method: "POST",
    headers: unipileHeaders(),
    body: JSON.stringify({
      account_id: env.whatsapp.unipileAccountId,
      attendees_ids: [jid],
      text,
    }),
  });
  if (createRes.ok) {
    const chat = (await createRes.json()) as { chat_id?: string };
    if (chat.chat_id) unipileChatIds.set(jid, chat.chat_id);
    return chat;
  }

  throw await unipileError(createRes, to);
}

/** Turns a failed Unipile response into a human-readable error. */
async function unipileError(res: Response, to: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { type?: string };
  if (body.type === "errors/invalid_recipient") {
    return new Error(`This phone number (${to}) is not reachable on WhatsApp.`);
  }
  if (body.type === "errors/disconnected_account") {
    return new Error("The WhatsApp account is disconnected — re-scan the QR code in the Unipile dashboard.");
  }
  if (body.type === "errors/account_restricted") {
    return new Error(
      "This WhatsApp number has been restricted by WhatsApp (automation detected). " +
        "Wait 24-72h to see if it lifts, or connect a different number in Unipile. " +
        "Long-term, switch WHATSAPP_PROVIDER to the official Meta Cloud API."
    );
  }
  return new Error(`Unipile API error ${res.status}: ${JSON.stringify(body)}`);
}

export interface TemplateOptions {
  to: string;
  templateName: string;
  language?: string;
  parameters?: TemplateParameter[];
}

/** Sends a pre-approved template message (required for any outbound message). */
export async function sendTemplateMessage({
  to,
  templateName,
  language = "en",
  parameters = [],
}: TemplateOptions): Promise<void> {
  const provider = env.whatsapp.provider;
  if (provider === "unipile" || provider === "baileys") {
    const text = renderTextTemplate(templateName, parameters);
    if (provider === "unipile") {
      await sendViaUnipile(to, text);
    } else {
      await sendBaileysText(toE164(to), text);
    }
    logger.info(`[WhatsApp:${provider}] template "${templateName}" (as text) -> ${toE164(to)}`);
    return;
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toE164(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: parameters.length > 0 ? [{ type: "body", parameters }] : undefined,
    },
  };
  await callProvider(payload);
  logger.info(`[WhatsApp:${provider}] template "${templateName}" -> ${toE164(to)}`);
}

/** Free-form text message. Only works inside the 24h customer-service window. */
export async function sendTextMessage(to: string, text: string): Promise<void> {
  const provider = env.whatsapp.provider;
  if (provider === "unipile" || provider === "baileys") {
    if (provider === "unipile") {
      await sendViaUnipile(to, text);
    } else {
      await sendBaileysText(toE164(to), text);
    }
    logger.info(`[WhatsApp:${provider}] text -> ${toE164(to)}`);
    return;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: toE164(to),
    type: "text",
    text: { body: text },
  };
  await callProvider(payload);
  logger.info(`[WhatsApp:${provider}] text -> ${toE164(to)}`);
}

/** OTP delivered via the "smartledger_otp" authentication template. */
export async function sendOtpMessage(to: string, code: string): Promise<void> {
  await sendTemplateMessage({
    to,
    templateName: "smartledger_otp",
    parameters: [{ type: "text", text: code }],
  });
}

/** Daily sales summary via the "daily_sales_summary" utility template. */
export interface SalesSummaryData {
  businessName: string;
  income: string;
  expenses: string;
  profit: string;
  currency: string;
}

export async function sendDailySalesSummary(to: string, data: SalesSummaryData): Promise<void> {
  await sendTemplateMessage({
    to,
    templateName: "daily_sales_summary",
    parameters: [
      { type: "text", text: data.businessName },
      { type: "text", text: `${data.currency} ${data.income}` },
      { type: "text", text: `${data.currency} ${data.expenses}` },
      { type: "text", text: `${data.currency} ${data.profit}` },
    ],
  });
}

/** Low-stock alert via the "low_stock_alert" utility template. */
export async function sendLowStockAlert(
  to: string,
  data: { businessName: string; productName: string; remaining: string }
): Promise<void> {
  await sendTemplateMessage({
    to,
    templateName: "low_stock_alert",
    parameters: [
      { type: "text", text: data.businessName },
      { type: "text", text: data.productName },
      { type: "text", text: data.remaining },
    ],
  });
}

/**
 * Handles Meta's GET webhook verification handshake.
 * Returns the challenge string if the token matches, otherwise null.
 */
export function verifyWebhookHandshake(
  mode: unknown,
  token: unknown,
  challenge: unknown
): string | null {
  if (mode === "subscribe" && token === env.whatsapp.webhookVerifyToken) {
    return String(challenge);
  }
  return null;
}

/**
 * Verifies Meta's x-hub-signature-256 HMAC header against the app secret.
 * Requires the raw body to be captured (see the `verify` hook on express.json
 * in app.ts). Returns true when no secret is configured (dev mode).
 */
export function isWebhookSignatureValid(rawBody: Buffer | undefined, signature: unknown): boolean {
  if (env.whatsapp.provider === "unipile") return true; // Unipile does not sign with x-hub-signature-256
  if (!env.whatsapp.appSecret) return true; // dev mode
  if (!rawBody || typeof signature !== "string") return false;

  const { createHmac, timingSafeEqual } = require("node:crypto");
  const expected = createHmac("sha256", env.whatsapp.appSecret).update(rawBody).digest("hex");
  const actual = signature.replace(/^sha256=/, "");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
