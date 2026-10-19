import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { UnauthorizedError } from "@utils/errors";
import { Role } from "@prisma/client";

export interface AuthPayload {
  userId: string;
  // Null for platform super-admins, who are not tied to any single business.
  businessId: string | null;
  role: Role;
  platformAdmin?: boolean;
}

// Augment Express's Request type so req.user is typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/**
 * Returns the authenticated user's business id, throwing if there is none.
 * Business-scoped controllers use this instead of `req.user!.businessId`
 * because the field is nullable (platform admins have no business).
 */
export function getBusinessId(req: Request): string {
  const businessId = req.user?.businessId;
  if (!businessId) {
    throw new UnauthorizedError("No business associated with this account");
  }
  return businessId;
}
