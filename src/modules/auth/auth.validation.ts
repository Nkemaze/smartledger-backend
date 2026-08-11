import { z } from "zod";

export const signUpSchema = z.object({
  businessName: z.string().min(2),
  shopType: z.string().min(2),
  ownerName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or phone number
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
});
