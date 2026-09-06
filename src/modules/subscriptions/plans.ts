import { SubscriptionPlan } from "@prisma/client";

export interface PlanDefinition {
  plan: SubscriptionPlan;
  name: string;
  tagline: string;
  monthlyPrice: number; // FCFA per month
  /** Annual price in FCFA. Billing yearly = pay 10 months, get 2 free. */
  annualPrice: number;
  /** Number of months billed when paying annually (10 of 12). */
  annualBilledMonths: number;
  trialDays?: number; // FREE_TRIAL only
  features: string[];
}

/** Business Plan §2.4 – Free trial lasts one month. */
export const FREE_TRIAL_DAYS = 30;

/** Months covered when paying annually (pay 10, get 12 months of access). */
export const ANNUAL_BILLED_MONTHS = 10;
export const ANNUAL_COVERED_MONTHS = 12;

/** Access added to a subscription period per billing cycle (in days). */
export const MONTHLY_DAYS = 30;
export const ANNUAL_DAYS = 365;

export function annualPriceFor(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_BILLED_MONTHS;
}

/**
 * Subscription catalog (Business Plan §2.2 / §2.4):
 * Basic 2,500 FCFA, Standard 7,500 FCFA, Premium 12,500 FCFA per month.
 * Paying yearly = 10 months billed for 12 months of access (2 months free).
 * Plus a 1-month free trial granted automatically at signup.
 */
export const PLAN_CATALOG: Record<SubscriptionPlan, PlanDefinition> = {
  FREE_TRIAL: {
    plan: "FREE_TRIAL",
    name: "Free Trial",
    tagline: "Try everything SmartLedger offers, free for 1 month",
    monthlyPrice: 0,
    annualPrice: 0,
    annualBilledMonths: 0,
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
    monthlyPrice: 2500,
    annualPrice: 25000,
    annualBilledMonths: ANNUAL_BILLED_MONTHS,
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
    annualPrice: 75000,
    annualBilledMonths: ANNUAL_BILLED_MONTHS,
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
    annualPrice: 125000,
    annualBilledMonths: ANNUAL_BILLED_MONTHS,
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
