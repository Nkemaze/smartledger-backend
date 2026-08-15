import { z } from "zod";

export const signUpSchema = z
  .object({
    businessName: z.string().min(2),
    shopType: z.string().min(2),
    ownerName: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    verificationMethod: z.enum(["whatsapp", "email"]),
    verificationCode: z.string().length(6, "Enter the 6-digit verification code"),
  })
  .refine((data) => data.verificationMethod !== "email" || Boolean(data.email), {
    message: "An email address is required to verify via email.",
    path: ["email"],
  });

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or phone number
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
});

export const requestVerificationSchema = z.object({
  method: z.enum(["whatsapp", "email"]),
  destination: z.string().min(5),
});
