import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireActiveSubscription } from "@middleware/subscription.middleware";
import { validate } from "@middleware/validate.middleware";
import { createSupplierSchema, updateSupplierSchema } from "./suppliers.validation";
import * as supplierController from "./suppliers.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get("/", supplierController.listSuppliers);
router.post("/", validate(createSupplierSchema), supplierController.createSupplier);
router.get("/:id", supplierController.getSupplier);
router.patch("/:id", validate(updateSupplierSchema), supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);

export default router;
