import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok } from "@utils/apiResponse";
import { isWhatsAppConfigured } from "@services/whatsapp.service";
import { isEmailConfigured } from "@services/email.service";
import { env } from "@config/env";
import * as authService from "./auth.service";
import * as otpService from "./otp.service";

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  // Verification now happens BEFORE account creation: the code was already
  // sent via POST /auth/verification/request and is consumed inside signUp.
  const result = await authService.signUp(req.body);
  return created(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  return ok(res, result);
});

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  await otpService.requestOtp(req.body.phone);
  return ok(res, { message: "Verification code sent." });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  otpService.verifyOtp(req.body.phone, req.body.code);
  return ok(res, { message: "Phone number verified." });
});

/** POST /auth/verification/request — sends a signup code via WhatsApp or email. */
export const requestSignupVerification = asyncHandler(async (req: Request, res: Response) => {
  const { method, destination } = req.body as { method: "whatsapp" | "email"; destination: string };
  if (!env.signupVerificationRequired) {
    // Verification temporarily disabled server-side — succeed without sending
    // so older clients (mobile APKs already in the wild) keep working.
    return ok(res, { message: "Verification is currently disabled." });
  }
  await otpService.requestSignupVerification(method, destination);
  return ok(res, { message: `Verification code sent via ${method}.` });
});

/** GET /auth/verification/channels — public: which signup verification methods are live. */
export const getVerificationChannels = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, {
    whatsapp: isWhatsAppConfigured(),
    email: isEmailConfigured(),
    required: env.signupVerificationRequired,
  });
});
