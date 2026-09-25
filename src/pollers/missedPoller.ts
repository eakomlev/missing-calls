import { fetchHistory } from "../atsClient";
import { getLastPollTs, setLastPollTs, insertMissedCall } from "../db";
import { normalizePhone } from "../phoneUtils";
import { parseAtsTimestamp } from "../atsTime";
import { logger } from "../logger";

const POLL_KEY = "missed";
/** Re-fetch a small overlap window so calls near the boundary of a poll cycle aren't missed. */
const OVERLAP_MIN = 2;

export async function pollMissedCalls(): Promise<void> {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // first run: last 24h
  const lastPollTs = getLastPollTs(POLL_KEY, defaultStart);
  const start = new Date(lastPollTs.getTime() - OVERLAP_MIN * 60 * 1000);

  const records = await fetchHistory("missed", start, now);
  logger.info({ count: records.length, start, end: now }, "Polled missed calls");

  for (const record of records) {
    if (!record.start) continue;
    insertMissedCall(
      record.uid,
      record.client,
      normalizePhone(record.client),
      record.account,
      parseAtsTimestamp(record.start).toISOString(),
    );
  }

  setLastPollTs(POLL_KEY, now);
}
