import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CloudSyncService } from './cloud-sync.service';
import { CloudAuthService } from './cloud-auth.service';
import { CloudOutboxService } from './cloud-outbox.service';
import { SupabaseClientService } from './supabase-client.service';
import { DataRefreshService } from '../data-refresh.service';
import { STORAGE_KEY, TimeEntryService } from '../time-entry';
import { EntryRow, EntryRowPayload } from './cloud-sync.logic';
import { SchemaCheck } from './cloud-auth.service';

type Result = { data?: unknown; error?: { code: string; message: string } | null; count?: number };

/** Chainable, awaitable stand-in for a PostgREST query builder. */
class FakeQuery {
  constructor(private run: () => Promise<Result>) {}
  select() { return this; }
  gt() { return this; }
  or() { return this; }
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  is() { return this; }
  neq() { return this; }
  maybeSingle() { return this; }
  then<T>(ok: (r: Result) => T, fail?: (e: unknown) => T) {
    return this.run().then(ok, fail);
  }
}

class FakeClient {
  /** Answers SELECTs, per table. */
  select: (table: string) => Promise<Result> = async () => ({ data: [], error: null });
  /** Answers upserts; `rows` is an array for a batch, an object for a single row. */
  upsert: (table: string, rows: unknown) => Promise<Result> = async () => ({ error: null });

  from(table: string) {
    return {
      select: () => new FakeQuery(() => this.select(table)),
      upsert: (rows: unknown) => new FakeQuery(() => this.upsert(table, rows)),
    };
  }
  channel() {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  }
  removeChannel() {
    return Promise.resolve();
  }
}

const UID = 'u1';
const OWNER_KEY = 'tt.cloud.ownerUserId';
const ENTRIES_CURSOR_KEY = 'tt.cloud.cursor.entries';
const LAST_OWNER_KEY = 'tt.cloud.lastOwnerUserId';
const PARKED_KEY = 'tt.cloud.parked';

function closedRow(id: string): EntryRowPayload {
  return { id, title: id, description: null, start_time: 1000, end_time: 2000, duration: 1000, started_by: null, deleted: false };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0));
}

