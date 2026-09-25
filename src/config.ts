import "dotenv/config";
import path from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Env var ${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export const config = {
  atsApiUrl: requireEnv("ATS_API_URL"),
  atsToken: requireEnv("ATS_TOKEN"),
  pollMissedIntervalMin: intEnv("POLL_MISSED_INTERVAL_MIN", 5),
  pollOutgoingIntervalMin: intEnv("POLL_OUTGOING_INTERVAL_MIN", 5),
  watchdogIntervalMin: intEnv("WATCHDOG_INTERVAL_MIN", 1),
  callbackTimeoutMin: intEnv("CALLBACK_TIMEOUT_MIN", 15),
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  telegramChatId: requireEnv("TELEGRAM_CHAT_ID"),
  dbPath: path.resolve(process.env.DB_PATH ?? "./data/state.db"),
};
