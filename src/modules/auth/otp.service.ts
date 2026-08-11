import { sendSms, generateOtpCode } from "@services/sms.service";
import { sendOtpMessage, isWhatsAppConfigured } from "@services/whatsapp.service";
import { env } from "@config/env";
import { logger } from "@utils/logger";
import { ValidationError } from "@utils/errors";

// NOTE: This in-memory store is only for local development.
// In production, replace with Redis (with a TTL) so OTPs survive
// server restarts and work across multiple backend instances.
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Delivers the OTP over the configured channel(s):
 * - "whatsapp" (default): send via WhatsApp authentication template.
 * - "sms": send via the SMS provider (Africa's Talking / Twilio).
 * - "both": send via both.
 * If a channel isn't configured yet (e.g. no WhatsApp credentials in dev),
 * the code is logged so local development still works.
 */
async function deliverOtp(phone: string, code: string): Promise<void> {
  const channel = env.otpChannel;
  const whatsappReady = isWhatsAppConfigured();

  if ((channel === "whatsapp" || channel === "both") && whatsappReady) {
    await sendOtpMessage(phone, code);
    if (channel === "both") await sendSms(phone, `Your SmartLedger verification code is ${code}. It expires in 5 minutes.`);
    return;
  }

  if ((channel === "sms" || channel === "both") && env.sms.provider) {
    await sendSms(phone, `Your SmartLedger verification code is ${code}. It expires in 5 minutes.`);
    return;
  }

  logger.warn(`[OTP] No channel configured, logging code for dev: ${code} -> ${phone}`);
}

export async function requestOtp(phone: string): Promise<void> {
  const code = generateOtpCode();
  otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
  await deliverOtp(phone, code);
}

export function verifyOtp(phone: string, code: string): void {
  const entry = otpStore.get(phone);

  if (!entry || entry.expiresAt < Date.now()) {
    throw new ValidationError("OTP has expired. Please request a new one.");
  }

  if (entry.code !== code) {
    throw new ValidationError("Incorrect verification code.");
  }

  otpStore.delete(phone);
}
