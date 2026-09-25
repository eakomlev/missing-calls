import cron from "node-cron";
import { config } from "./config";
import { logger } from "./logger";
import { pollMissedCalls } from "./pollers/missedPoller";
import { pollOutgoingCalls } from "./pollers/outgoingPoller";
import { checkOverdueCallbacks } from "./watchdog";
import { db } from "./db";

function everyNMinutes(n: number): string {
  return `*/${n} * * * *`;
}

async function runSafely(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error({ err }, `${name} failed`);
  }
}

async function main(): Promise<void> {
  logger.info(
    {
      pollMissedIntervalMin: config.pollMissedIntervalMin,
      pollOutgoingIntervalMin: config.pollOutgoingIntervalMin,
      watchdogIntervalMin: config.watchdogIntervalMin,
      callbackTimeoutMin: config.callbackTimeoutMin,
    },
    "Starting missing-calls service",
  );

  // Run once on startup so we don't wait a full interval before the first check.
  await runSafely("pollMissedCalls", pollMissedCalls);
  await runSafely("pollOutgoingCalls", pollOutgoingCalls);
  await runSafely("checkOverdueCallbacks", checkOverdueCallbacks);

  cron.schedule(everyNMinutes(config.pollMissedIntervalMin), () =>
    runSafely("pollMissedCalls", pollMissedCalls),
  );
  cron.schedule(everyNMinutes(config.pollOutgoingIntervalMin), () =>
    runSafely("pollOutgoingCalls", pollOutgoingCalls),
  );
  cron.schedule(everyNMinutes(config.watchdogIntervalMin), () =>
    runSafely("checkOverdueCallbacks", checkOverdueCallbacks),
  );
}

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  db.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Any error that reaches here means something escaped runSafely's try/catch
// (e.g. a bug in a cron callback itself). Log it and exit so the process
// manager (Docker restart policy, systemd, etc.) restarts us into a clean
// state, instead of continuing to run with unknown/corrupted state.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception, exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection, exiting");
  process.exit(1);
});

main().catch((err) => {
  logger.error({ err }, "Fatal error on startup");
  process.exit(1);
});
