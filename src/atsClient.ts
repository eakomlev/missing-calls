import axios from "axios";
import { config } from "./config";
import { formatAtsTimestamp } from "./atsTime";
import { logger } from "./logger";

export type AtsCallType = "in" | "out" | "missed" | "all";

export interface AtsHistoryRecord {
  uid: string;
  type: string;
  client: string;
  account: string;
  via: string;
  start: string;
  wait: string;
  duration: string;
  record: string;
  qualityControl: string;
}

const HISTORY_HEADER = "uid,type,client,account,via,start,wait,duration,record,quality_control";

function parseHistoryCsv(csv: string): AtsHistoryRecord[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines
    .filter((line) => line.toLowerCase() !== HISTORY_HEADER)
    .map((line) => {
      const fields = line.split(",");
      const [uid, type, client, account, via, start, wait, duration, record, qualityControl] =
        fields;
      return {
        uid: uid ?? "",
        type: type ?? "",
        client: client ?? "",
        account: account ?? "",
        via: via ?? "",
        start: start ?? "",
        wait: wait ?? "",
        duration: duration ?? "",
        record: record ?? "",
        qualityControl: qualityControl ?? "",
      };
    })
    .filter((record) => record.uid.length > 0);
}

/** Fetches call history from the ATS for the given window (inclusive start, exclusive-ish end). */
export async function fetchHistory(
  type: AtsCallType,
  start: Date,
  end: Date,
): Promise<AtsHistoryRecord[]> {
  const params = new URLSearchParams({
    cmd: "history",
    token: config.atsToken,
    type,
    start: formatAtsTimestamp(start),
    end: formatAtsTimestamp(end),
  });

  const response = await axios.post(config.atsApiUrl, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    responseType: "text",
    transformResponse: (data) => data, // keep raw CSV, skip axios's JSON auto-parse
  });

  if (typeof response.data !== "string") {
    logger.warn({ data: response.data }, "Unexpected non-string history response");
    return [];
  }

  return parseHistoryCsv(response.data);
}
