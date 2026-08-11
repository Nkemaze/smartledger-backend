import { prisma } from "@config/database";
import { logger } from "@utils/logger";
import { Prisma } from "@prisma/client";

type PushChange = {
  id: string;
  entity: "transaction" | "product" | "customer" | "supplier";
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  clientUpdatedAt: string;
};

// Maps the generic `entity` string to its Prisma delegate.
function getDelegate(entity: PushChange["entity"]) {
  switch (entity) {
    case "product":
      return prisma.product;
    case "transaction":
      return prisma.transaction;
    case "customer":
      return prisma.customer;
    case "supplier":
      return prisma.supplier;
    default:
      throw new Error(`Sync not yet implemented for entity: ${entity}`);
  }
}

/**
 * Applies a batch of offline changes from a client.
 * Conflict rule (per the Technological Realisation doc, Section 4.3):
 * last-write-wins based on `updatedAt`, backed by an AuditLog entry so
 * nothing is silently lost and the Owner can always review history.
 */
export async function pushChanges(businessId: string, userId: string | undefined, changes: PushChange[]) {
  const results = [];

  for (const change of changes) {
    const delegate = getDelegate(change.entity) as any;

    try {
      if (change.action === "delete") {
        await delegate.deleteMany({ where: { id: change.id, businessId } });
      } else {
        const existing = await delegate.findFirst({ where: { id: change.id, businessId } });

        // Last-write-wins: only apply the incoming change if it's newer
        // than what the server already has.
        if (existing && new Date(existing.updatedAt) > new Date(change.clientUpdatedAt)) {
          results.push({ id: change.id, status: "skipped_older_write" });
          continue;
        }

        await delegate.upsert({
          where: { id: change.id },
          create: { id: change.id, businessId, ...change.data },
          update: { ...change.data },
        });
      }

      await prisma.auditLog.create({
        data: {
          businessId,
          userId,
          entityType: change.entity,
          entityId: change.id,
          action: change.action,
          changes: change.data as Prisma.InputJsonValue,
        },
      });

      results.push({ id: change.id, status: "applied" });
    } catch (err) {
      logger.error(`Sync push failed for ${change.entity}:${change.id}`, err);
      results.push({ id: change.id, status: "failed" });
    }
  }

  return results;
}

/**
 * Returns everything that changed since the client's last successful sync,
 * so the client can update its local SQLite/IndexedDB store.
 */
export async function pullChanges(businessId: string, since?: string) {
  const sinceDate = since ? new Date(since) : new Date(0);

  const [products, transactions, customers, suppliers] = await Promise.all([
    prisma.product.findMany({ where: { businessId, updatedAt: { gt: sinceDate } } }),
    prisma.transaction.findMany({ where: { businessId, updatedAt: { gt: sinceDate } } }),
    prisma.customer.findMany({ where: { businessId, updatedAt: { gt: sinceDate } } }),
    prisma.supplier.findMany({ where: { businessId, updatedAt: { gt: sinceDate } } }),
  ]);

  return {
    serverTime: new Date().toISOString(),
    products,
    transactions,
    customers,
    suppliers,
  };
}
