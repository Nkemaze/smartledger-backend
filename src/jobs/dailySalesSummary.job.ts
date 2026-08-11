import cron from "node-cron";
import { prisma } from "@config/database";
import { logger } from "@utils/logger";
import { Role } from "@prisma/client";
import { sendDailySalesSummary, isWhatsAppConfigured } from "@services/whatsapp.service";

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);

/**
 * Sends each business owner a daily WhatsApp summary of income, expenses,
 * and profit (SRS: WA-REQ-001). Scheduled once a day at 20:00 server time.
 * Requires the "daily_sales_summary" template approved in the WhatsApp portal.
 */
export function scheduleDailySalesSummary() {
  cron.schedule("0 20 * * *", async () => {
    logger.info("Running daily sales summary job...");

    if (!isWhatsAppConfigured()) {
      logger.warn("WhatsApp is not configured; skipping daily summaries.");
      return;
    }

    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        currency: true,
        users: { select: { phone: true, role: true }, where: { isActive: true } },
      },
    });

    for (const business of businesses) {
      try {
        const owner = business.users.find((u) => u.role === Role.OWNER);
        if (!owner?.phone) {
          logger.warn(`No owner phone for business ${business.name}; skipping.`);
          continue;
        }

        const [incomeAgg, expenseAgg] = await Promise.all([
          prisma.transaction.aggregate({
            where: { businessId: business.id, type: "INCOME", occurredAt: { gte: startOfToday } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { businessId: business.id, type: "EXPENSE", occurredAt: { gte: startOfToday } },
            _sum: { amount: true },
          }),
        ]);

        const income = Number(incomeAgg._sum.amount ?? 0);
        const expenses = Number(expenseAgg._sum.amount ?? 0);
        const profit = income - expenses;

        await sendDailySalesSummary(owner.phone, {
          businessName: business.name,
          income: income.toLocaleString("en-US"),
          expenses: expenses.toLocaleString("en-US"),
          profit: profit.toLocaleString("en-US"),
          currency: business.currency ?? "XAF",
        });

        logger.info(`Daily summary sent to ${owner.phone} (${business.name})`);
      } catch (err) {
        logger.error(`Daily summary failed for business ${business.name}`, err);
      }
    }
  });
}
