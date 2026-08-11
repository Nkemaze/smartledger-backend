import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireRole } from "@middleware/role.middleware";
import { Role } from "@prisma/client";
import * as reportController from "./reports.controller";

const router = Router();

router.use(authMiddleware);

// ACCOUNTANT + OWNER can view financial reports; CASHIER gets dashboard basics.
router.get("/dashboard", reportController.getDashboard);
router.get("/pnl", requireRole(Role.OWNER, Role.ACCOUNTANT), reportController.getPnl);
router.get("/balance-sheet", requireRole(Role.OWNER, Role.ACCOUNTANT), reportController.getBalanceSheet);
router.get("/export", requireRole(Role.OWNER, Role.ACCOUNTANT), reportController.exportTransactions);

export default router;
