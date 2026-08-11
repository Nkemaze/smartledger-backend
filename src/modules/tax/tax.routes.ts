import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { validate } from "@middleware/validate.middleware";
import { createFilingSchema, updateFilingSchema } from "./tax.validation";
import * as taxController from "./tax.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", taxController.getTaxSummary);
router.get("/vat-ledger", taxController.getVatLedger);
router.get("/filings", taxController.listFilings);
router.post("/filings", validate(createFilingSchema), taxController.createFiling);
router.patch("/filings/:id", validate(updateFilingSchema), taxController.updateFiling);

export default router;
