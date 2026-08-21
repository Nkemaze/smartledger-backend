import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireActiveSubscription } from "@middleware/subscription.middleware";
import { validate } from "@middleware/validate.middleware";
import * as advisorController from "./advisor.controller";
import { chatSchema } from "./advisor.validation";

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get("/insights", advisorController.getInsights);
router.post("/chat", validate(chatSchema), advisorController.chat);

export default router;
