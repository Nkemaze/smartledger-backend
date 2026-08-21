import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import { selectPlanSchema } from "./subscriptions.validation";
import * as subscriptionsController from "./subscriptions.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", subscriptionsController.getSubscription);
router.get("/plans", subscriptionsController.getPlans);
router.post("/select-plan", validate(selectPlanSchema), subscriptionsController.selectPlan);
router.post("/start-trial", subscriptionsController.startTrial);

export default router;
