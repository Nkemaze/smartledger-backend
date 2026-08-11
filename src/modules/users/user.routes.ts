import { Router } from "express";
import { Role } from "@prisma/client";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireRole } from "@middleware/role.middleware";
import { validate } from "@middleware/validate.middleware";
import { addStaffSchema, updateStaffRoleSchema, updateStaffSchema } from "./user.validation";
import * as userController from "./user.controller";

const router = Router();

// Every route here is Owner-only: managing staff and roles is not
// delegated to CASHIER or ACCOUNTANT accounts (see SRS Section 2.4 / 3.1).
router.use(authMiddleware, requireRole(Role.OWNER));

router.get("/", userController.listStaff);
router.post("/", validate(addStaffSchema), userController.addStaff);
router.get("/:id/performance", userController.getStaffPerformance);
router.patch("/:id/role", validate(updateStaffRoleSchema), userController.updateStaffRole);
router.patch("/:id", validate(updateStaffSchema), userController.updateStaff);
router.delete("/:id", userController.removeStaff);

export default router;
