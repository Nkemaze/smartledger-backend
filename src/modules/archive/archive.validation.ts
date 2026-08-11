import { z } from "zod";

// File itself is handled by multer; this validates the metadata fields.
export const createDocumentSchema = z.object({
  type: z.enum(["receipt", "invoice", "statement"]),
  transactionId: z.string().uuid().optional().nullable(),
});
