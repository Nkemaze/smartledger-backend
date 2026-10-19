import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as customerService from "./customers.service";

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const customers = await customerService.listCustomers(getBusinessId(req), req.query.search as string | undefined);
  return ok(res, customers);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.getCustomer(getBusinessId(req), req.params.id);
  return ok(res, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.createCustomer(getBusinessId(req), req.body);
  return created(res, customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.updateCustomer(getBusinessId(req), req.params.id, req.body);
  return ok(res, customer);
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  await customerService.deleteCustomer(getBusinessId(req), req.params.id);
  return noContent(res);
});
