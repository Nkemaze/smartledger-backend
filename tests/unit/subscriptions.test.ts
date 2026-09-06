import { describe, it, expect } from "vitest";
import { Subscription } from "@prisma/client";
import {
  addDays,
  buildTrialData,
  resolveStatus,
} from "../../src/modules/subscriptions/subscriptions.service";
import {
  ANNUAL_BILLED_MONTHS,
  annualPriceFor,
  PLAN_CATALOG,
} from "../../src/modules/subscriptions/plans";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    businessId: "biz-1",
    plan: "FREE_TRIAL",
    trialStartedAt: null,
    trialEndsAt: null,
    periodEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("subscriptions.service", () => {
  it("buildTrialData starts a 30-day (1 month) free trial", () => {
    const now = new Date("2026-08-21T10:00:00Z");
    const data = buildTrialData(now);

    expect(data.plan).toBe("FREE_TRIAL");
    expect(data.trialStartedAt).toEqual(now);
    expect(data.trialEndsAt).toEqual(addDays(now, 30));
  });

  it("resolveStatus reports TRIALING with days remaining during the trial", () => {
    const sub = makeSub({ trialEndsAt: addDays(new Date(), 12) });
    const { status, daysRemaining } = resolveStatus(sub);

    expect(status).toBe("TRIALING");
    expect(daysRemaining).toBe(12);
  });

  it("resolveStatus reports ACTIVE for a paid plan within its period", () => {
    const sub = makeSub({ plan: "STANDARD", periodEndsAt: addDays(new Date(), 5) });
    const { status, daysRemaining } = resolveStatus(sub);

    expect(status).toBe("ACTIVE");
    expect(daysRemaining).toBe(5);
  });

  it("resolveStatus reports EXPIRED once the trial end date has passed", () => {
    const sub = makeSub({ trialEndsAt: addDays(new Date(), -1) });
    const { status, daysRemaining } = resolveStatus(sub);

    expect(status).toBe("EXPIRED");
    expect(daysRemaining).toBeNull();
  });

  it("resolveStatus reports EXPIRED when there are no dates at all", () => {
    const { status } = resolveStatus(makeSub());
    expect(status).toBe("EXPIRED");
  });

  it("annual billing charges 10 months for a year (2 months free)", () => {
    expect(ANNUAL_BILLED_MONTHS).toBe(10);
    expect(annualPriceFor(2500)).toBe(25000);
    expect(annualPriceFor(7500)).toBe(75000);
    expect(annualPriceFor(12500)).toBe(125000);
  });

  it("Basic is priced at 2,500 FCFA/month", () => {
    expect(PLAN_CATALOG.BASIC.monthlyPrice).toBe(2500);
    expect(PLAN_CATALOG.BASIC.annualPrice).toBe(PLAN_CATALOG.BASIC.monthlyPrice * 10);
  });
});
