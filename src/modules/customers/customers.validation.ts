import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  balance: z.coerce.number().min(0).optional().default(0),
});

export const updateCustomerSchema = createCustomerSchema.partial();
