import { z } from "zod";

export const selectPlanSchema = z.object({
  plan: z.enum(["FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"]),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
});
