import bcrypt from "bcryptjs";
import { prisma } from "@config/database";
import { NotFoundError, ValidationError } from "@utils/errors";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { addStaffSchema, updateStaffRoleSchema, updateStaffSchema } from "./user.validation";

type AddStaffInput = z.infer<typeof addStaffSchema>;
type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

// Per SRS USR-REQ-002: with no staff added, the Owner already has full
// access. This list is what actually changes when the Owner explicitly
// adds someone \u2013 see requireRole() in role.middleware.ts for enforcement.
export async function listStaff(businessId: string) {
  return prisma.user.findMany({
    where: { businessId },
    select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function addStaff(businessId: string, input: AddStaffInput) {
  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new ValidationError("A user with this phone number already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.create({
    data: {
      businessId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      passwordHash,
      role: input.role, // CASHIER or ACCOUNTANT only, per validation schema
      monthlyTarget: input.monthlyTarget,
    },
    select: { id: true, name: true, phone: true, role: true, monthlyTarget: true, createdAt: true },
  });
}

export async function updateStaffRole(businessId: string, staffId: string, input: UpdateStaffRoleInput) {
  const staff = await prisma.user.findFirst({ where: { id: staffId, businessId } });
  if (!staff) throw new NotFoundError("Staff member");

  return prisma.user.update({
    where: { id: staffId },
    data: { role: input.role },
    select: { id: true, name: true, role: true },
  });
}

export async function updateStaff(businessId: string, staffId: string, input: UpdateStaffInput) {
  const staff = await prisma.user.findFirst({ where: { id: staffId, businessId } });
  if (!staff) throw new NotFoundError("Staff member");

  if (input.phone) {
    const conflict = await prisma.user.findFirst({ where: { phone: input.phone, id: { not: staffId } } });
    if (conflict) throw new ValidationError("Another user already has this phone number.");
  }

  return prisma.user.update({
    where: { id: staffId },
    data: input,
    select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, monthlyTarget: true },
  });
}

/** Per-staff performance: sales made, average sale, progress vs monthly target. */
export async function getStaffPerformance(businessId: string, staffId: string) {
  const staff = await prisma.user.findFirst({ where: { id: staffId, businessId } });
  if (!staff) throw new NotFoundError("Staff member");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allSales, monthSales] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, userId: staffId, type: TransactionType.INCOME },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { businessId, userId: staffId, type: TransactionType.INCOME, occurredAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalSales = Number(allSales._sum.amount ?? 0);
  const monthRevenue = Number(monthSales._sum.amount ?? 0);
  const target = Number(staff.monthlyTarget ?? 0);

  return {
    ...staff,
    stats: {
      totalSales,
      totalTransactions: allSales._count,
      monthRevenue,
      monthTransactions: monthSales._count,
      averageSale: allSales._count > 0 ? totalSales / allSales._count : 0,
      monthlyTarget: target,
      targetProgress: target > 0 ? Math.round((monthRevenue / target) * 1000) / 10 : null,
    },
  };
}

export async function removeStaff(businessId: string, staffId: string) {
  const staff = await prisma.user.findFirst({ where: { id: staffId, businessId } });
  if (!staff) throw new NotFoundError("Staff member");

  // Soft-delete: keeps the audit trail intact rather than losing history.
  await prisma.user.update({ where: { id: staffId }, data: { isActive: false } });
}
