import { prisma } from "@config/database";
import { NotFoundError } from "@utils/errors";

export async function listNotifications(businessId: string, unreadOnly?: boolean) {
  return prisma.notification.findMany({
    where: { businessId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function unreadCount(businessId: string) {
  return prisma.notification.count({ where: { businessId, isRead: false } });
}

export async function markAsRead(businessId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, businessId } });
  if (!notification) throw new NotFoundError("Notification");
  return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
}

export async function markAllAsRead(businessId: string) {
  return prisma.notification.updateMany({ where: { businessId, isRead: false }, data: { isRead: true } });
}
