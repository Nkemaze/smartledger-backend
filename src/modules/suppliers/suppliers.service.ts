import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";
import { z } from "zod";
import { createSupplierSchema, updateSupplierSchema } from "./suppliers.validation";

type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export async function listSuppliers(businessId: string, search?: string) {
  return prisma.supplier.findMany({
    where: {
      businessId,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getSupplier(businessId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
  if (!supplier) throw new NotFoundError("Supplier");
  return supplier;
}

export async function createSupplier(businessId: string, input: CreateSupplierInput) {
  return prisma.supplier.create({ data: { businessId, ...input } });
}

export async function updateSupplier(businessId: string, supplierId: string, input: UpdateSupplierInput) {
  await getSupplier(businessId, supplierId);
  return prisma.supplier.update({ where: { id: supplierId }, data: input });
}

export async function deleteSupplier(businessId: string, supplierId: string) {
  await getSupplier(businessId, supplierId);
  await prisma.supplier.delete({ where: { id: supplierId } });
}
