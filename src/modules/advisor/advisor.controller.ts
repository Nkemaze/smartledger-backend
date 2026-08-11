import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as advisorService from "./advisor.service";

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const result = await advisorService.getInsights(req.user!.businessId);
  return ok(res, result);
});

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const result = await advisorService.chat(req.user!.businessId, req.body.message, req.body.history ?? []);
  return ok(res, result);
});
