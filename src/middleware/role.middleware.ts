import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@utils/errors";

/**
 * Enforces the flexible role model described in the SRS (Section 2.4):
 * - OWNER always has full access, regardless of which roles are listed here.
 * - Any other role (CASHIER, ACCOUNTANT) must be explicitly included in
 *   `allowedRoles` for the route to be reachable.
 *
 * Usage: router.get('/reports', authMiddleware, requireRole(Role.ACCOUNTANT), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.role === Role.OWNER) {
      return next(); // Owner always has full access
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}
