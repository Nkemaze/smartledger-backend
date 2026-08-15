import { sendSms, generateOtpCode } from "@services/sms.service";
import { sendOtpMessage, isWhatsAppConfigured } from "@services/whatsapp.service";
import { sendVerificationEmail, isEmailConfigured } from "@services/email.service";
import { env } from "@config/env";
import { logger } from "@utils/logger";
import { ValidationError } from "@utils/errors";

// NOTE: This in-memory store is only for local development.
// In production, replace with Redis (with a TTL) so OTPs survive
// server restarts and work across multiple backend instances.
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

// ---------------------------------------------------------------------------
// Signup verification — user chooses WhatsApp or email at account creation.
// ---------------------------------------------------------------------------

export type VerificationMethod = "whatsapp" | "email";

interface SignupEntry {
  code: string;
  expiresAt: number;
  attemptsLeft: number;
  resendAvailableAt: number;
}

const SIGNUP_TTL_MS = 10 * 60 * 1000; // codes live 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;
const signupStore = new Map<string, SignupEntry>();

function signupKey(method: VerificationMethod, destination: string): string {
  return `${method}:${destination}`;
}

async function deliverSignupCode(method: VerificationMethod, destination: string, code: string): Promise<void> {
  if (method === "whatsapp") {
    if (!isWhatsAppConfigured()) {
      // WhatsApp disabled or unconfigured — email is the working alternative.
      throw new ValidationError("WhatsApp verification is temporarily unavailable. Please verify via email.");
    }
    // Uses the smartledger_otp template (renders as plain text on unipile).
    await sendOtpMessage(destination, code);
    return;
  }
  if (!isEmailConfigured()) {
    // Fail loudly rather than pretending to send — the user would wait
    // forever for an email that never comes.
    throw new ValidationError(
      "Email delivery is not configured on the server. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD/EMAIL_FROM, or verify via WhatsApp."
    );
  }
  await sendVerificationEmail(destination, code);
}

/** Generates and sends a signup verification code (WhatsApp or email). */
export async function requestSignupVerification(
  method: VerificationMethod,
  destination: string
): Promise<void> {
  const key = signupKey(method, destination);
  const existing = signupStore.get(key);
  if (existing && existing.resendAvailableAt > Date.now()) {
    const wait = Math.ceil((existing.resendAvailableAt - Date.now()) / 1000);
    throw new ValidationError(`Please wait ${wait}s before requesting a new code.`);
  }

  const code = generateOtpCode();
  signupStore.set(key, {
    code,
    expiresAt: Date.now() + SIGNUP_TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
    resendAvailableAt: Date.now() + RESEND_COOLDOWN_MS,
  });

  await deliverSignupCode(method, destination, code);
}

/** Validates and consumes a signup code. Throws ValidationError on failure. */
export function consumeSignupVerification(
  method: VerificationMethod,
  destination: string,
  code: string
): void {
  const key = signupKey(method, destination);
  const entry = signupStore.get(key);

  if (!entry || entry.expiresAt < Date.now()) {
    signupStore.delete(key);
    throw new ValidationError("Verification code has expired. Please request a new one.");
  }

  if (entry.code !== code) {
    entry.attemptsLeft -= 1;
    if (entry.attemptsLeft <= 0) {
      signupStore.delete(key);
      throw new ValidationError("Too many incorrect attempts. Please request a new code.");
    }
    throw new ValidationError(
      `Incorrect verification code. ${entry.attemptsLeft} attempt(s) left.`
    );
  }

  signupStore.delete(key);
}
