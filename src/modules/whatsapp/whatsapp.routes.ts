import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import * as whatsappController from "./whatsapp.controller";
import { sendMessageSchema } from "./whatsapp.validation";

const router = Router();

// Public — Meta calls these webhook endpoints directly (no JWT).
router.get("/webhook", whatsappController.webhookVerify);
router.post("/webhook", whatsappController.webhookReceive);

// Authenticated
router.use(authMiddleware);

router.get("/status", whatsappController.getStatus);
router.post("/send", validate(sendMessageSchema), whatsappController.sendMessage);

export default router;
