import { prisma } from "@config/database";
import { NotFoundError, ValidationError } from "@utils/errors";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { createTransactionSchema, updateTransactionSchema } from "./transactions.validation";

type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export type ListTransactionFilters = {
  type?: TransactionType;
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

/**
 * Creates a low-stock in-app notification. Called after any stock decrement
 * so the Owner is alerted the moment a product dips to/under its threshold.
 */
async function createLowStockNotifications(businessId: string, products: { id: string; name: string; stockQuantity: number }[]) {
  for (const product of products) {
    await prisma.notification.create({
      data: {
        businessId,
        type: "low_stock",
        message: `"${product.name}" is low on stock (${product.stockQuantity} left). Reorder soon.`,
        channel: "in_app",
      },
    });
  }
}

export async function listTransactions(businessId: string, filters: ListTransactionFilters) {
  return prisma.transaction.findMany({
    where: {
      businessId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.from || filters.to
        ? {
            occurredAt: {
              ...(filters.from ? { gte: toDate(filters.from) } : {}),
              ...(filters.to ? { lte: toDate(filters.to) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? { description: { contains: filters.search, mode: "insensitive" } }
        : {}),
    },
    include: { customer: { select: { id: true, name: true } }, user: { select: { id: true, name: true } }, items: true },
    orderBy: { occurredAt: "desc" },
    ...(filters.limit ? { take: filters.limit } : {}),
    ...(filters.offset ? { skip: filters.offset } : {}),
  });
}

export async function getTransaction(businessId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, businessId },
    include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } },
  });
  if (!transaction) throw new NotFoundError("Transaction");
  return transaction;
}

/**
 * Creates an income (sale) or expense transaction.
 *
 * - INCOME with `items`: validates each product belongs to the business,
 *   decrements stock (refusing oversell), writes TransactionItems, and raises
 *   low-stock notifications when a product hits its threshold.
 * - VAT: if `vatRate` is given and `vatAmount` isn't, the VAT portion is
 *   derived from the amount (`amount * vatRate / 100`), where `amount` is the
 *   net value.
 */
export async function createTransaction(businessId: string, userId: string | undefined, input: CreateTransactionInput) {
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  let vatAmount = input.vatAmount;

  if (vatAmount === undefined && input.vatRate !== undefined && input.vatRate !== null) {
    vatAmount = Math.round(input.amount * input.vatRate) / 100; // amount * (vatRate / 100)
  }

  if (!input.items || input.items.length === 0) {
    return prisma.transaction.create({
      data: {
        businessId,
        userId,
        type: input.type,
        category: input.category,
        amount: input.amount,
        description: input.description,
        customerId: input.customerId,
        vatRate: input.vatRate,
        vatAmount,
        occurredAt,
      },
    });
  }

  // Validate products up front so a bad item doesn't partially apply.
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, businessId } });
  if (products.length !== new Set(productIds).size) {
    throw new ValidationError("One or more products do not belong to this business.");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    if (item.quantity > product.stockQuantity) {
      throw new ValidationError(`Insufficient stock for "${product.name}" (${product.stockQuantity} available).`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        businessId,
        userId,
        type: input.type,
        category: input.category,
        amount: input.amount,
        description: input.description,
        customerId: input.customerId,
        vatRate: input.vatRate,
        vatAmount,
        occurredAt,
        items: {
          create: input.items!.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? product.unitPrice,
            };
          }),
        },
      },
    });

    for (const item of input.items!) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }

    return transaction;
  });

  // Raise low-stock alerts for any product that crossed its threshold.
  const affected = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, stockQuantity: true, reorderThreshold: true },
  });
  await createLowStockNotifications(
    businessId,
    affected.filter((p) => p.stockQuantity <= p.reorderThreshold)
  );

  return result;
}

export async function updateTransaction(businessId: string, transactionId: string, input: UpdateTransactionInput) {
  await getTransaction(businessId, transactionId);

  let vatAmount = input.vatAmount;
  if (vatAmount === undefined && input.vatRate !== undefined && input.vatRate !== null) {
    const amount = input.amount ?? (await prisma.transaction.findUnique({ where: { id: transactionId } }))?.amount ?? 0;
    vatAmount = Math.round(Number(amount) * input.vatRate) / 100;
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { ...input, vatAmount },
  });
}

export async function deleteTransaction(businessId: string, transactionId: string) {
  await getTransaction(businessId, transactionId);
  await prisma.transaction.delete({ where: { id: transactionId } });
}

/** Quick aggregate totals (revenue, expenses, profit) used across modules. */
export async function getTotals(businessId: string, from?: string, to?: string) {
  const where = {
    businessId,
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: toDate(from) } : {}),
            ...(to ? { lte: toDate(to) } : {}),
          },
        }
      : {}),
  };

  const [revenue, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: TransactionType.INCOME },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: TransactionType.EXPENSE },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const income = Number(revenue._sum.amount ?? 0);
  const expense = Number(expenses._sum.amount ?? 0);

  return {
    revenue: income,
    expenses: expense,
    profit: income - expense,
    transactionCount: revenue._count + expenses._count,
  };
}
