import { env } from "@config/env";
import { logger } from "@utils/logger";

/**
 * Thin abstraction over the SMS provider so the rest of the app never
 * needs to know whether we're using Africa's Talking or Twilio.
 * Swap the implementation inside sendSms() without touching any callers.
 */
export async function sendSms(toPhone: string, message: string): Promise<void> {
  if (env.sms.provider === "africastalking") {
    // TODO: call Africa's Talking SDK/API here using env.sms.africasTalkingApiKey
    logger.info(`[SMS:AfricasTalking] -> ${toPhone}: ${message}`);
    return;
  }

  if (env.sms.provider === "twilio") {
    // TODO: call Twilio SDK/API here using env.sms.twilioAccountSid / twilioAuthToken
    logger.info(`[SMS:Twilio] -> ${toPhone}: ${message}`);
    return;
  }

  throw new Error(`Unknown SMS provider: ${env.sms.provider}`);
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
