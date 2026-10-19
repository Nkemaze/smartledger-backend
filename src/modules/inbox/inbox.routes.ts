import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import * as inboxController from "./inbox.controller";

const router = Router();

router.use(authMiddleware);

router.get("/conversations", inboxController.listConversations);
router.get("/conversations/unread-count", inboxController.unreadCount); // before :phone
router.get("/conversations/:phone", inboxController.getThread);
router.post("/conversations/:phone/reply", inboxController.sendReply);

export default router;
