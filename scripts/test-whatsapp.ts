import "dotenv/config";
import { env } from "@config/env";
import { isWhatsAppConfigured, sendDailySalesSummary, toE164 } from "@services/whatsapp.service";

const phoneArg = process.argv[2];

function printGuide(): void {
  console.log(`
WhatsApp credentials are not configured yet. To enable real sends, set these in .env:

  WHATSAPP_PROVIDER=meta
  WHATSAPP_ACCESS_TOKEN=<permanent token from Meta System User>
  WHATSAPP_PHONE_NUMBER_ID=<phone number id from the WhatsApp test number>

Then create the template "daily_sales_summary" (Utility) in WhatsApp Manager:
  {{1}}, here's your daily summary - Income: {{2}}, Expenses: {{3}}, Profit: {{4}}. Keep growing with SmartLedger!
`);
}

async function main(): Promise<void> {
  if (!phoneArg) {
    console.log("Usage: npm run test:whatsapp -- +2376XXXXXXXX");
    return;
  }

  if (!isWhatsAppConfigured()) {
    printGuide();
    return;
  }

  const to = toE164(phoneArg);
  console.log(`Sending daily_sales_summary to ${to} via ${env.whatsapp.provider}...`);

  await sendDailySalesSummary(to, {
    businessName: "Test Business",
    income: "15000",
    expenses: "6500",
    profit: "8500",
    currency: "XAF",
  });

  console.log("Sent. Check WhatsApp on the recipient number. (Template must be APPROVED.)");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
