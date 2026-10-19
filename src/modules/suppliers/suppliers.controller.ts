import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as supplierService from "./suppliers.service";

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const suppliers = await supplierService.listSuppliers(getBusinessId(req), req.query.search as string | undefined);
  return ok(res, suppliers);
});

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.getSupplier(getBusinessId(req), req.params.id);
  return ok(res, supplier);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.createSupplier(getBusinessId(req), req.body);
  return created(res, supplier);
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.updateSupplier(getBusinessId(req), req.params.id, req.body);
  return ok(res, supplier);
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  await supplierService.deleteSupplier(getBusinessId(req), req.params.id);
  return noContent(res);
});
