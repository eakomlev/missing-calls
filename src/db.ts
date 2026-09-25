import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS missed_calls (
    uid TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    account TEXT,
    start_ts TEXT NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_missed_calls_phone_normalized
    ON missed_calls (phone_normalized);

  CREATE INDEX IF NOT EXISTS idx_missed_calls_pending
    ON missed_calls (resolved, notified);

  CREATE TABLE IF NOT EXISTS poll_state (
    key TEXT PRIMARY KEY,
    last_poll_ts TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export interface MissedCallRow {
  uid: string;
  phone: string;
  phone_normalized: string;
  account: string | null;
  start_ts: string;
  notified: number;
  resolved: number;
  resolved_at: string | null;
  created_at: string;
}

const insertMissedStmt = db.prepare(`
  INSERT OR IGNORE INTO missed_calls (uid, phone, phone_normalized, account, start_ts)
  VALUES (?, ?, ?, ?, ?)
`);

export function insertMissedCall(
  uid: string,
  phone: string,
  phoneNormalized: string,
  account: string,
  startTs: string,
): void {
  insertMissedStmt.run(uid, phone, phoneNormalized, account, startTs);
}

const findUnresolvedByPhoneStmt = db.prepare(`
  SELECT * FROM missed_calls
  WHERE phone_normalized = ? AND resolved = 0 AND start_ts < ?
`);

export function findUnresolvedByPhone(
  phoneNormalized: string,
  beforeStartTs: string,
): MissedCallRow[] {
  return findUnresolvedByPhoneStmt.all(phoneNormalized, beforeStartTs) as unknown as MissedCallRow[];
}

const markResolvedStmt = db.prepare(`
  UPDATE missed_calls SET resolved = 1, resolved_at = ? WHERE uid = ?
`);

export function markResolved(uid: string, resolvedAt: string): void {
  markResolvedStmt.run(resolvedAt, uid);
}

const getOverdueStmt = db.prepare(`
  SELECT * FROM missed_calls
  WHERE resolved = 0 AND notified = 0 AND start_ts < ?
`);

export function getOverdueUnnotified(cutoffStartTs: string): MissedCallRow[] {
  return getOverdueStmt.all(cutoffStartTs) as unknown as MissedCallRow[];
}

const markNotifiedStmt = db.prepare(`
  UPDATE missed_calls SET notified = 1 WHERE uid = ?
`);

export function markNotified(uid: string): void {
  markNotifiedStmt.run(uid);
}

const getPollStateStmt = db.prepare(`SELECT last_poll_ts FROM poll_state WHERE key = ?`);
const setPollStateStmt = db.prepare(`
  INSERT INTO poll_state (key, last_poll_ts) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET last_poll_ts = excluded.last_poll_ts
`);

export function getLastPollTs(key: string, fallback: Date): Date {
  const row = getPollStateStmt.get(key) as { last_poll_ts: string } | undefined;
  return row ? new Date(row.last_poll_ts) : fallback;
}

export function setLastPollTs(key: string, ts: Date): void {
  setPollStateStmt.run(key, ts.toISOString());
}

const getKvStmt = db.prepare(`SELECT value FROM kv_state WHERE key = ?`);
const setKvStmt = db.prepare(`
  INSERT INTO kv_state (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

export function getKv(key: string): string | undefined {
  const row = getKvStmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setKv(key: string, value: string): void {
  setKvStmt.run(key, value);
}

export interface RangeStats {
  missed: number;
  resolved: number;
  overdueNotified: number;
}

const countMissedInRangeStmt = db.prepare(`
  SELECT COUNT(*) as cnt FROM missed_calls WHERE start_ts >= ? AND start_ts < ?
`);
const countResolvedInRangeStmt = db.prepare(`
  SELECT COUNT(*) as cnt FROM missed_calls WHERE start_ts >= ? AND start_ts < ? AND resolved = 1
`);
const countNotifiedInRangeStmt = db.prepare(`
  SELECT COUNT(*) as cnt FROM missed_calls WHERE start_ts >= ? AND start_ts < ? AND notified = 1
`);

export function getStatsForRange(startIso: string, endIsoExclusive: string): RangeStats {
  const missed = (countMissedInRangeStmt.get(startIso, endIsoExclusive) as { cnt: number }).cnt;
  const resolved = (countResolvedInRangeStmt.get(startIso, endIsoExclusive) as { cnt: number })
    .cnt;
  const overdueNotified = (
    countNotifiedInRangeStmt.get(startIso, endIsoExclusive) as { cnt: number }
  ).cnt;
  return { missed, resolved, overdueNotified };
}
