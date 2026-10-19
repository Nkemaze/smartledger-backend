import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import { z } from "zod";
import * as inboxService from "@modules/inbox/inbox.service";

/**
 * Resolves the inbox scope from the query string:
 *  - `businessId=<id>`  → that store only
 *  - `businessId=unassigned` → messages with no business (sent to the platform)
 *  - omitted            → every business (full platform oversight)
 */
function parseScope(req: Request): inboxService.AdminInboxScope {
  const raw = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (raw === undefined) return {};
  if (raw === "unassigned") return { businessId: null };
  return { businessId: raw };
}

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await inboxService.listAdminConversations(parseScope(req));
  return ok(res, conversations);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await inboxService.adminUnreadCount(parseScope(req));
  return ok(res, { count });
});

export const listBusinesses = asyncHandler(async (_req: Request, res: Response) => {
  const businesses = await inboxService.listInboxBusinesses();
  return ok(res, businesses);
});

export const getThread = asyncHandler(async (req: Request, res: Response) => {
  const messages = await inboxService.listAdminThread(parseScope(req), req.params.phone);
  return ok(res, messages);
});

export const sendReply = asyncHandler(async (req: Request, res: Response) => {
  const { text } = z.object({ text: z.string().min(1).max(4096) }).parse(req.body);
  const scope = parseScope(req);
  // Replies are stored against the scoped business (or unassigned for platform).
  const businessId = scope.businessId === undefined ? null : scope.businessId;
  const message = await inboxService.sendReply(businessId, req.params.phone, text);
  return ok(res, message);
});
