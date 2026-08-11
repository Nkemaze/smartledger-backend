import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as advisorService from "./advisor.service";

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const result = await advisorService.getInsights(req.user!.businessId);
  return ok(res, result);
});
