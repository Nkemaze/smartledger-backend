import { Request, Response } from "express";
import { ok } from "@utils/apiResponse";
import { asyncHandler } from "@utils/asyncHandler";
import { logger } from "@utils/logger";
import { env } from "@config/env";
import { prisma } from "@config/database";
import { ValidationError, NotFoundError } from "@utils/errors";
import { computeDailySummary } from "@jobs/dailySalesSummary.job";
import { getBaileysStatus } from "@services/baileys.service";
import {
  sendTextMessage,
  sendTemplateMessage,
  sendDailySalesSummary,
  verifyWebhookHandshake,
  isWebhookSignatureValid,
  isWhatsAppConfigured,
} from "@services/whatsapp.service";

type WebhookRequest = Request & { rawBody?: Buffer };

/**
 * Meta's GET verification handshake. Meta calls this URL with
 * hub.mode / hub.verify_token / hub.challenge when you set up the webhook.
 */
export const webhookVerify = (req: Request, res: Response) => {
  const challenge = verifyWebhookHandshake(
    req.query["hub.mode"],
    req.query["hub.verify_token"],
    req.query["hub.challenge"]
  );
  if (!challenge) {
    throw new ValidationError("Webhook verification failed");
  }
  res.status(200).send(challenge);
};

/** Receives inbound messages/status updates from the active provider. */
export const webhookReceive = asyncHandler(async (req: WebhookRequest, res: Response) => {
  if (!isWebhookSignatureValid(req.rawBody, req.headers["x-hub-signature-256"])) {
    throw new ValidationError("Invalid webhook signature");
  }

  if (env.whatsapp.provider === "unipile") {
    const eventName = req.body?.event ?? req.body?.name ?? req.body?.type;
    const message = req.body?.data?.message ?? (eventName === "new_message" ? req.body?.data : undefined);
    if (message) {
      const sender = message.sender_id ?? message.from ?? "unknown";
      logger.info(`[WhatsApp] inbound message from ${sender}: ${JSON.stringify(message.text ?? "")}`);
      // TODO: route inbound messages to the AI advisor / human inbox (SRS: WA-REQ-004).
    }
    res.sendStatus(200);
    return;
  }

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const status = value?.statuses?.[0];

  if (message) {
    logger.info(`[WhatsApp] inbound message from ${message.from}: ${JSON.stringify(message.text ?? message.type)}`);
    // TODO: route inbound messages to the AI advisor / human inbox (SRS: WA-REQ-004).
  }
  if (status) {
    logger.info(`[WhatsApp] delivery status ${status.status} for ${status.id}`);
  }

  // Meta expects a 200 within 20s; empty entries are normal heartbeats.
  res.sendStatus(200);
});

/** Reports the WhatsApp channel configuration/link state (for the mobile app). */
export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, {
    provider: env.whatsapp.provider,
    configured: isWhatsAppConfigured(),
    hasPhoneNumberId: Boolean(env.whatsapp.phoneNumberId),
    otpChannel: env.otpChannel,
    ...(env.whatsapp.provider === "baileys" ? { baileys: getBaileysStatus() } : {}),
  });
});

/** Sends a template or free-form text message (authenticated, e.g. from the app UI). */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { to, templateName, text, parameters } = req.body;

  if (!to) throw new ValidationError("`to` is required");

  if (text) {
    await sendTextMessage(to, text);
  } else if (templateName) {
    await sendTemplateMessage({ to, templateName, parameters });
  } else {
    throw new ValidationError("Provide `text` or `templateName`");
  }

  ok(res, { message: "Message sent" });
});

/** GET /whatsapp/daily-summary — the caller's end-of-day summary preferences. */
export const getDailySummarySettings = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) throw new NotFoundError("User");

  ok(res, {
    enabled: user.dailySummaryEnabled,
    phone: user.phone,
    schedule: env.whatsapp.dailySummaryCron,
    timezone: env.whatsapp.dailySummaryTimezone,
    whatsappConfigured: isWhatsAppConfigured(),
  });
});

/** PATCH /whatsapp/daily-summary — opt in/out of the end-of-day WhatsApp summary. */
export const updateDailySummarySettings = asyncHandler(async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { dailySummaryEnabled: enabled },
  });

  ok(res, {
    enabled: user.dailySummaryEnabled,
    phone: user.phone,
    schedule: env.whatsapp.dailySummaryCron,
    timezone: env.whatsapp.dailySummaryTimezone,
    whatsappConfigured: isWhatsAppConfigured(),
  });
});

/** POST /whatsapp/daily-summary/test — sends today's summary to the caller right now. */
export const testDailySummary = asyncHandler(async (req: Request, res: Response) => {
  if (!isWhatsAppConfigured()) {
    throw new ValidationError("WhatsApp is not configured on the server");
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.phone) throw new ValidationError("Your account has no phone number");

  const business = await prisma.business.findUnique({ where: { id: req.user!.businessId } });
  if (!business) throw new NotFoundError("Business");

  const summary = await computeDailySummary(business.id, new Date());

  await sendDailySalesSummary(user.phone, {
    businessName: business.name,
    currency: business.currency ?? "XAF",
    ...summary,
  });

  ok(res, {
    message: "Summary sent to your WhatsApp",
    phone: user.phone,
    data: summary,
  });
});
