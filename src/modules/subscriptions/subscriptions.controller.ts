import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { SubscriptionPlan } from "@prisma/client";
import { PLAN_CATALOG } from "./plans";
import * as subscriptionsService from "./subscriptions.service";

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.getSubscriptionView(req.user!.businessId);
  return ok(res, view);
});

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, Object.values(PLAN_CATALOG));
});

export const selectPlan = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.selectPlan(req.user!.businessId, req.body.plan as SubscriptionPlan);
  return ok(res, view);
});

export const startTrial = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.startFreeTrial(req.user!.businessId);
  return ok(res, view);
});
