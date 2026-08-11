import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as reportService from "./reports.service";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await reportService.getDashboard(req.user!.businessId);
  return ok(res, dashboard);
});

export const getPnl = asyncHandler(async (req: Request, res: Response) => {
  const pnl = await reportService.getPnl(req.user!.businessId, req.query.from as string | undefined, req.query.to as string | undefined);
  return ok(res, pnl);
});

export const getBalanceSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheet = await reportService.getBalanceSheet(req.user!.businessId);
  return ok(res, sheet);
});

export const exportTransactions = asyncHandler(async (req: Request, res: Response) => {
  const csv = await reportService.exportTransactionsCsv(req.user!.businessId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="transactions.csv"');
  return res.send(csv);
});
