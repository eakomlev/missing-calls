import axios from "axios";
import { config } from "./config";
import { logger } from "./logger";
import type { MissedCallRow } from "./db";

const TELEGRAM_API_URL = `${config.telegramApiBaseUrl}/bot${config.telegramBotToken}/sendMessage`;

function minutesSince(startTs: string): number {
  return Math.round((Date.now() - new Date(startTs).getTime()) / 60000);
}

export async function sendOverdueCallbackAlert(call: MissedCallRow): Promise<void> {
  const minutesAgo = minutesSince(call.start_ts);
  const mskStart = new Date(call.start_ts).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
  });
  const text = [
    "🔴 Пропущенный звонок без перезвона",
    `Номер: ${call.phone}`,
    call.account ? `Сотрудник/отдел: ${call.account}` : undefined,
    `Время звонка: ${mskStart} МСК`,
    `Прошло без перезвона: ${minutesAgo} мин`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await axios.post(TELEGRAM_API_URL, {
      chat_id: config.telegramChatId,
      text,
    });
  } catch (err) {
    logger.error({ err, uid: call.uid }, "Failed to send Telegram alert");
    throw err;
  }
}
