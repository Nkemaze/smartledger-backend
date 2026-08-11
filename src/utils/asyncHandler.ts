import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async controller function so any thrown error / rejected
 * promise is automatically forwarded to Express's error middleware,
 * instead of needing a try/catch in every single controller.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
