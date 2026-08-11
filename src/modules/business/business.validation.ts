import { z } from "zod";

export const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  shopType: z.string().min(2).optional(),
  currency: z.string().min(1).optional(),
  taxId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  filingFrequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).optional().nullable(),
});
