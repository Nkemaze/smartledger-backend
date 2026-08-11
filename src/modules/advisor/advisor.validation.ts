import { z } from "zod";

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(chatMessage).max(20).optional(),
});

export type ChatMessage = z.infer<typeof chatMessage>;
