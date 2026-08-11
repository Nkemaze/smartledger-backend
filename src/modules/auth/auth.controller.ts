import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok } from "@utils/apiResponse";
import * as authService from "./auth.service";
import * as otpService from "./otp.service";

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signUp(req.body);
  await otpService.requestOtp(req.body.phone); // send verification code right after signup
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
