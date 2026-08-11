import { z } from "zod";

export const sendMessageSchema = z.object({
  to: z.string().min(8),
  templateName: z.string().optional(),
  text: z.string().optional(),
  parameters: z
    .array(
      z.object({
        type: z.enum(["text", "currency", "date_time"]),
        text: z.string().optional(),
        currency: z.string().optional(),
        amount_1000: z.number().optional(),
        fallback_value: z.string().optional(),
      })
    )
    .optional(),
});
