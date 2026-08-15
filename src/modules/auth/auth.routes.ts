import { Router } from "express";
import { validate } from "@middleware/validate.middleware";
import { signUpSchema, loginSchema, verifyOtpSchema, requestVerificationSchema } from "./auth.validation";
import * as authController from "./auth.controller";

const router = Router();

router.post("/signup", validate(signUpSchema), authController.signUp);
router.post("/login", validate(loginSchema), authController.login);
router.post("/otp/request", authController.requestOtp);
router.post("/otp/verify", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/verification/request", validate(requestVerificationSchema), authController.requestSignupVerification);
router.get("/verification/channels", authController.getVerificationChannels);

export default router;
