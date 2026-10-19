import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as userService from "./user.service";

export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.listStaff(getBusinessId(req));
  return ok(res, staff);
});

export const addStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.addStaff(getBusinessId(req), req.body);
  return created(res, staff);
});

export const updateStaffRole = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaffRole(getBusinessId(req), req.params.id, req.body);
  return ok(res, staff);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaff(getBusinessId(req), req.params.id, req.body);
  return ok(res, staff);
});

export const getStaffPerformance = asyncHandler(async (req: Request, res: Response) => {
  const performance = await userService.getStaffPerformance(getBusinessId(req), req.params.id);
  return ok(res, performance);
});

export const removeStaff = asyncHandler(async (req: Request, res: Response) => {
  await userService.removeStaff(getBusinessId(req), req.params.id);
  return noContent(res);
});
