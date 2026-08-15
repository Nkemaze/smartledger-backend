import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import * as whatsappController from "./whatsapp.controller";
import { sendMessageSchema, dailySummarySettingsSchema } from "./whatsapp.validation";

const router = Router();

// Public — providers call these webhook endpoints directly (no JWT).
router.get("/webhook", whatsappController.webhookVerify);
router.post("/webhook", whatsappController.webhookReceive);

// Authenticated
router.use(authMiddleware);

router.get("/status", whatsappController.getStatus);
router.post("/send", validate(sendMessageSchema), whatsappController.sendMessage);

// End-of-day transaction summary preferences
router.get("/daily-summary", whatsappController.getDailySummarySettings);
router.patch("/daily-summary", validate(dailySummarySettingsSchema), whatsappController.updateDailySummarySettings);
router.post("/daily-summary/test", whatsappController.testDailySummary);

export default router;
