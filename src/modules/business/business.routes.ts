import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import { updateBusinessSchema } from "./business.validation";
import * as businessController from "./business.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", businessController.getBusiness);
router.patch("/", validate(updateBusinessSchema), businessController.updateBusiness);

export default router;
