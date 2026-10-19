import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok } from "@utils/apiResponse";
import * as taxService from "./tax.service";

export const getTaxSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await taxService.getTaxSummary(getBusinessId(req));
  return ok(res, summary);
});

export const getVatLedger = asyncHandler(async (req: Request, res: Response) => {
  const ledger = await taxService.getVatLedger(getBusinessId(req), req.query.period as string | undefined);
  return ok(res, ledger);
});

export const listFilings = asyncHandler(async (req: Request, res: Response) => {
  const filings = await taxService.listFilings(getBusinessId(req));
  return ok(res, filings);
});

export const createFiling = asyncHandler(async (req: Request, res: Response) => {
  const filing = await taxService.createFiling(getBusinessId(req), req.body);
  return created(res, filing);
});

export const updateFiling = asyncHandler(async (req: Request, res: Response) => {
  const filing = await taxService.updateFiling(getBusinessId(req), req.params.id, req.body);
  return ok(res, filing);
});
