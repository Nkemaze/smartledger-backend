import { prisma } from "@config/database";
import { Subscription, SubscriptionPlan } from "@prisma/client";
import { ValidationError } from "@utils/errors";
import { FREE_TRIAL_DAYS, PAID_PLANS, PLAN_CATALOG } from "./plans";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "EXPIRED";

export interface SubscriptionView {
  id: string;
  businessId: string;
  plan: SubscriptionPlan;
  planName: string;
  status: SubscriptionStatus;
  trialUsed: boolean;
  trialEndsAt: Date | null;
  periodEndsAt: Date | null;
  /** Days of access left (trial or paid). Null once expired. */
  daysRemaining: number | null;
  createdAt: Date;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Derives the effective status of a subscription from its plan + dates. */
export function resolveStatus(sub: Subscription): {
  status: SubscriptionStatus;
  daysRemaining: number | null;
} {
  const now = new Date();
  const until = sub.plan === "FREE_TRIAL" ? sub.trialEndsAt : sub.periodEndsAt;

  if (!until || until.getTime() <= now.getTime()) {
    return { status: "EXPIRED", daysRemaining: null };
  }

  const daysRemaining = Math.ceil((until.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    status: sub.plan === "FREE_TRIAL" ? "TRIALING" : "ACTIVE",
    daysRemaining,
  };
}

export function toView(sub: Subscription): SubscriptionView {
  const { status, daysRemaining } = resolveStatus(sub);
  return {
    id: sub.id,
    businessId: sub.businessId,
    plan: sub.plan,
    planName: PLAN_CATALOG[sub.plan].name,
    status,
    trialUsed: sub.trialStartedAt !== null,
    trialEndsAt: sub.trialEndsAt,
    periodEndsAt: sub.periodEndsAt,
    daysRemaining,
    createdAt: sub.createdAt,
  };
}

/** New businesses start on the 1-month free trial automatically. */
export function buildTrialData(now: Date = new Date()) {
  return {
    plan: "FREE_TRIAL" as SubscriptionPlan,
    trialStartedAt: now,
    trialEndsAt: addDays(now, FREE_TRIAL_DAYS),
  };
}

/**
 * Returns the subscription for a business, creating a fresh 1-month
 * free trial if none exists yet (also covers businesses created
 * before the billing feature shipped).
 */
export async function getOrCreateSubscription(businessId: string): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { businessId } });
  if (existing) return existing;

  return prisma.subscription.create({
    data: { businessId, ...buildTrialData() },
  });
}

export async function getSubscriptionView(businessId: string): Promise<SubscriptionView> {
  const sub = await getOrCreateSubscription(businessId);
  return toView(sub);
}

/** Explicitly (re)starts the 1-month free trial. Allowed once per business. */
export async function startFreeTrial(businessId: string): Promise<SubscriptionView> {
  const sub = await getOrCreateSubscription(businessId);
  if (sub.trialStartedAt) {
    throw new ValidationError("The 1-month free trial has already been used for this business.");
  }

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: buildTrialData(),
  });
  return toView(updated);
}

/**
 * Activates a paid plan for one month. If a paid period is still running,
 * the new month is appended to its end (unused time is kept).
 * NOTE: actual payment collection (mobile money) is a follow-up; selecting
 * a plan currently activates it directly.
 */
export async function selectPlan(businessId: string, plan: SubscriptionPlan): Promise<SubscriptionView> {
  if (plan === "FREE_TRIAL") {
    return startFreeTrial(businessId);
  }
  if (!PAID_PLANS.includes(plan)) {
    throw new ValidationError("Unknown subscription plan.");
  }

  const sub = await getOrCreateSubscription(businessId);
  const now = new Date();
  const currentEnd = sub.periodEndsAt && sub.periodEndsAt.getTime() > now.getTime() ? sub.periodEndsAt : now;

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { plan, periodEndsAt: addDays(currentEnd, 30) },
  });
  return toView(updated);
}

export async function isSubscriptionActive(businessId: string): Promise<boolean> {
  const sub = await getOrCreateSubscription(businessId);
  return resolveStatus(sub).status !== "EXPIRED";
}
