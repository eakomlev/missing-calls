import { getOverdueUnnotified, markNotified } from "./db";
import { sendOverdueCallbackAlert } from "./telegram";
import { config } from "./config";
import { logger } from "./logger";

export async function checkOverdueCallbacks(): Promise<void> {
  const cutoff = new Date(Date.now() - config.callbackTimeoutMin * 60 * 1000).toISOString();
  const overdue = getOverdueUnnotified(cutoff);

  if (overdue.length === 0) return;

  logger.info({ count: overdue.length }, "Found overdue missed calls without callback");

  for (const call of overdue) {
    try {
      await sendOverdueCallbackAlert(call);
      markNotified(call.uid);
    } catch {
      // Left un-notified on failure; will be retried on the next watchdog tick.
    }
  }
}
