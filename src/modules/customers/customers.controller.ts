import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as customerService from "./customers.service";

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const customers = await customerService.listCustomers(req.user!.businessId, req.query.search as string | undefined);
  return ok(res, customers);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.getCustomer(req.user!.businessId, req.params.id);
  return ok(res, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.createCustomer(req.user!.businessId, req.body);
  return created(res, customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.updateCustomer(req.user!.businessId, req.params.id, req.body);
  return ok(res, customer);
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  await customerService.deleteCustomer(req.user!.businessId, req.params.id);
  return noContent(res);
});
