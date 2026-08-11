import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";
import { z } from "zod";
import { createCustomerSchema, updateCustomerSchema } from "./customers.validation";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export async function listCustomers(businessId: string, search?: string) {
  return prisma.customer.findMany({
    where: {
      businessId,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getCustomer(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) throw new NotFoundError("Customer");
  return customer;
}

export async function createCustomer(businessId: string, input: CreateCustomerInput) {
  return prisma.customer.create({ data: { businessId, ...input } });
}

export async function updateCustomer(businessId: string, customerId: string, input: UpdateCustomerInput) {
  await getCustomer(businessId, customerId);
  return prisma.customer.update({ where: { id: customerId }, data: input });
}

export async function deleteCustomer(businessId: string, customerId: string) {
  await getCustomer(businessId, customerId);
  await prisma.customer.delete({ where: { id: customerId } });
}
