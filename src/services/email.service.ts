import nodemailer from "nodemailer";
import { env } from "@config/env";
import { logger } from "@utils/logger";

/**
 * SMTP email delivery (verification codes, future reports).
 * When SMTP isn't configured (local dev), the message is logged instead
 * so signup flows still work end-to-end.
 */

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.email.host && env.email.from);
}

function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined,
  });
  return transporter;
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[Email] SMTP not configured, logging code for dev: ${code} -> ${to}`);
    return;
  }

  await t.sendMail({
    from: env.email.from,
    to,
    subject: "Your SmartLedger verification code",
    text: `Your SmartLedger verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#1B5E20;margin-bottom:8px;">SmartLedger</h2>
        <p style="color:#424242;font-size:15px;">Use this code to verify your account:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1B5E20;margin:16px 0;">${code}</p>
        <p style="color:#757575;font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });

  logger.info(`[Email] verification code sent to ${to}`);
}

export interface DailySummaryEmailData {
  businessName: string;
  income: string;
  expenses: string;
  profit: string;
  currency: string;
  transactionCount: number;
}

/** End-of-day business summary (replaces the WhatsApp summary while it is off). */
export async function sendDailySummaryEmail(to: string, data: DailySummaryEmailData): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[Email] SMTP not configured, skipping daily summary to ${to}`);
    return;
  }

  const profitPositive = !data.profit.startsWith("-");
  const row = (label: string, value: string, color: string) => `
    <tr>
      <td style="padding:10px 16px;color:#616161;font-size:14px;">${label}</td>
      <td style="padding:10px 16px;text-align:right;font-weight:bold;font-size:15px;color:${color};">${value}</td>
    </tr>`;

  await t.sendMail({
    from: env.email.from,
    to,
    subject: `Daily summary — ${data.businessName}`,
    text: `${data.businessName}, here's your daily summary - Income: ${data.currency} ${data.income}, Expenses: ${data.currency} ${data.expenses}, Profit: ${data.currency} ${data.profit} (${data.transactionCount} transactions). Keep growing with SmartLedger!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1B5E20;margin-bottom:2px;">SmartLedger</h2>
        <p style="color:#757575;font-size:13px;margin-top:0;">Daily summary for ${data.businessName}</p>
        <table style="width:100%;border-collapse:collapse;background:#F6FBF6;border-radius:10px;overflow:hidden;">
          ${row("Income", `${data.currency} ${data.income}`, "#1B5E20")}
          ${row("Expenses", `${data.currency} ${data.expenses}`, "#B3261E")}
          ${row("Profit", `${data.currency} ${data.profit}`, profitPositive ? "#1B5E20" : "#B3261E")}
          ${row("Transactions", String(data.transactionCount), "#424242")}
        </table>
        <p style="color:#757575;font-size:13px;margin-top:16px;">Keep growing with SmartLedger!</p>
      </div>
    `,
  });

  logger.info(`[Email] daily summary sent to ${to}`);
}

/** Low-stock alert email. */
export async function sendLowStockEmail(
  to: string,
  data: { businessName: string; productName: string; remaining: number; threshold: number }
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[Email] SMTP not configured, skipping low-stock alert to ${to}`);
    return;
  }

  await t.sendMail({
    from: env.email.from,
    to,
    subject: `Low stock: ${data.productName} — ${data.businessName}`,
    text: `Low stock at ${data.businessName}: ${data.productName} is down to ${data.remaining} remaining (reorder threshold ${data.threshold}). Restock soon — SmartLedger`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#B3261E;margin-bottom:2px;">Low stock alert</h2>
        <p style="color:#424242;font-size:15px;">
          <strong>${data.productName}</strong> at ${data.businessName} is down to
          <strong>${data.remaining} remaining</strong> (reorder threshold ${data.threshold}).
        </p>
        <p style="color:#757575;font-size:13px;">Restock soon — SmartLedger</p>
      </div>
    `,
  });

  logger.info(`[Email] low-stock alert sent to ${to}`);
}
