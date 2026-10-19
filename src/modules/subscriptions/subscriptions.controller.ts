import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { SubscriptionPlan } from "@prisma/client";
import { PLAN_CATALOG } from "./plans";
import type { BillingCycle } from "./subscriptions.service";
import * as subscriptionsService from "./subscriptions.service";

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.getSubscriptionView(getBusinessId(req));
  return ok(res, view);
});

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, Object.values(PLAN_CATALOG));
});

export const selectPlan = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.selectPlan(
    getBusinessId(req),
    req.body.plan as SubscriptionPlan,
    req.body.billingCycle as BillingCycle | undefined,
  );
  return ok(res, view);
});

export const startTrial = asyncHandler(async (req: Request, res: Response) => {
  const view = await subscriptionsService.startFreeTrial(getBusinessId(req));
  return ok(res, view);
});
