import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requirePlatformAdmin } from "@middleware/admin.middleware";
import * as adminController from "./admin.controller";
import * as adminInboxController from "./admin.inbox.controller";

const router = Router();

// Every admin route requires a valid JWT + platformAdmin flag.
router.use(authMiddleware);
router.use(requirePlatformAdmin);

router.get("/stats", adminController.getDashboardStats);
router.get("/businesses", adminController.listBusinesses);
router.get("/businesses/:id", adminController.getBusinessDetail);
router.get("/users", adminController.listUsers);
router.patch("/users/:id/active", adminController.setUserActive);
router.patch("/businesses/:id/subscription", adminController.extendSubscription);

// Platform inbox — messages sent to the platform's WhatsApp number.
router.get("/inbox/conversations", adminInboxController.listConversations);
router.get("/inbox/conversations/unread-count", adminInboxController.unreadCount);
router.get("/inbox/conversations/:phone", adminInboxController.getThread);
router.post("/inbox/conversations/:phone/reply", adminInboxController.sendReply);

export default router;
