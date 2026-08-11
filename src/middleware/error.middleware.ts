import { Request, Response, NextFunction } from "express";
import { AppError } from "@utils/errors";
import { logger } from "@utils/logger";

// Must be registered LAST, after all routes, in app.ts.
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
}
