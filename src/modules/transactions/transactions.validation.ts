import { z } from "zod";
import { TransactionType } from "@prisma/client";

export const transactionItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0).optional(), // defaults to the product's current unit price
});

export const createTransactionSchema = z.object({
  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]),
  category: z.string().min(1),
  amount: z.coerce.number().min(0),
  description: z.string().optional().nullable(),
  occurredAt: z.string().datetime().optional(), // defaults to now
  customerId: z.string().uuid().optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  vatAmount: z.coerce.number().min(0).optional().nullable(),
  items: z.array(transactionItemSchema).optional(), // income sales with line items
});

export const updateTransactionSchema = z.object({
  category: z.string().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  description: z.string().optional().nullable(),
  occurredAt: z.string().datetime().optional(),
  customerId: z.string().uuid().optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  vatAmount: z.coerce.number().min(0).optional().nullable(),
});
