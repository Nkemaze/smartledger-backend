import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as userService from "./user.service";

export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.listStaff(req.user!.businessId);
  return ok(res, staff);
});

export const addStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.addStaff(req.user!.businessId, req.body);
  return created(res, staff);
});

export const updateStaffRole = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaffRole(req.user!.businessId, req.params.id, req.body);
  return ok(res, staff);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaff(req.user!.businessId, req.params.id, req.body);
  return ok(res, staff);
});

export const getStaffPerformance = asyncHandler(async (req: Request, res: Response) => {
  const performance = await userService.getStaffPerformance(req.user!.businessId, req.params.id);
  return ok(res, performance);
});

export const removeStaff = asyncHandler(async (req: Request, res: Response) => {
  await userService.removeStaff(req.user!.businessId, req.params.id);
  return noContent(res);
});
