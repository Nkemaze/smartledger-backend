import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";
import { z } from "zod";
import { updateBusinessSchema } from "./business.validation";

type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new NotFoundError("Business");
  return business;
}

export async function updateBusiness(businessId: string, input: UpdateBusinessInput) {
  await getBusiness(businessId);
  return prisma.business.update({ where: { id: businessId }, data: input });
}
