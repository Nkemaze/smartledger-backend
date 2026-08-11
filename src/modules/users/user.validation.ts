import { z } from "zod";
import { Role } from "@prisma/client";

export const addStaffSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.enum([Role.CASHIER, Role.ACCOUNTANT]), // Owner cannot be assigned this way
  monthlyTarget: z.coerce.number().min(0).optional(),
});

export const updateStaffRoleSchema = z.object({
  role: z.enum([Role.CASHIER, Role.ACCOUNTANT]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional().nullable(),
  isActive: z.boolean().optional(),
  monthlyTarget: z.coerce.number().min(0).optional().nullable(),
});
