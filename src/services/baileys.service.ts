import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode-terminal";
import { env } from "@config/env";
import { logger } from "@utils/logger";

/**
 * Baileys WhatsApp Web provider. Runs in-process: no third-party service.
 * Auth session is persisted under BAILEYS_AUTH_DIR, so the QR/pairing code
 * is only needed once. Unofficial — use a disposable number and expect that
 * WhatsApp may restrict it (same risk class as the Unipile route).
 */

let sock: WASocket | null = null;
let connected = false;
let starting = false;
let pairingRequested = false;

const silentLogger = {
  level: "silent",
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child() {
    return this;
  },
} as unknown as Parameters<typeof makeWASocket>[0]["logger"];

export function isBaileysConnected(): boolean {
  return connected;
}

export interface BaileysReceipt {
  to: string;
  status: number;
  at: string;
}

const recentReceipts: BaileysReceipt[] = [];

export function getBaileysStatus(): { connected: boolean; starting: boolean; recentReceipts: BaileysReceipt[] } {
  return { connected, starting, recentReceipts: [...recentReceipts] };
}

async function startSocket(): Promise<void> {
  if (starting || sock) return;
  starting = true;

  const { state, saveCreds } = await useMultiFileAuthState(env.whatsapp.baileysAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    markOnlineOnConnect: false,
    logger: silentLogger,
  });

  sock.ev.on("creds.update", saveCreds);

  // Delivery-receipt telemetry: 1 = reached WhatsApp server (one tick),
  // 2 = delivered to the recipient's phone (two ticks), 3 = read (blue).
  sock.ev.on("messages.update", (updates) => {
    for (const u of updates) {
      const status = (u.update as { status?: number } | undefined)?.status;
      if (status !== undefined && u.key.id) {
        const dest = u.key.remoteJid?.split("@")[0] ?? "unknown";
        logger.info(`[Baileys] receipt: msg ${u.key.id.slice(0, 8)}… -> ${dest} status ${status}`);
        recentReceipts.push({ to: dest, status, at: new Date().toISOString() });
        if (recentReceipts.length > 50) recentReceipts.shift();
      }
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("[Baileys] Scan this QR with WhatsApp -> Linked devices:");
      QRCode.generate(qr, { small: true });
      logger.info("[Baileys] ...or use the pairing code if one appears below.");

      const phone = env.whatsapp.baileysPairingPhone;
      if (phone && !pairingRequested && !state.creds.registered && sock) {
        pairingRequested = true;
        try {
          const digits = phone.replace(/\D/g, "");
          const code = await sock.requestPairingCode(digits);
          logger.info(`[Baileys] PAIRING CODE: ${code ?? "unavailable"} — enter it on the phone in WhatsApp -> Linked devices -> Link with phone number.`);
        } catch (err) {
          logger.error("[Baileys] Could not request pairing code", err);
        }
      }
    }

    if (connection === "open") {
      connected = true;
      starting = false;
      logger.info("[Baileys] WhatsApp connected.");
    }

    if (connection === "close") {
      connected = false;
      sock = null;
      starting = false;
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        logger.error(
          "[Baileys] Session logged out. Delete the auth folder and restart to pair a new number."
        );
        return;
      }
      logger.warn(`[Baileys] Connection closed (code ${code}); reconnecting in 3s...`);
      setTimeout(() => void startSocket(), 3000);
    }
  });
}

/** Boots the socket when the provider is baileys. Safe to call at server start. */
export function startBaileys(): void {
  if (env.whatsapp.provider !== "baileys" || !env.whatsapp.enabled) return;
  startSocket().catch((err) => {
    starting = false;
    logger.error("[Baileys] Failed to start socket", err);
  });
}

/** Sends a text message to a +237... phone number. */
export async function sendBaileysText(to: string, text: string): Promise<unknown> {
  if (!connected || !sock) {
    throw new Error(
      "WhatsApp (Baileys) is not connected yet — pair the number first (see server console for the QR/pairing code)."
    );
  }
  const jid = `${to.replace("+", "")}@s.whatsapp.net`;

  // Verify the number actually exists on WhatsApp before sending —
  // otherwise sends to dead numbers "succeed" but never deliver.
  const results = await sock.onWhatsApp(jid);
  const result = results?.[0];
  if (!result || !result.exists) {
    throw new Error(
      `This number (${to}) is not registered on WhatsApp. Ask the user to install WhatsApp and register this number first.`
    );
  }

  return sock.sendMessage(result.jid, { text });
}
