import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as syncService from "./sync.service";

export const push = asyncHandler(async (req: Request, res: Response) => {
  const results = await syncService.pushChanges(req.user!.businessId, req.user?.userId, req.body.changes);
  return ok(res, { results });
});

export const pull = asyncHandler(async (req: Request, res: Response) => {
  const since = req.query.since as string | undefined;
  const data = await syncService.pullChanges(req.user!.businessId, since);
  return ok(res, data);
});
