import { z } from "zod";

// A generic "change" shape that works across entity types (Transaction,
// Product, Customer, etc.) so the sync engine doesn't need a bespoke
// endpoint per module. `entity` tells the service which table to write to.
export const syncPushSchema = z.object({
  changes: z.array(
    z.object({
      id: z.string().uuid(), // client-generated UUID \u2013 see schema.prisma notes
      entity: z.enum(["transaction", "product", "customer", "supplier"]),
      action: z.enum(["create", "update", "delete"]),
      data: z.record(z.any()),
      clientUpdatedAt: z.string().datetime(),
    })
  ),
});

export const syncPullSchema = z.object({
  since: z.string().datetime().optional(), // ISO timestamp of last successful sync
});
