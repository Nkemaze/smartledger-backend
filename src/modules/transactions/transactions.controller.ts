import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as transactionService from "./transactions.service";

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await transactionService.listTransactions(req.user!.businessId, {
    type: req.query.type as never,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  return ok(res, transactions);
});

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await transactionService.getTransaction(req.user!.businessId, req.params.id);
  return ok(res, transaction);
});

export const createTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await transactionService.createTransaction(req.user!.businessId, req.user?.userId, req.body);
  return created(res, transaction);
});

export const updateTransaction = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await transactionService.updateTransaction(req.user!.businessId, req.params.id, req.body);
  return ok(res, transaction);
});

export const deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
  await transactionService.deleteTransaction(req.user!.businessId, req.params.id);
  return noContent(res);
});