describe('CloudSyncService', () => {
  let client: FakeClient;
  let userId: ReturnType<typeof signal<string | null>>;
  let service: CloudSyncService;
  let outbox: CloudOutboxService;
  let schema: SchemaCheck;

  beforeEach(() => {
    localStorage.clear();
    // This cache already belongs to the account: connecting activates directly.
    localStorage.setItem(OWNER_KEY, UID);
    client = new FakeClient();
    userId = signal<string | null>(null);
    schema = { kind: 'ok' };
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseClientService, useValue: { get: async () => client, reset: () => {} } },
        { provide: DataRefreshService, useValue: { refreshAll: async () => {} } },
        {
          provide: CloudAuthService,
          useValue: {
            userId,
            status: () => (userId() ? 'signedIn' : 'signedOut'),
            init: async () => {},
            signOut: async () => userId.set(null),
            checkSchema: async () => schema,
          },
        },
      ],
    });
    service = TestBed.inject(CloudSyncService);
    outbox = TestBed.inject(CloudOutboxService);
  });

  afterEach(async () => {
    if (service.isActive()) await service.signOut({ wipeLocal: true });
    localStorage.clear();
  });

  async function signIn(): Promise<void> {
    userId.set(UID);
    TestBed.tick();
    await settle();
  }

  describe('rows refused by RLS (id owned by another account)', () => {
    const rlsError = { code: '42501', message: 'new row violates row-level security policy for table "time_entries"' };

    function queue(...ids: string[]): void {
      outbox.enqueueEntries(ids.map(closedRow));
    }

    it('moves the refused row aside and keeps syncing the rest', async () => {
      queue('foreign', 'mine');
      client.upsert = async (_table, rows) =>
        Array.isArray(rows) || (rows as EntryRowPayload).id === 'foreign'
          ? { error: rlsError }
          : { error: null };

      await signIn();

      expect(outbox.size()).toBe(0);
      expect(outbox.readRejected().map(r => r.row.id)).toEqual(['foreign']);
      expect(service.state()).toBe('synced');
    });

    it('keeps everything queued when the request has no grant (no session)', async () => {
      queue('a', 'b');
      client.upsert = async () => ({ error: { code: '42501', message: 'permission denied for table time_entries' } });

      await signIn();

      expect(outbox.size()).toBe(2);
      expect(outbox.readRejected()).toEqual([]);
    });
  });

  describe('local data left by another account', () => {

    function seedLocalEntry(): void {
      TestBed.inject(TimeEntryService).applyRemoteState(
        [{ id: 'e1', title: 'x', description: null, startTime: 1000, endTime: 2000, duration: 1000 }],
        null,
      );
    }

    it('remembers whose data it was when signing out without wiping', async () => {
      await signIn();
      await service.signOut({ wipeLocal: false });

      expect(localStorage.getItem(OWNER_KEY)).toBeNull();
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBe(UID);
      expect(service.state()).toBe('disabled');
    });

    it('parks the bound account\'s queued ops under that account when its dialog is cancelled', async () => {
      localStorage.setItem(OWNER_KEY, 'someone-else');
      outbox.enqueueEntries([closedRow('theirs')]);

      await signIn();
      expect(service.firstConnection()?.kind).toBe('foreign');
      await service.resolveFirstConnection({ kind: 'cancel' });

      const parked = JSON.parse(localStorage.getItem(PARKED_KEY) ?? 'null');
      expect(parked?.userId).toBe('someone-else');
      expect(Object.keys(parked?.entries ?? {})).toEqual(['theirs']);
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBe('someone-else');
    });

    it('asks before mixing it into a different account', async () => {
      localStorage.removeItem(OWNER_KEY);
      localStorage.setItem(LAST_OWNER_KEY, 'someone-else');
      seedLocalEntry();

      await signIn();

      expect(service.firstConnection()?.kind).toBe('foreign');
    });

    it('offers the normal merge when the same account signs in again', async () => {
      localStorage.removeItem(OWNER_KEY);
      localStorage.setItem(LAST_OWNER_KEY, UID);
      seedLocalEntry();

      await signIn();

      expect(service.firstConnection()?.kind).toBe('upload');
    });
  });

  describe('changes made while the data is bound but nothing can be pushed', () => {
    const entry = { id: 'offline-1', title: 'x', description: null, startTime: 1000, endTime: 2000, duration: 1000 };
    let pushed: string[];

    beforeEach(() => {
      pushed = [];
      client.upsert = async (_table, rows) => {
        pushed.push(...(Array.isArray(rows) ? rows : [rows]).map(r => (r as EntryRowPayload).id ?? ''));
        return { error: null };
      };
    });

    it('queues them before the session is restored (right after a reload)', () => {
      TestBed.inject(TimeEntryService).addEntry(entry);

      expect(outbox.pendingEntryIds().has('offline-1')).toBeTrue();
    });

    it('keeps queueing after the session ends without a sign-out, and pushes on the next sign-in', async () => {
      await signIn();
      userId.set(null); // refresh token expired or revoked
      TestBed.tick();
      await settle();
      expect(service.state()).toBe('reauth');

      TestBed.inject(TimeEntryService).addEntry(entry);
      expect(outbox.pendingEntryIds().has('offline-1')).toBeTrue();
      expect(pushed).toEqual([]);

      await signIn();

      expect(pushed).toContain('offline-1');
      expect(outbox.size()).toBe(0);
      expect(service.state()).toBe('synced');
    });

    it('keeps queueing while the database waits for a migration', async () => {
      schema = { kind: 'outdated', version: 2 };
      await signIn();
      expect(service.state()).toBe('setup');

      TestBed.inject(TimeEntryService).addEntry(entry);

      expect(outbox.pendingEntryIds().has('offline-1')).toBeTrue();
      expect(pushed).toEqual([]);
    });

    it('stops queueing once the local data is wiped and forgotten', () => {
      outbox.enqueueEntries([closedRow('old')]);
      localStorage.setItem(PARKED_KEY, JSON.stringify({ userId: UID, entries: { p: closedRow('p') } }));
      localStorage.setItem(LAST_OWNER_KEY, UID);

      service.forgetLocalData();
      TestBed.inject(TimeEntryService).addEntry(entry);

      expect(outbox.size()).toBe(0);
      expect(localStorage.getItem(OWNER_KEY)).toBeNull();
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBeNull();
      expect(localStorage.getItem(PARKED_KEY)).toBeNull();
      expect(service.state()).toBe('disabled');
    });
  });

  describe('sign-out while a pull is in flight', () => {
    it('does not write the late response into the wiped cache', async () => {
      let answer!: (r: Result) => void;
      const remote: EntryRow = { ...closedRow('remote'), updated_at: '2026-10-01T10:00:00.123456+00:00' };
      client.select = table =>
        table === 'time_entries' ? new Promise<Result>(r => (answer = r)) : Promise.resolve({ data: [], error: null });

      await signIn();
      expect(answer).withContext('the pull should be waiting for its response').toBeDefined();

      await service.signOut({ wipeLocal: true });
      answer({ data: [remote], error: null });
      await settle();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ENTRIES_CURSOR_KEY)).toBeNull();
      expect(service.state()).toBe('disabled');
    });
  });
});
