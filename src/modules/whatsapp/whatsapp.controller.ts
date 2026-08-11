import { Request, Response } from "express";
import { ok } from "@utils/apiResponse";
import { asyncHandler } from "@utils/asyncHandler";
import { logger } from "@utils/logger";
import { env } from "@config/env";
import { ValidationError } from "@utils/errors";
import {
  sendTextMessage,
  sendTemplateMessage,
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

/** Receives inbound messages/status updates from Meta. */
export const webhookReceive = asyncHandler(async (req: WebhookRequest, res: Response) => {
  if (!isWebhookSignatureValid(req.rawBody, req.headers["x-hub-signature-256"])) {
    throw new ValidationError("Invalid webhook signature");
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
