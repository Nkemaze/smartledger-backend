import { Request, Response, NextFunction } from "express";
import { isSubscriptionActive } from "@modules/subscriptions/subscriptions.service";
import { PaymentRequiredError, UnauthorizedError } from "@utils/errors";

/**
 * Blocks access to core business data once the subscription (free trial or
 * paid plan) has expired, per the Business Plan §2.4 subscription model.
 * Account management, billing, notifications and offline sync stay open so
 * the owner can still renew. Must run after authMiddleware.
 */
export async function requireActiveSubscription(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    // Platform super-admins have no business subscription to check.
    if (req.user.platformAdmin && !req.user.businessId) {
      return next();
    }

    if (!req.user.businessId) {
      throw new UnauthorizedError("No business associated with this account");
    }

    const active = await isSubscriptionActive(req.user.businessId);
    if (!active) {
      throw new PaymentRequiredError();
    }

    next();
  } catch (err) {
    next(err);
  }
}
