import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitPrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0).optional().default(0),
  reorderThreshold: z.coerce.number().int().min(0).optional().default(5),
});

export const updateProductSchema = createProductSchema.partial();

export const adjustStockSchema = z.object({
  quantity: z.coerce.number().int(), // signed delta, e.g. -3 to sell 3, +10 to restock 10
  reason: z.string().optional(),
});
