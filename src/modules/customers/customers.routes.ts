import { Router } from "express";
import { authMiddleware } from "@middleware/auth.middleware";
import { requireActiveSubscription } from "@middleware/subscription.middleware";
import { validate } from "@middleware/validate.middleware";
import { createCustomerSchema, updateCustomerSchema } from "./customers.validation";
import * as customerController from "./customers.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get("/", customerController.listCustomers);
router.post("/", validate(createCustomerSchema), customerController.createCustomer);
router.get("/:id", customerController.getCustomer);
router.patch("/:id", validate(updateCustomerSchema), customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

export default router;
