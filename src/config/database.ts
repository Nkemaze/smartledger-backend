import { PrismaClient } from "@prisma/client";

// A single shared Prisma instance across the whole app.
// In dev mode with tsx watch, this prevents creating a new client
// (and a new connection pool) on every file change / hot reload.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
