import { fetchHistory } from "../atsClient";
import { getLastPollTs, setLastPollTs, findUnresolvedByPhone, markResolved } from "../db";
import { normalizePhone } from "../phoneUtils";
import { parseAtsTimestamp } from "../atsTime";
import { logger } from "../logger";

const POLL_KEY = "outgoing";
const OVERLAP_MIN = 2;

export async function pollOutgoingCalls(): Promise<void> {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastPollTs = getLastPollTs(POLL_KEY, defaultStart);
  const start = new Date(lastPollTs.getTime() - OVERLAP_MIN * 60 * 1000);

  const records = await fetchHistory("out", start, now);
  logger.info({ count: records.length, start, end: now }, "Polled outgoing calls");

  for (const record of records) {
    if (!record.start) continue;
    const outgoingStartIso = parseAtsTimestamp(record.start).toISOString();
    const phoneNormalized = normalizePhone(record.client);

    const pending = findUnresolvedByPhone(phoneNormalized, outgoingStartIso);
    for (const call of pending) {
      markResolved(call.uid, outgoingStartIso);
      logger.info(
        { uid: call.uid, phone: call.phone, outgoingUid: record.uid },
        "Missed call resolved by outgoing callback",
      );
    }
  }

  setLastPollTs(POLL_KEY, now);
}
