import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@config/database";
import { env } from "@config/env";
import { Role } from "@prisma/client";
import { UnauthorizedError, ValidationError } from "@utils/errors";
import { z } from "zod";
import { signUpSchema, loginSchema } from "./auth.validation";
import { consumeSignupVerification, VerificationMethod } from "./otp.service";
import { buildTrialData } from "@modules/subscriptions/subscriptions.service";

type SignUpInput = z.infer<typeof signUpSchema>;
type LoginInput = z.infer<typeof loginSchema>;

function signToken(payload: { userId: string; businessId: string; role: Role }): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

/**
 * Creates a new Business + its first User after verifying the signup code.
 * Per the SRS flexible role model (Section 2.4): the first user registered
 * for a business is always the OWNER, and by default – with no staff
 * added yet – that single account has full access to everything.
 *
 * Verification: the code is delivered at POST /auth/verification/request
 * over WhatsApp (to the phone) or email. The chosen destination is what
 * gets marked verified on the created account.
 */
export async function signUp(input: SignUpInput) {
  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new ValidationError("An account with this phone number already exists.");
  }

  if (input.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new ValidationError("An account with this email already exists.");
    }
  }

  const destination = input.verificationMethod === "whatsapp" ? input.phone : input.email!;
  consumeSignupVerification(input.verificationMethod as VerificationMethod, destination, input.verificationCode);

  const passwordHash = await bcrypt.hash(input.password, 10);

  const business = await prisma.business.create({
    data: {
      name: input.businessName,
      shopType: input.shopType,
      // Business Plan §2.4: every new business starts on the 1-month free trial.
      subscription: {
        create: buildTrialData(),
      },
      users: {
        create: {
          name: input.ownerName,
          phone: input.phone,
          email: input.email,
          passwordHash,
          role: Role.OWNER,
          phoneVerified: input.verificationMethod === "whatsapp",
          emailVerified: input.verificationMethod === "email",
        },
      },
    },
    include: { users: true },
  });

  const owner = business.users[0];
  const token = signToken({ userId: owner.id, businessId: business.id, role: owner.role });

  return { token, user: owner, business };
}

export async function login(input: LoginInput) {
  const identifier = input.identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: { equals: identifier, mode: "insensitive" } }, { phone: input.identifier.trim() }],
    },
  });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid email/phone or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email/phone or password");
  }

  const token = signToken({ userId: user.id, businessId: user.businessId, role: user.role });
  return { token, user };
}
