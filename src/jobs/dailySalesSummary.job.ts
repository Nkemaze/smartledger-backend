import cron from "node-cron";
import { prisma } from "@config/database";
import { logger } from "@utils/logger";
import { Role } from "@prisma/client";
import { env } from "@config/env";
import { sendDailySalesSummary, isWhatsAppConfigured, SalesSummaryData } from "@services/whatsapp.service";
import { sendDailySummaryEmail, isEmailConfigured } from "@services/email.service";

/** Aggregates a business's income/expenses/profit for a single day. */
export async function computeDailySummary(
  businessId: string,
  day: Date
): Promise<Omit<SalesSummaryData, "businessName" | "currency"> & { transactionCount: number }> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const [incomeAgg, expenseAgg, countAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, type: "INCOME", occurredAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, type: "EXPENSE", occurredAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.count({ where: { businessId, occurredAt: { gte: start, lte: end } } }),
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  return {
    income: income.toLocaleString("en-US"),
    expenses: expenses.toLocaleString("en-US"),
    profit: (income - expenses).toLocaleString("en-US"),
    transactionCount: countAgg,
  };
}

/**
 * Sends each business owner a daily WhatsApp summary of income, expenses,
 * and profit (SRS: WA-REQ-001). Runs at DAILY_SUMMARY_CRON (default 20:00)
 * in DAILY_SUMMARY_TZ (default Africa/Douala). Owners can opt out via
 * User.dailySummaryEnabled (Settings > Notifications in the apps).
 */
export function scheduleDailySalesSummary() {
  cron.schedule(
    env.whatsapp.dailySummaryCron,
    async () => {
      logger.info("Running daily sales summary job...");

      const whatsappReady = isWhatsAppConfigured();
      const emailReady = isEmailConfigured();
      if (!whatsappReady && !emailReady) {
        logger.warn("No delivery channel configured (WhatsApp/email); skipping daily summaries.");
        return;
      }

      const businesses = await prisma.business.findMany({
        select: {
          id: true,
          name: true,
          currency: true,
          users: {
            select: { id: true, phone: true, email: true, role: true, dailySummaryEnabled: true },
            where: { isActive: true },
          },
        },
      });

      // The "day" being summarised is today in the job's timezone.
      const today = new Date();

      for (const business of businesses) {
        try {
          const owner = business.users.find(
            (u) => u.role === Role.OWNER && u.dailySummaryEnabled
          );
          if (!owner) {
            logger.info(`No opted-in owner for business ${business.name}; skipping.`);
            continue;
          }

          const summary = await computeDailySummary(business.id, today);
          const data = {
            businessName: business.name,
            currency: business.currency ?? "XAF",
            ...summary,
          };

          let channel = "none";
          if (whatsappReady && owner.phone) {
            await sendDailySalesSummary(owner.phone, data);
            channel = "whatsapp";
          } else if (emailReady && owner.email) {
            await sendDailySummaryEmail(owner.email, data);
            channel = "email";
          } else {
            logger.warn(`Owner of ${business.name} has no reachable destination; skipping.`);
            continue;
          }

          // Keep an in-app trail of what was sent (shows in the notifications bell).
          await prisma.notification.create({
            data: {
              businessId: business.id,
              type: "daily_summary",
              message: `Daily summary sent via ${channel}: income ${business.currency ?? "XAF"} ${summary.income}, expenses ${summary.expenses}, profit ${summary.profit} (${summary.transactionCount} transactions).`,
              channel,
            },
          });

          logger.info(`Daily summary sent to ${channel === "email" ? owner.email : owner.phone} (${business.name})`);

          // Pace sends so the WhatsApp account doesn't look like a bot blast.
          await new Promise((r) => setTimeout(r, 1500));
        } catch (err) {
          logger.error(`Daily summary failed for business ${business.name}`, err);
        }
      }
    },
    { timezone: env.whatsapp.dailySummaryTimezone }
  );
}
