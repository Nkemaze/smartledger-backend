import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { created, ok, noContent } from "@utils/apiResponse";
import * as archiveService from "./archive.service";

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const documents = await archiveService.listDocuments(req.user!.businessId);
  return ok(res, documents);
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: "No file was uploaded." });
    return;
  }
  const document = await archiveService.createDocument(req.user!.businessId, req.file, {
    type: req.body.type,
    transactionId: req.body.transactionId,
  });
  return created(res, document);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await archiveService.deleteDocument(req.user!.businessId, req.params.id);
  return noContent(res);
});
