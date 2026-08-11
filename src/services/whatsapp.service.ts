import { env } from "@config/env";
import { logger } from "@utils/logger";

const META_GRAPH_VERSION = "v22.0";
const DIALOG_API_URL = "https://waba-v2.360dialog.io";

export type TemplateParameter =
  | { type: "text"; text: string }
  | { type: "currency"; currency: string; amount_1000: number }
  | { type: "date_time"; fallback_value: string };

/**
 * Thin abstraction over the WhatsApp providers so the rest of the app never
 * needs to know whether we're using Meta's Cloud API directly or 360dialog
 * (a Meta BSP). Both speak the same Meta payload format; they differ only
 * in base URL and auth header.
 */

export function isWhatsAppConfigured(): boolean {
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
  logger.info(`[WhatsApp:${env.whatsapp.provider}] template "${templateName}" -> ${toE164(to)}`);
}

/** Free-form text message. Only works inside the 24h customer-service window. */
export async function sendTextMessage(to: string, text: string): Promise<void> {
  const payload = {
    messaging_product: "whatsapp",
    to: toE164(to),
    type: "text",
    text: { body: text },
  };
  await callProvider(payload);
  logger.info(`[WhatsApp:${env.whatsapp.provider}] text -> ${toE164(to)}`);
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
  if (!env.whatsapp.appSecret) return true; // dev mode
  if (!rawBody || typeof signature !== "string") return false;

  const { createHmac, timingSafeEqual } = require("node:crypto");
  const expected = createHmac("sha256", env.whatsapp.appSecret).update(rawBody).digest("hex");
  const actual = signature.replace(/^sha256=/, "");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
