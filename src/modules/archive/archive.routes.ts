import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireActiveSubscription } from "@middleware/subscription.middleware";
import { requireRole } from "@middleware/role.middleware";
import { validate } from "@middleware/validate.middleware";
import { Role } from "@prisma/client";
import { createDocumentSchema } from "./archive.validation";
import { upload } from "./archive.service";
import * as archiveController from "./archive.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get("/", archiveController.listDocuments);
router.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  upload.single("file"),
  (req, _res, next) => {
    if (req.file) {
      try {
        createDocumentSchema.parse({ type: req.body.type, transactionId: req.body.transactionId });
      } catch (err) {
        return next(err);
      }
    }
    next();
  },
  archiveController.uploadDocument
);
router.delete("/:id", requireRole(Role.OWNER, Role.ACCOUNTANT), archiveController.deleteDocument);

export default router;
