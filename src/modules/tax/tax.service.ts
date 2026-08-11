import { prisma } from "@config/database";
import { NotFoundError, ValidationError } from "@utils/errors";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { createFilingSchema, updateFilingSchema } from "./tax.validation";

type CreateFilingInput = z.infer<typeof createFilingSchema>;
type UpdateFilingInput = z.infer<typeof updateFilingSchema>;

/** Inclusive month range for a "YYYY-MM" period. */
function periodRange(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

export async function getTaxSummary(businessId: string) {
  const [collectedAgg, paidAgg, transactionAgg, filings, business] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, type: TransactionType.INCOME },
      _sum: { vatAmount: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, type: TransactionType.EXPENSE },
      _sum: { vatAmount: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId },
      _sum: { amount: true },
    }),
    prisma.taxFiling.findMany({ where: { businessId }, orderBy: { period: "desc" } }),
    prisma.business.findUnique({ where: { id: businessId } }),
  ]);

  const vatCollected = Number(collectedAgg._sum.vatAmount ?? 0);
  const vatPaid = Number(paidAgg._sum.vatAmount ?? 0);

  return {
    vatCollected,
    vatPaid,
    vatNet: vatCollected - vatPaid,
    totalSales: Number(transactionAgg._sum.amount ?? 0),
    defaultVatRate: business?.vatRate ?? null,
    filings,
  };
}

export async function getVatLedger(businessId: string, period?: string) {
  const where = {
    businessId,
    vatAmount: { not: null },
    ...(period ? { occurredAt: periodRange(period) } : {}),
  };

  return prisma.transaction.findMany({
    where,
    select: {
      id: true,
      type: true,
      category: true,
      amount: true,
      vatRate: true,
      vatAmount: true,
      occurredAt: true,
      description: true,
      customer: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

export async function listFilings(businessId: string) {
  return prisma.taxFiling.findMany({ where: { businessId }, orderBy: { period: "desc" } });
}

export async function createFiling(businessId: string, input: CreateFilingInput) {
  const existing = await prisma.taxFiling.findFirst({ where: { businessId, period: input.period } });
  if (existing) throw new ValidationError(`A filing for ${input.period} already exists.`);

  const { gte, lt } = periodRange(input.period);

  const [collectedAgg, paidAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, type: TransactionType.INCOME, occurredAt: { gte, lt } },
      _sum: { vatAmount: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, type: TransactionType.EXPENSE, occurredAt: { gte, lt } },
      _sum: { vatAmount: true },
    }),
  ]);

  return prisma.taxFiling.create({
    data: {
      businessId,
      period: input.period,
      vatCollected: input.vatCollected ?? Number(collectedAgg._sum.vatAmount ?? 0),
      vatPaid: input.vatPaid ?? Number(paidAgg._sum.vatAmount ?? 0),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  });
}

export async function updateFiling(businessId: string, filingId: string, input: UpdateFilingInput) {
  const filing = await prisma.taxFiling.findFirst({ where: { id: filingId, businessId } });
  if (!filing) throw new NotFoundError("Tax filing");

  return prisma.taxFiling.update({
    where: { id: filingId },
    data: {
      ...input,
      submittedAt: input.status === "SUBMITTED" && !filing.submittedAt ? new Date() : undefined,
    },
  });
}
