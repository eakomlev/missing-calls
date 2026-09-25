/** ATS timestamps look like YYYYmmddTHHMMSSZ, always UTC. */

export function formatAtsTimestamp(date: Date): string {
  const iso = date.toISOString(); // 2024-01-02T03:04:05.000Z
  const [datePart, timePart] = iso.split("T");
  return `${datePart.replace(/-/g, "")}T${timePart.slice(0, 8).replace(/:/g, "")}Z`;
}

// Compact form from the PDF examples: 20170703T121110Z
const COMPACT_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
// ISO 8601 form some ATS providers (e.g. MegaFon) actually return: 2026-09-24T16:08:37Z
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

export function parseAtsTimestamp(value: string): Date {
  const trimmed = value.trim();
  const match = COMPACT_RE.exec(trimmed) ?? ISO_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid ATS timestamp: ${value}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}
