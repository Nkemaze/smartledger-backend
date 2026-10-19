import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { z } from "zod";
import * as inboxService from "./inbox.service";

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await inboxService.listConversations(getBusinessId(req));
  return ok(res, conversations);
});

export const getThread = asyncHandler(async (req: Request, res: Response) => {
  const messages = await inboxService.listThread(getBusinessId(req), req.params.phone);
  return ok(res, messages);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await inboxService.unreadCount(getBusinessId(req));
  return ok(res, { count });
});

export const sendReply = asyncHandler(async (req: Request, res: Response) => {
  const { text } = z.object({ text: z.string().min(1).max(4096) }).parse(req.body);
  const message = await inboxService.sendReply(getBusinessId(req), req.params.phone, text);
  return ok(res, message);
});
