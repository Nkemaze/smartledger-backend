import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { z } from "zod";
import * as inboxService from "@modules/inbox/inbox.service";

/**
 * The platform inbox is exactly the messages sent to the platform's WhatsApp
 * number — those with no business attached (businessId = null). Businesses
 * receive their own WhatsApp messages directly, so there is no store filter.
 */
export const listConversations = asyncHandler(async (_req: Request, res: Response) => {
  const conversations = await inboxService.listAdminConversations();
  return ok(res, conversations);
});

export const unreadCount = asyncHandler(async (_req: Request, res: Response) => {
  const count = await inboxService.adminUnreadCount();
  return ok(res, { count });
});

export const getThread = asyncHandler(async (req: Request, res: Response) => {
  const messages = await inboxService.listAdminThread(req.params.phone);
  return ok(res, messages);
});

export const sendReply = asyncHandler(async (req: Request, res: Response) => {
  const { text } = z.object({ text: z.string().min(1).max(4096) }).parse(req.body);
  const message = await inboxService.sendReply(null, req.params.phone, text);
  return ok(res, message);
});
