import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import * as advisorController from "./advisor.controller";

const router = Router();

router.use(authMiddleware);

router.get("/insights", advisorController.getInsights);

export default router;
