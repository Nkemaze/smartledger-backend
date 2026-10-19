import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";

/** Platform-wide metrics for the admin dashboard. */
export async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalBusinesses, newBusinesses30d, totalUsers, activeSubs, expiringSubs, trialBusinesses] =
    await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count(),
      prisma.subscription.count({
        where: { plan: { in: ["BASIC", "STANDARD", "PREMIUM"] }, periodEndsAt: { gt: now } },
      }),
      prisma.subscription.count({
        where: {
          periodEndsAt: {
            gt: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.subscription.count({ where: { plan: "FREE_TRIAL", trialEndsAt: { gt: now } } }),
    ]);

  return {
    totalBusinesses,
    newBusinesses30d,
    totalUsers,
    activeSubscriptions: activeSubs,
    subscriptionsExpiringSoon: expiringSubs,
    trialingBusinesses: trialBusinesses,
  };
}

/** Paginated list of all businesses with owner info and subscription state. */
export async function listBusinesses(filters: { page?: number; pageSize?: number; search?: string } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = filters.search
    ? {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" as const } },
          { shopType: { contains: filters.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      include: {
        users: { select: { id: true, name: true, phone: true, email: true, role: true } },
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data: businesses,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** Paginated list of every user across all businesses. */
export async function listUsers(filters: { page?: number; pageSize?: number; search?: string } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = filters.search
    ? {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" as const } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        platformAdmin: true,
        business: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data: users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** Toggle a user's active flag (suspend/unsuspend a business account). */
export async function setUserActive(userId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User");
  return prisma.user.update({ where: { id: userId }, data: { isActive } });
}

/** Extend a business's paid subscription by N days (admin override, e.g. goodwill). */
export async function extendSubscription(businessId: string, days: number) {
  const sub = await prisma.subscription.findUnique({ where: { businessId } });
  if (!sub) throw new NotFoundError("Subscription");

  const now = new Date();

  // Extending a free trial: push trialEndsAt forward.
  if (sub.plan === "FREE_TRIAL") {
    const currentEnd = sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime() ? sub.trialEndsAt : now;
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { trialEndsAt: newEnd },
    });
  }

  const currentEnd = sub.periodEndsAt && sub.periodEndsAt.getTime() > now.getTime() ? sub.periodEndsAt : now;
  const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.subscription.update({
    where: { id: sub.id },
    data: { periodEndsAt: newEnd },
  });
}

/** Full details for one business, for the admin drill-down view. */
export async function getBusinessDetail(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      users: { select: { id: true, name: true, phone: true, email: true, role: true, isActive: true } },
      subscription: true,
      _count: { select: { products: true, customers: true, suppliers: true, transactions: true } },
    },
  });
  if (!business) throw new NotFoundError("Business");
  return business;
}
