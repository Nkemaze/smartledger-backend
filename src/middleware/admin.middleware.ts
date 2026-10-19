import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "@utils/errors";

/**
 * Guards routes that are only reachable by platform super-admin accounts
 * (not business OWNERs). The `platformAdmin` claim must be set in the JWT
 * at login/signup time, and is only true for accounts flagged in the DB.
 */
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  if (!req.user.platformAdmin) {
    throw new ForbiddenError("Platform admin access required");
  }
  next();
}
