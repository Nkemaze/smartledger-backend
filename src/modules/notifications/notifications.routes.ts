import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import * as notificationController from "./notifications.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", notificationController.listNotifications);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

export default router;
