import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as advisorService from "./advisor.service";

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const result = await advisorService.getInsights(getBusinessId(req));
  return ok(res, result);
});

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const result = await advisorService.chat(getBusinessId(req), req.body.message, req.body.history ?? []);
  return ok(res, result);
});
