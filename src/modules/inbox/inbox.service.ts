import { prisma } from "@config/database";
import { logger } from "@utils/logger";
import { NotFoundError, ValidationError } from "@utils/errors";
import { sendTextMessage } from "@services/whatsapp.service";
import { MessageDirection } from "@prisma/client";

/** Strips a phone to bare digits and drops a leading country code so that
 *  "6512345678", "+237651234567" and "237651234567" all compare equal. */
function normalisePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("237") && d.length > 9) d = d.slice(3);
  return d;
}

/**
 * Maps an inbound WhatsApp number to a business by matching it against
 * existing Customer and staff User phone numbers. Returns null when the
 * number is unknown (message stored unassigned for super-admin triage).
 */
async function resolveContact(phone: string) {
  const norm = normalisePhone(phone);
  if (norm.length < 6) return null;

  const suffixMatches = (stored?: string | null) => {
    if (!stored) return false;
    const s = normalisePhone(stored);
    return s === norm || s.endsWith(norm) || norm.endsWith(s);
  };

  const [customers, users] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true, businessId: true }, take: 5000 }),
    prisma.user.findMany({ select: { id: true, name: true, phone: true, businessId: true }, take: 5000 }),
  ]);

  const customer = customers.find((c) => suffixMatches(c.phone));
  if (customer) {
    return { businessId: customer.businessId, customerId: customer.id, contactName: customer.name };
  }
  const user = users.find((u) => suffixMatches(u.phone));
  if (user) {
    return { businessId: user.businessId, customerId: null, contactName: user.name };
  }
  return null;
}

/** Persists an inbound message from the webhook. Never throws (webhook must 200). */
export async function recordInboundMessage(input: {
  from: string;
  text: string;
  messageType?: string;
  providerMsgId?: string;
}) {
  try {
    const contact = await resolveContact(input.from);
    return await prisma.whatsappMessage.create({
      data: {
        businessId: contact?.businessId ?? null,
        customerId: contact?.customerId ?? null,
        contactPhone: normalisePhone(input.from),
        contactName: contact?.contactName ?? null,
        direction: MessageDirection.INBOUND,
        text: input.text,
        messageType: input.messageType ?? "text",
        status: "received",
        providerMsgId: input.providerMsgId ?? null,
      },
    });
  } catch (err) {
    logger.error("[Inbox] failed to record inbound message", err);
    return null;
  }
}

/** Records a delivery/status update against a previously stored outbound message. */
export async function recordStatusUpdate(providerMsgId: string, status: string) {
  try {
    await prisma.whatsappMessage.updateMany({
      where: { providerMsgId },
      data: { status },
    });
  } catch (err) {
    logger.error("[Inbox] failed to record status update", err);
  }
}

export interface ConversationSummary {
  contactPhone: string;
  contactName: string | null;
  lastMessage: string;
  lastDirection: MessageDirection;
  lastAt: string;
  unreadCount: number;
}

/** One row per contact: last message + unread count, newest conversation first. */
export async function listConversations(businessId: string): Promise<ConversationSummary[]> {
  const messages = await prisma.whatsappMessage.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const byContact = new Map<string, ConversationSummary>();
  for (const m of messages) {
    const existing = byContact.get(m.contactPhone);
    if (!existing) {
      byContact.set(m.contactPhone, {
        contactPhone: m.contactPhone,
        contactName: m.contactName,
        lastMessage: m.text,
        lastDirection: m.direction,
        lastAt: m.createdAt.toISOString(),
        unreadCount: 0,
      });
    }
    if (m.direction === MessageDirection.INBOUND && m.status !== "read") {
      const conv = byContact.get(m.contactPhone)!;
      conv.unreadCount += 1;
    }
  }
  return Array.from(byContact.values());
}

/** Full thread with one contact, oldest first. Marks inbound as read. */
export async function listThread(businessId: string, contactPhone: string) {
  const norm = normalisePhone(contactPhone);

  await prisma.whatsappMessage.updateMany({
    where: { businessId, contactPhone: norm, direction: MessageDirection.INBOUND, status: { not: "read" } },
    data: { status: "read" },
  });

  return prisma.whatsappMessage.findMany({
    where: { businessId, contactPhone: norm },
    orderBy: { createdAt: "asc" },
  });
}

export async function unreadCount(businessId: string) {
  return prisma.whatsappMessage.count({
    where: { businessId, direction: MessageDirection.INBOUND, status: { not: "read" } },
  });
}

/** Sends a reply through the active WhatsApp provider and stores it as OUTBOUND. */
export async function sendReply(businessId: string, contactPhone: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Message text is required.");

  try {
    await sendTextMessage(contactPhone, trimmed);
  } catch (err) {
    // Surface provider/connectivity problems clearly instead of a generic 500.
    const detail = err instanceof Error ? err.message : "Unknown WhatsApp error";
    throw new ValidationError(`Could not send via WhatsApp: ${detail}`);
  }

  return prisma.whatsappMessage.create({
    data: {
      businessId,
      contactPhone: normalisePhone(contactPhone),
      direction: MessageDirection.OUTBOUND,
      text: trimmed,
      status: "sent",
    },
  });
}
