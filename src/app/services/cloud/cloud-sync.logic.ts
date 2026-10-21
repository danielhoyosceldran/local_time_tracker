// src/app/services/cloud/cloud-sync.logic.ts
//
// Pure, framework-free sync logic (diff, merge, outbox, conflicts). Kept apart
// from CloudSyncService so it can be unit-tested without Supabase or Angular.
import { EntryOrigin, RunningTimeEntry, TimeEntry } from '../../models/time-entry.model';

/** Shape of a `public.time_entries` row as written by the client. */
export interface EntryRowPayload {
  id: string;
  title: string | null;
  description: string | null;
  start_time: number;
  end_time: number | null;
  duration: number;
  started_by: EntryOrigin | null;
  deleted: boolean;
}

/** A `public.time_entries` row as read back from Supabase. */
export interface EntryRow extends EntryRowPayload {
  updated_at: string;
}

/** A `public.user_settings` row as read back from Supabase. */
export interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

/**
 * Pending local changes not yet acknowledged by the server. Keyed maps, so
 * coalescing is implicit: the last write for an id/key replaces earlier ones.
 */
export interface Outbox {
  entries: Record<string, EntryRowPayload>;
  settings: Record<string, string | null>;
}

export function emptyOutbox(): Outbox {
  return { entries: {}, settings: {} };
}

export function outboxSize(outbox: Outbox): number {
  return Object.keys(outbox.entries).length + Object.keys(outbox.settings).length;
}

// --- Row mapping ---

export function toRow(entry: TimeEntry | RunningTimeEntry): EntryRowPayload {
  return {
    id: entry.id,
    title: entry.title ?? null,
    description: entry.description ?? null,
    start_time: entry.startTime,
    end_time: entry.endTime,
    duration: entry.duration,
    started_by: entry.startedBy ?? null,
    deleted: false,
  };
}

export function tombstone(id: string, prev?: TimeEntry | RunningTimeEntry): EntryRowPayload {
  return prev
    ? { ...toRow(prev), deleted: true }
    : {
        id,
        title: null,
        description: null,
        start_time: 0,
        end_time: 0,
        duration: 0,
        started_by: null,
        deleted: true,
      };
}

export function fromRow(row: EntryRowPayload): TimeEntry | RunningTimeEntry {
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: Number(row.start_time),
    ...(row.started_by ? { startedBy: row.started_by } : {}),
  };
  if (row.end_time === null || row.end_time === undefined) {
    return { ...base, endTime: null, duration: 0 };
  }
  return { ...base, endTime: Number(row.end_time), duration: Number(row.duration) };
}

// --- Local diff ---

/** Changes between two versions of the local entries list. */
export function diffEntries(
  prev: TimeEntry[],
  next: TimeEntry[],
): { upserts: TimeEntry[]; deletes: TimeEntry[] } {
  const prevById = new Map(prev.map(e => [e.id, e]));
  const nextIds = new Set<string>();
  const upserts: TimeEntry[] = [];
  for (const e of next) {
    nextIds.add(e.id);
    const old = prevById.get(e.id);
    if (!old || (old !== e && !sameEntry(old, e))) upserts.push(e);
  }
  const deletes = prev.filter(e => !nextIds.has(e.id));
  return { upserts, deletes };
}

/** Field-wise equality. Postgres jsonb reorders object keys, so started_by is
 *  compared by deviceId instead of by serialized form. */
export function sameEntry(a: TimeEntry | RunningTimeEntry, b: TimeEntry | RunningTimeEntry): boolean {
  return (
    a.id === b.id &&
    (a.title ?? null) === (b.title ?? null) &&
    (a.description ?? null) === (b.description ?? null) &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.duration === b.duration &&
    (a.startedBy?.deviceId ?? null) === (b.startedBy?.deviceId ?? null)
  );
}

// --- Outbox ---

export function enqueueEntries(outbox: Outbox, rows: EntryRowPayload[]): Outbox {
  if (!rows.length) return outbox;
  const entries = { ...outbox.entries };
  for (const r of rows) entries[r.id] = r;
  return { ...outbox, entries };
}

export function enqueueSettings(outbox: Outbox, changes: Record<string, string | null>): Outbox {
  if (!Object.keys(changes).length) return outbox;
  return { ...outbox, settings: { ...outbox.settings, ...changes } };
}

