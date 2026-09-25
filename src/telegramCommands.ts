import axios from "axios";
import { config } from "./config";
import { logger } from "./logger";
import { getKv, setKv, getStatsForRange } from "./db";
import { getMskDayRangeUtc } from "./mskTime";

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;
const OFFSET_KEY = "telegram_update_offset";
const LONG_POLL_TIMEOUT_SEC = 30;

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

function getOffset(): number {
  const raw = getKv(OFFSET_KEY);
  return raw ? Number(raw) : 0;
}

function setOffset(offset: number): void {
  setKv(OFFSET_KEY, String(offset));
}

async function sendReply(text: string): Promise<void> {
  await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, {
    chat_id: config.telegramChatId,
    text,
  });
}

function buildTodayStatsMessage(): string {
  const { startIso, endIsoExclusive } = getMskDayRangeUtc();
  const stats = getStatsForRange(startIso, endIsoExclusive);
  return [
    "📊 Статистика за сегодня",
    `Пропущенных звонков: ${stats.missed}`,
    `Перезвонили: ${stats.resolved}`,
    `Просрочено (алерт отправлен): ${stats.overdueNotified}`,
  ].join("\n");
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;
  // Only react inside the configured chat, ignore DMs or other groups the bot might be added to.
  if (String(message.chat.id) !== String(config.telegramChatId)) return;

  const command = message.text.trim().split(/\s+/)[0]?.split("@")[0];
  if (command === "/stats") {
    await sendReply(buildTodayStatsMessage());
  }
}

async function pollOnce(): Promise<void> {
  const offset = getOffset();
  const response = await axios.get<{ ok: boolean; result: TelegramUpdate[] }>(
    `${TELEGRAM_API_BASE}/getUpdates`,
    {
      params: { timeout: LONG_POLL_TIMEOUT_SEC, offset: offset + 1 },
      timeout: (LONG_POLL_TIMEOUT_SEC + 10) * 1000,
    },
  );

  for (const update of response.data.result) {
    try {
      await handleUpdate(update);
    } catch (err) {
      logger.error({ err, updateId: update.update_id }, "Failed to handle Telegram update");
    }
    setOffset(update.update_id);
  }
}

/** Long-polls Telegram for bot commands forever. Never throws; retries on failure. */
export async function runTelegramCommandLoop(): Promise<void> {
  for (;;) {
    try {
      await pollOnce();
    } catch (err) {
      logger.error({ err }, "Telegram getUpdates failed");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export async function registerBotCommands(): Promise<void> {
  try {
    await axios.post(`${TELEGRAM_API_BASE}/setMyCommands`, {
      commands: [{ command: "stats", description: "Статистика за сегодня" }],
    });
  } catch (err) {
    logger.error({ err }, "Failed to register bot commands");
  }
}
