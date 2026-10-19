import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as businessService from "./business.service";

export const getBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessService.getBusiness(getBusinessId(req));
  return ok(res, business);
});

export const updateBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessService.updateBusiness(getBusinessId(req), req.body);
  return ok(res, business);
});
