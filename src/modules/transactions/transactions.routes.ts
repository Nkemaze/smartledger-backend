import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireActiveSubscription } from "@middleware/subscription.middleware";
import { validate } from "@middleware/validate.middleware";
import { createTransactionSchema, updateTransactionSchema } from "./transactions.validation";
import * as transactionController from "./transactions.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get("/", transactionController.listTransactions);
router.post("/", validate(createTransactionSchema), transactionController.createTransaction);
router.get("/:id", transactionController.getTransaction);
router.patch("/:id", validate(updateTransactionSchema), transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

export default router;
