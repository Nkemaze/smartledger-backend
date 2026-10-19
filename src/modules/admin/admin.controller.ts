import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { z } from "zod";
import * as adminService from "./admin.service";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  return ok(res, stats);
});

export const listBusinesses = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  const query = parsed.success ? parsed.data : {};
  const result = await adminService.listBusinesses(query);
  return ok(res, result);
});

export const getBusinessDetail = asyncHandler(async (req: Request, res: Response) => {
  const business = await adminService.getBusinessDetail(req.params.id);
  return ok(res, business);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  const query = parsed.success ? parsed.data : {};
  const result = await adminService.listUsers(query);
  return ok(res, result);
});

export const setUserActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const user = await adminService.setUserActive(req.params.id, isActive);
  return ok(res, user);
});

export const extendSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { days } = z.object({ days: z.number().int().min(1).max(365) }).parse(req.body);
  const sub = await adminService.extendSubscription(req.params.id, days);
  return ok(res, sub);
});
