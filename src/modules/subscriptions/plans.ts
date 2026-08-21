import { SubscriptionPlan } from "@prisma/client";

export interface PlanDefinition {
  plan: SubscriptionPlan;
  name: string;
  tagline: string;
  monthlyPrice: number; // FCFA per month
  trialDays?: number; // FREE_TRIAL only
  features: string[];
}

/** Business Plan §2.4 – Free trial lasts one month. */
export const FREE_TRIAL_DAYS = 30;

/**
 * Subscription catalog (Business Plan §2.2 / §2.4):
 * Basic 3,500 FCFA, Standard 7,500 FCFA, Premium 12,500 FCFA per month,
 * plus a 1-month free trial granted automatically at signup.
 */
export const PLAN_CATALOG: Record<SubscriptionPlan, PlanDefinition> = {
  FREE_TRIAL: {
    plan: "FREE_TRIAL",
    name: "Free Trial",
    tagline: "Try everything SmartLedger offers, free for 1 month",
    monthlyPrice: 0,
    trialDays: FREE_TRIAL_DAYS,
    features: [
      "Full access to all Premium features for 1 month",
      "Sales & expense recording",
      "Inventory management",
      "Customer management",
      "Reports & profit analysis",
      "AI business recommendations",
      "WhatsApp notifications",
      "No payment required to start",
    ],
  },
  BASIC: {
    plan: "BASIC",
    name: "Basic",
    tagline: "For small businesses that need simple, affordable record-keeping",
    monthlyPrice: 3500,
    features: [
      "Sales recording",
      "Expense tracking",
      "Basic inventory management",
      "Weekly sales reports",
      "Cloud storage",
      "WhatsApp notifications",
    ],
  },
  STANDARD: {
    plan: "STANDARD",
    name: "Standard",
    tagline: "For growing businesses that need insights and control",
    monthlyPrice: 7500,
    features: [
      "Everything in Basic",
      "Inventory alerts",
      "Customer management tools",
      "Business performance reports",
      "Profit analysis",
      "AI recommendations",
    ],
  },
  PREMIUM: {
    plan: "PREMIUM",
    name: "Premium",
    tagline: "For larger businesses with complex operations",
    monthlyPrice: 12500,
    features: [
      "Everything in Standard",
      "Sales forecasting",
      "Employee management",
      "Advanced business analytics",
      "Priority customer support",
      "Mobile money integration",
    ],
  },
};

export const PAID_PLANS: SubscriptionPlan[] = ["BASIC", "STANDARD", "PREMIUM"];
