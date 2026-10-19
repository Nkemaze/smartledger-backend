import { getBusinessId } from '@middleware/auth.middleware';
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ok } from "@utils/apiResponse";
import * as notificationService from "./notifications.service";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await notificationService.listNotifications(getBusinessId(req), req.query.unread === "true");
  return ok(res, notifications);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.unreadCount(getBusinessId(req));
  return ok(res, { count });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationService.markAsRead(getBusinessId(req), req.params.id);
  return ok(res, notification);
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllAsRead(getBusinessId(req));
  return ok(res, { message: "All notifications marked as read." });
});
