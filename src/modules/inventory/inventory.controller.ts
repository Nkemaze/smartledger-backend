import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as inventoryService from "./inventory.service";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const products = await inventoryService.listProducts(req.user!.businessId, {
    search: req.query.search as string | undefined,
    category: req.query.category as string | undefined,
    lowStock: req.query.lowStock === "true",
  });
  return ok(res, products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await inventoryService.getProduct(req.user!.businessId, req.params.id);
  return ok(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await inventoryService.createProduct(req.user!.businessId, req.body);
  return created(res, product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await inventoryService.updateProduct(req.user!.businessId, req.params.id, req.body);
  return ok(res, product);
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const product = await inventoryService.adjustStock(req.user!.businessId, req.params.id, req.body);
  return ok(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await inventoryService.deleteProduct(req.user!.businessId, req.params.id);
  return noContent(res);
});
