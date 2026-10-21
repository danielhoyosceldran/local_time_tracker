import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CloudSyncService } from './cloud-sync.service';
import { CloudAuthService } from './cloud-auth.service';
import { CloudOutboxService } from './cloud-outbox.service';
import { SupabaseClientService } from './supabase-client.service';
import { DataRefreshService } from '../data-refresh.service';
import { STORAGE_KEY } from '../time-entry';
import { EntryRow, EntryRowPayload } from './cloud-sync.logic';

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

  beforeEach(() => {
    localStorage.clear();
    // This cache already belongs to the account: connecting activates directly.
    localStorage.setItem(OWNER_KEY, UID);
    client = new FakeClient();
    userId = signal<string | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseClientService, useValue: { get: async () => client, reset: () => {} } },
        { provide: DataRefreshService, useValue: { refreshAll: async () => {} } },
        {
          provide: CloudAuthService,
          useValue: {
            userId,
            init: async () => {},
            signOut: async () => userId.set(null),
            checkSchema: async () => ({ kind: 'ok' }),
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
      outbox.setEnabled(true);
      outbox.enqueueEntries(ids.map(closedRow));
      outbox.setEnabled(false);
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
