import { z } from "zod";

// Period format: "YYYY-MM" e.g. "2026-07"
export const periodSchema = z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format");

export const createFilingSchema = z.object({
  period: periodSchema,
  vatCollected: z.coerce.number().min(0).optional(), // defaults to computed from transactions
  vatPaid: z.coerce.number().min(0).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateFilingSchema = z.object({
  vatCollected: z.coerce.number().min(0).optional(),
  vatPaid: z.coerce.number().min(0).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "PAID"]).optional(),
  dueDate: z.string().datetime().optional(),
});
