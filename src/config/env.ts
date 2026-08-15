import "dotenv/config";

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  otpChannel: process.env.OTP_CHANNEL ?? "whatsapp", // whatsapp | sms | both
  sms: {
    provider: process.env.SMS_PROVIDER ?? "africastalking",
    africasTalkingApiKey: process.env.AFRICASTALKING_API_KEY ?? "",
    africasTalkingUsername: process.env.AFRICASTALKING_USERNAME ?? "",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? "r2",
    bucketName: process.env.S3_BUCKET_NAME ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT ?? "",
  },
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED !== "false", // master switch: set false to disable all WhatsApp sending
    provider: process.env.WHATSAPP_PROVIDER ?? "meta", // meta (Cloud API) | 360dialog | unipile | baileys
    apiKey: process.env.WHATSAPP_API_KEY ?? "", // 360dialog D360-API-KEY
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "", // Meta Cloud API token
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "", // Meta app secret for webhook signature checks
    unipileApiKey: process.env.UNIPILE_API_KEY ?? "",
    unipileBaseUrl: process.env.UNIPILE_BASE_URL ?? "https://api.unipile.com",
    unipileAccountId: process.env.UNIPILE_ACCOUNT_ID ?? "", // connected WhatsApp account id
    baileysAuthDir: process.env.BAILEYS_AUTH_DIR ?? "./baileys-auth",
    baileysPairingPhone: process.env.BAILEYS_PAIRING_PHONE ?? "", // fresh number to pair, e.g. +237XXXXXXXX
    dailySummaryCron: process.env.DAILY_SUMMARY_CRON ?? "0 20 * * *", // end-of-day summary schedule
    dailySummaryTimezone: process.env.DAILY_SUMMARY_TZ ?? "Africa/Douala",
  },
  email: {
    host: process.env.SMTP_HOST ?? "",
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.EMAIL_FROM ?? "", // e.g. "SmartLedger <no-reply@smartledger.app>"
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? "anthropic", // "anthropic" | "gemini"
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "", // resolved per provider when empty
  },
};
