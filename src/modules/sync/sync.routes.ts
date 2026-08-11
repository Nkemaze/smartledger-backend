import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import { syncPushSchema } from "./sync.validation";
import * as syncController from "./sync.controller";

const router = Router();

router.use(authMiddleware);

// Client -> Server: push queued offline changes
router.post("/push", validate(syncPushSchema), syncController.push);

// Server -> Client: pull anything new since the client's last sync
router.get("/pull", syncController.pull);

export default router;
