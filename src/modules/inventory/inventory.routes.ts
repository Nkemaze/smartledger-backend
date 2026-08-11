import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireRole } from "@middleware/role.middleware";
import { validate } from "@middleware/validate.middleware";
import { createProductSchema, updateProductSchema, adjustStockSchema } from "./inventory.validation";
import * as inventoryController from "./inventory.controller";
import { Role } from "@prisma/client";

const router = Router();

router.use(authMiddleware);

router.get("/", inventoryController.listProducts);
router.post("/", validate(createProductSchema), inventoryController.createProduct);
router.get("/:id", inventoryController.getProduct);
router.patch("/:id", validate(updateProductSchema), inventoryController.updateProduct);
router.patch("/:id/stock", validate(adjustStockSchema), inventoryController.adjustStock);
router.delete("/:id", requireRole(Role.OWNER, Role.ACCOUNTANT), inventoryController.deleteProduct);

export default router;
