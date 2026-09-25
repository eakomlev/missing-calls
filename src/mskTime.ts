/** Moscow is a fixed UTC+3 offset year-round (no DST since 2014). */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function mskDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Returns the [start, end) UTC bounds of "today" as currently seen in Moscow time. */
export function getMskDayRangeUtc(reference: Date = new Date()): {
  startIso: string;
  endIsoExclusive: string;
} {
  const { year, month, day } = mskDateParts(reference);
  const startUtcMs = Date.UTC(year, month - 1, day) - MSK_OFFSET_MS;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIsoExclusive: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}