/**
 * Drop the ops that were acknowledged by the server. An op that changed again
 * while the request was in flight is kept, so it gets pushed next time.
 */
export function ackOutbox(current: Outbox, sent: Outbox): Outbox {
  const entries = { ...current.entries };
  for (const [id, row] of Object.entries(sent.entries)) {
    if (entries[id] && JSON.stringify(entries[id]) === JSON.stringify(row)) delete entries[id];
  }
  const settings = { ...current.settings };
  for (const [key, value] of Object.entries(sent.settings)) {
    if (key in settings && settings[key] === value) delete settings[key];
  }
  return { entries, settings };
}

/**
 * Postgres errors caused by the row's own data (bad type, NOT NULL, CHECK).
 * Retrying such a row can never succeed, so it must leave the outbox instead
 * of blocking every later change. Network/auth errors are not in this set.
 */
export function isDataError(code: string | undefined): boolean {
  return !!code && (code.startsWith('22') || code === '23502' || code === '23514');
}

/**
 * Errors that only concern the row being written, so it can leave the outbox
 * without blocking the rest: bad data, or an id that already belongs to
 * another account (e.g. a backup imported from a different user), which RLS
 * refuses with "new row violates row-level security policy". A missing grant
 * ("permission denied for table", same code 42501) is NOT included: that
 * means the request went out without a session and every row would fail.
 */
export function isRowRejection(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (isDataError(error.code)) return true;
  return error.code === '42501' && /row-level security/i.test(error.message ?? '');
}

// --- Merge remote → local ---

export interface LocalState {
  entries: TimeEntry[];
  running: RunningTimeEntry | null;
}

/**
 * Apply remote rows onto the local state, merging by id:
 *  - ids with a pending local op are skipped (local wins; it will be pushed),
 *  - tombstones remove the entry (or the running timer),
 *  - a row without end_time becomes the running timer,
 *  - anything else upserts the completed entry.
 */
export function mergeRemote(
  local: LocalState,
  rows: EntryRow[],
  pendingIds: ReadonlySet<string>,
): LocalState & { changed: boolean } {
  const byId = new Map(local.entries.map(e => [e.id, e]));
  let running = local.running;
  let changed = false;

  for (const row of rows) {
    if (pendingIds.has(row.id)) continue;

    if (row.deleted) {
      if (byId.delete(row.id)) changed = true;
      if (running?.id === row.id) {
        running = null;
        changed = true;
      }
      continue;
    }

    const entry = fromRow(row);
    if (entry.endTime === null) {
      // A different local timer that is still unpushed wins for now; the push
      // will hit the one-running-per-user index and resolve the conflict.
      if (running && running.id !== entry.id && pendingIds.has(running.id)) continue;
      if (!running || !sameEntry(running, entry)) {
        running = entry as RunningTimeEntry;
        changed = true;
      }
      if (byId.delete(entry.id)) changed = true;
    } else {
      const old = byId.get(entry.id);
      if (!old || !sameEntry(old, entry)) {
        byId.set(entry.id, entry as TimeEntry);
        changed = true;
      }
      if (running?.id === entry.id) {
        running = null; // stopped on another device
        changed = true;
      }
    }
  }

  const entries = changed
    ? Array.from(byId.values()).sort((a, b) => b.startTime - a.startTime)
    : local.entries;
  return { entries, running, changed };
}

// --- Running timer conflict ---

/**
 * Two devices started different timers while offline. The one that started
 * first is closed when the later one started; the later one keeps running.
 */
export function resolveRunningConflict(
  a: RunningTimeEntry,
  b: RunningTimeEntry,
): { closed: TimeEntry; running: RunningTimeEntry } {
  const [earlier, later] = a.startTime <= b.startTime ? [a, b] : [b, a];
  const endTime = Math.max(earlier.startTime, later.startTime);
  return {
    closed: { ...earlier, endTime, duration: endTime - earlier.startTime },
    running: later,
  };
}

// --- Settings ---

/** Keys whose value differs between `current` and the last synced `shadow`. */
export function diffSettings(
  current: Record<string, string | null>,
  shadow: Record<string, string | null>,
): Record<string, string | null> {
  const changes: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(current)) {
    if ((shadow[key] ?? null) !== value) changes[key] = value;
  }
  return changes;
}
