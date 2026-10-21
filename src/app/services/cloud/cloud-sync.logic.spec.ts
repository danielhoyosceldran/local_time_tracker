import { RunningTimeEntry, TimeEntry, isValidTimeEntry } from '../../models/time-entry.model';
import {
  EntryRow,
  ackOutbox,
  diffEntries,
  diffSettings,
  emptyOutbox,
  enqueueEntries,
  enqueueSettings,
  fromRow,
  isDataError,
  isRowRejection,
  mergeRemote,
  resolveRunningConflict,
  toRow,
  tombstone,
} from './cloud-sync.logic';

function entry(id: string, start: number, end: number, title: string | null = null): TimeEntry {
  return { id, title, description: null, startTime: start, endTime: end, duration: end - start };
}

function running(id: string, start: number): RunningTimeEntry {
  return { id, title: null, description: null, startTime: start, endTime: null, duration: 0 };
}

function row(e: TimeEntry | RunningTimeEntry, deleted = false): EntryRow {
  return { ...toRow(e), deleted, updated_at: '2026-01-01T00:00:00Z' };
}

describe('cloud-sync.logic', () => {
  describe('row mapping', () => {
    it('round-trips completed and running entries', () => {
      const done = entry('a', 1000, 5000, 'x');
      expect(fromRow(toRow(done))).toEqual(done);
      const live = running('b', 2000);
      expect(fromRow(toRow(live))).toEqual(live);
    });

    it('coerces bigint strings from Postgres to numbers', () => {
      const r = { ...toRow(entry('a', 1, 2)), start_time: '1' as unknown as number, end_time: '2' as unknown as number };
      expect(fromRow(r).startTime).toBe(1);
      expect(fromRow(r).endTime).toBe(2);
    });
  });

  describe('diffEntries', () => {
    it('detects added, edited and deleted entries', () => {
      const a = entry('a', 0, 10);
      const b = entry('b', 20, 30);
      const c = entry('c', 40, 50);
      const next = [{ ...a, title: 'edited' }, c];
      const { upserts, deletes } = diffEntries([a, b], next);
      expect(upserts.map(e => e.id).sort()).toEqual(['a', 'c']);
      expect(deletes.map(e => e.id)).toEqual(['b']);
    });

    it('ignores unchanged copies', () => {
      const a = entry('a', 0, 10);
      expect(diffEntries([a], [{ ...a }]).upserts).toEqual([]);
    });
  });

  describe('outbox', () => {
    it('coalesces by id and key', () => {
      let o = enqueueEntries(emptyOutbox(), [toRow(entry('a', 0, 10))]);
      o = enqueueEntries(o, [tombstone('a')]);
      o = enqueueSettings(o, { 'tt.language': 'es' });
      o = enqueueSettings(o, { 'tt.language': 'ca' });
      expect(Object.keys(o.entries)).toEqual(['a']);
      expect(o.entries['a'].deleted).toBeTrue();
      expect(o.settings['tt.language']).toBe('ca');
    });

    it('keeps ops that changed while in flight', () => {
      const sent = enqueueSettings(enqueueEntries(emptyOutbox(), [toRow(entry('a', 0, 10))]), { k: '1' });
      let current = enqueueEntries(sent, [toRow(entry('b', 0, 10))]);
      current = enqueueSettings(current, { k: '2' });
      const left = ackOutbox(current, sent);
      expect(Object.keys(left.entries)).toEqual(['b']);
      expect(left.settings).toEqual({ k: '2' });
    });
  });

  describe('mergeRemote', () => {
    it('unions by id and keeps entries sorted newest first', () => {
      const local = { entries: [entry('a', 0, 10)], running: null };
      const merged = mergeRemote(local, [row(entry('b', 100, 200))], new Set());
      expect(merged.changed).toBeTrue();
      expect(merged.entries.map(e => e.id)).toEqual(['b', 'a']);
    });

    it('applies tombstones', () => {
      const local = { entries: [entry('a', 0, 10)], running: null };
      const merged = mergeRemote(local, [row(entry('a', 0, 10), true)], new Set());
      expect(merged.entries).toEqual([]);
    });

    it('lets pending local ops win', () => {
      const local = { entries: [entry('a', 0, 10, 'mine')], running: null };
      const merged = mergeRemote(local, [row(entry('a', 0, 10, 'theirs'))], new Set(['a']));
      expect(merged.changed).toBeFalse();
      expect(merged.entries[0].title).toBe('mine');
    });

    it('adopts a remote running timer and clears it when stopped elsewhere', () => {
      const started = mergeRemote({ entries: [], running: null }, [row(running('r', 100))], new Set());
      expect(started.running?.id).toBe('r');

      const stopped = mergeRemote(started, [row(entry('r', 100, 500))], new Set());
      expect(stopped.running).toBeNull();
      expect(stopped.entries.map(e => e.id)).toEqual(['r']);
    });

    it('keeps an unpushed local timer over a different remote one', () => {
      const local = { entries: [], running: running('mine', 200) };
      const merged = mergeRemote(local, [row(running('theirs', 100))], new Set(['mine']));
      expect(merged.running?.id).toBe('mine');
    });

    it('treats jsonb key reordering as unchanged', () => {
      const e: TimeEntry = { ...entry('a', 0, 10), startedBy: { deviceId: 'd', deviceName: 'n', browser: 'b' } };
      const r = row(e);
      r.started_by = { browser: 'b', deviceId: 'd', deviceName: 'n' };
      expect(mergeRemote({ entries: [e], running: null }, [r], new Set()).changed).toBeFalse();
    });
  });

  describe('resolveRunningConflict', () => {
    it('closes the earlier timer when the later one started', () => {
      const { closed, running: kept } = resolveRunningConflict(running('late', 500), running('early', 100));
      expect(closed.id).toBe('early');
      expect(closed.endTime).toBe(500);
      expect(closed.duration).toBe(400);
      expect(kept.id).toBe('late');
    });
  });

  describe('diffSettings', () => {
    it('reports changed, added and removed keys', () => {
      const changes = diffSettings({ a: '1', b: '2', c: null }, { a: '1', b: 'old', c: 'gone' });
      expect(changes).toEqual({ b: '2', c: null });
    });
  });
  describe('isDataError', () => {
    it('flags errors caused by the row itself', () => {
      for (const code of ['22P02', '22003', '23502', '23514']) expect(isDataError(code)).toBeTrue();
    });

    it('does not flag transient, auth or conflict errors', () => {
      for (const code of [undefined, '', '23505', '42501', 'PGRST301', '08006']) {
        expect(isDataError(code)).toBeFalse();
      }
    });
  });

  describe('isRowRejection', () => {
    it('rejects data errors and ids owned by another account', () => {
      expect(isRowRejection({ code: '23514', message: 'check violation' })).toBeTrue();
      expect(isRowRejection({
        code: '42501',
        message: 'new row violates row-level security policy for table "time_entries"',
      })).toBeTrue();
    });

    it('keeps missing-grant, auth and transient errors in the queue', () => {
      expect(isRowRejection(null)).toBeFalse();
      expect(isRowRejection({ code: '42501', message: 'permission denied for table time_entries' })).toBeFalse();
      expect(isRowRejection({ code: 'PGRST301', message: 'JWT expired' })).toBeFalse();
      expect(isRowRejection({ code: '23505', message: 'duplicate key' })).toBeFalse();
    });
  });

  describe('isValidTimeEntry', () => {
    it('accepts a well-formed completed entry', () => {
      expect(isValidTimeEntry(entry('a', 1000, 5000, 'x'))).toBeTrue();
    });

    it('rejects shapes the cloud would refuse', () => {
      const ok = entry('a', 1000, 5000);
      const bad: unknown[] = [
        null,
        'a',
        { ...ok, id: '' },
        { ...ok, startTime: '1000' },
        { ...ok, startTime: 1000.5 },
        { ...ok, endTime: null },
        { ...ok, endTime: 500 },
        { ...ok, duration: -1 },
        { ...ok, duration: NaN },
        { ...ok, title: 42 },
      ];
      for (const value of bad) expect(isValidTimeEntry(value)).withContext(JSON.stringify(value)).toBeFalse();
    });
  });
});
