import { z } from "zod";
import { prisma } from "@config/database";
import { NotFoundError, ValidationError } from "@utils/errors";
import { logger } from "@utils/logger";
import { Role } from "@prisma/client";
import { sendLowStockAlert, isWhatsAppConfigured } from "@services/whatsapp.service";
import { createProductSchema, updateProductSchema, adjustStockSchema } from "./inventory.validation";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export type ListProductFilters = {
  search?: string;
  category?: string;
  lowStock?: boolean;
};

export async function listProducts(businessId: string, filters: ListProductFilters) {
  return prisma.product.findMany({
    where: {
      businessId,
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { sku: { contains: filters.search, mode: "insensitive" } }] }
        : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.lowStock ? { stockQuantity: { lte: prisma.product.fields.reorderThreshold } } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, businessId } });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function createProduct(businessId: string, input: CreateProductInput) {
  return prisma.product.create({ data: { businessId, ...input } });
}

export async function updateProduct(businessId: string, productId: string, input: UpdateProductInput) {
  await getProduct(businessId, productId);
  return prisma.product.update({ where: { id: productId }, data: input });
}

export async function adjustStock(businessId: string, productId: string, input: AdjustStockInput) {
  const product = await getProduct(businessId, productId);
  const newQuantity = product.stockQuantity + input.quantity;
  if (newQuantity < 0) {
    throw new ValidationError(`Insufficient stock. Current quantity is ${product.stockQuantity}.`);
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { stockQuantity: newQuantity },
  });

  await maybeAlertLowStock(businessId, updated);
  return updated;
}

/**
 * Sends the owner a WhatsApp low-stock alert (and creates an in-app
 * notification) when a product's stock drops at or below its reorder
 * threshold. Requires the "low_stock_alert" template in the WhatsApp portal.
 */
async function maybeAlertLowStock(businessId: string, product: { id: string; name: string; stockQuantity: number; reorderThreshold: number }) {
  if (product.stockQuantity > product.reorderThreshold) return;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      users: { select: { phone: true, role: true }, where: { isActive: true } },
    },
  });

  const owner = business?.users.find((u) => u.role === Role.OWNER);
  const message = `Low stock alert: ${product.name} has ${product.stockQuantity} left (threshold ${product.reorderThreshold}).`;

  if (isWhatsAppConfigured() && owner?.phone) {
    try {
      await sendLowStockAlert(owner.phone, {
        businessName: business?.name ?? "SmartLedger",
        productName: product.name,
        remaining: String(product.stockQuantity),
      });
    } catch (err) {
      logger.error(`Low-stock WhatsApp alert failed for ${product.name}`, err);
    }
  }

  await prisma.notification.create({
    data: { businessId, type: "low_stock", message, channel: "whatsapp" },
  });
}

export async function deleteProduct(businessId: string, productId: string) {
  await getProduct(businessId, productId);
  await prisma.product.delete({ where: { id: productId } });
}
