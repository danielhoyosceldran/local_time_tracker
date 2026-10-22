import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CloudSyncService } from './cloud-sync.service';
import { CloudAuthService } from './cloud-auth.service';
import { CloudOutboxService } from './cloud-outbox.service';
import { CloudLockService } from './cloud-lock.service';
import { SupabaseClientService } from './supabase-client.service';
import { DataRefreshService } from '../data-refresh.service';
import { WriteAccessService } from '../write-access.service';
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

const OTHER_DEVICE = { deviceId: 'other-device', deviceName: 'Equipo-OTRO', browser: 'Firefox' };

class FakeClient {
  /** Answers SELECTs, per table. */
  select: (table: string) => Promise<Result> = async () => ({ data: [], error: null });
  /** Answers upserts; `rows` is an array for a batch, an object for a single row. */
  upsert: (table: string, rows: unknown) => Promise<Result> = async () => ({ error: null });
  /** Answers claim_lock: this instance gets the lock unless a test says otherwise. */
  claim: (force: boolean) => { acquired: boolean; device: unknown; holder?: string } = () => ({ acquired: true, device: null });
  released = 0;

  from(table: string) {
    return {
      select: () => new FakeQuery(() => this.select(table)),
      upsert: (rows: unknown) => new FakeQuery(() => this.upsert(table, rows)),
    };
  }
  async rpc(name: string, args: { p_force?: boolean }): Promise<Result> {
    if (name === 'claim_lock') return { data: this.claim(!!args.p_force), error: null };
    if (name === 'release_lock') this.released++;
    return { data: null, error: null };
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

function closedRow(id: string): EntryRowPayload {
  return { id, title: id, description: null, start_time: 1000, end_time: 2000, duration: 1000, started_by: null, deleted: false };
}

function entry(id: string, title: string = id) {
  return { id, title, description: null, startTime: 1000, endTime: 2000, duration: 1000 };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
}

describe('CloudSyncService', () => {
  let client: FakeClient;
  let userId: ReturnType<typeof signal<string | null>>;
  let service: CloudSyncService;
  let outbox: CloudOutboxService;
  let access: WriteAccessService;
  let time: TimeEntryService;
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
        { provide: DataRefreshService, useValue: { refreshAll: async () => TestBed.inject(TimeEntryService).reloadFromStorage() } },
        {
          provide: CloudAuthService,
          useValue: {
            userId,
            accessToken: () => null,
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
    access = TestBed.inject(WriteAccessService);
    time = TestBed.inject(TimeEntryService);
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

  /** In-memory stand-in for the account's rows: upserts land in it, selects read it. */
  function fakeRemote(...ids: string[]): Map<string, EntryRow> {
    const remote = new Map<string, EntryRow>();
    let version = 0;
    const put = (row: EntryRowPayload) =>
      remote.set(row.id, { ...row, updated_at: `2026-10-01T10:00:${String(++version).padStart(2, '0')}.000000+00:00` });
    ids.forEach(id => put(closedRow(id)));
    client.upsert = async (_table, rows) => {
      (Array.isArray(rows) ? rows : [rows]).forEach(r => {
        if ((r as { id?: string }).id) put(r as EntryRowPayload);
      });
      return { error: null };
    };
    client.select = async table => {
      if (table !== 'time_entries') return { data: [], error: null };
      const rows = [...remote.values()];
      return { data: rows, count: rows.filter(r => !r.deleted).length, error: null };
    };
    return remote;
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

  describe('edit lock', () => {
    it('makes this instance read-only while another one holds the lock', async () => {
      const pushed: unknown[] = [];
      client.upsert = async (_t, rows) => (pushed.push(rows), { error: null });
      client.claim = () => ({ acquired: false, device: OTHER_DEVICE });

      await signIn();

      expect(access.state()).toEqual({ kind: 'reader', holder: OTHER_DEVICE });
      expect(time.addEntry(entry('nope'))).toBeFalse();
      expect(time.snapshot().entries).toEqual([]);
      expect(outbox.size()).toBe(0);
      expect(pushed).toEqual([]);
    });

    it('stamps every pushed row with this instance id (the server fences on it)', async () => {
      const writers: unknown[] = [];
      client.upsert = async (_t, rows) => {
        (Array.isArray(rows) ? rows : [rows]).forEach(r => writers.push((r as { writer_instance: string }).writer_instance));
        return { error: null };
      };
      await signIn();

      time.addEntry(entry('e1'));
      await new Promise(r => setTimeout(r, 250));
      await settle();

      expect(writers.length).toBeGreaterThan(0);
      expect(new Set(writers)).toEqual(new Set([TestBed.inject(CloudLockService).instanceId]));
    });

    it('discards unpushed changes (keeping a backup) when another instance took over meanwhile', async () => {
      fakeRemote('r1');
      outbox.enqueueEntries([closedRow('offline-edit')]);
      time.applyRemoteState([entry('offline-edit')], null);
      client.claim = () => ({ acquired: false, device: OTHER_DEVICE });

      await signIn();

      expect(access.state().kind).toBe('reader');
      expect(outbox.size()).toBe(0);
      expect(time.snapshot().entries.map(e => e.id)).toEqual(['r1']);
      expect(service.discardedAt()).not.toBeNull();
      expect(localStorage.getItem('tt.cloud.discarded')).toContain('offline-edit');
    });

    it('leaves the queue alone when the holder is another open tab of this browser', async () => {
      // A sibling tab: same localStorage (and outbox), its own instance lock.
      let closeSibling!: () => void;
      void navigator.locks.request('tt.instance.sibling-tab', () => new Promise<void>(r => (closeSibling = r)));
      await settle();
      try {
        fakeRemote('r1');
        outbox.enqueueEntries([closedRow('sibling-edit')]);
        time.applyRemoteState([entry('sibling-edit')], null);
        client.claim = () => ({ acquired: false, holder: 'sibling-tab', device: OTHER_DEVICE });

        await signIn();

        expect(access.state().kind).toBe('reader');
        expect(outbox.pendingEntryIds().has('sibling-edit')).toBeTrue();
        expect(time.snapshot().entries.map(e => e.id)).toContain('sibling-edit');
        expect(service.discardedAt()).toBeNull();
      } finally {
        closeSibling();
      }
    });

    it('still discards the queue when the holder instance is not open in this browser', async () => {
      fakeRemote('r1');
      outbox.enqueueEntries([closedRow('stale-edit')]);
      time.applyRemoteState([entry('stale-edit')], null);
      client.claim = () => ({ acquired: false, holder: 'closed-tab', device: OTHER_DEVICE });

      await signIn();

      expect(outbox.size()).toBe(0);
      expect(time.snapshot().entries.map(e => e.id)).toEqual(['r1']);
      expect(localStorage.getItem('tt.cloud.discarded')).toContain('stale-edit');
    });

    it('keeps a backup of what the previous holder left queued when taking control', async () => {
      fakeRemote('r1');
      client.claim = force => (force ? { acquired: true, device: null } : { acquired: false, device: OTHER_DEVICE });
      await signIn();
      expect(access.state().kind).toBe('reader');
      // Left by the tab that held the lock (same localStorage).
      time.applyRemoteState([...time.snapshot().entries, entry('their-edit')], null);
      outbox.enqueueEntries([closedRow('their-edit')]);

      await service.takeControl();
      await settle();

      expect(access.state().kind).toBe('holder');
      expect(localStorage.getItem('tt.cloud.discarded')).toContain('their-edit');
      expect(outbox.size()).toBe(0);
    });

    it('turns read-only when the server refuses a write because the lock moved', async () => {
      await signIn();
      expect(access.state().kind).toBe('holder');

      client.claim = () => ({ acquired: false, device: OTHER_DEVICE });
      client.upsert = async () => ({ error: { code: 'TT409', message: 'This app instance does not hold the edit lock' } });
      time.addEntry(entry('late'));
      await new Promise(r => setTimeout(r, 250));
      await settle();

      expect(access.state().kind).toBe('reader');
      expect(outbox.size()).toBe(0);
    });

    it('takes control by force and starts from the cloud copy', async () => {
      fakeRemote('r1');
      client.claim = force => (force ? { acquired: true, device: null } : { acquired: false, device: OTHER_DEVICE });
      await signIn();
      expect(access.state().kind).toBe('reader');

      await service.takeControl();
      await settle();

      expect(access.state().kind).toBe('holder');
      expect(time.snapshot().entries.map(e => e.id)).toEqual(['r1']);
      expect(time.addEntry(entry('mine'))).toBeTrue();
    });

    it('releases the lock when signing out', async () => {
      await signIn();
      await service.signOut({ wipeLocal: false });

      expect(client.released).toBe(1);
      expect(access.state().kind).toBe('local');
    });
  });

  describe('local data that is not bound to the account', () => {
    it('remembers whose data it was when signing out without wiping', async () => {
      await signIn();
      await service.signOut({ wipeLocal: false });

      expect(localStorage.getItem(OWNER_KEY)).toBeNull();
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBe(UID);
      expect(service.state()).toBe('disabled');
    });

    it('keeps the previous owner\'s data and name when its dialog is cancelled', async () => {
      localStorage.setItem(OWNER_KEY, 'someone-else');
      time.applyRemoteState([entry('theirs')], null);
      outbox.enqueueEntries([closedRow('theirs')]);

      await signIn();
      expect(service.firstConnection()).toEqual(jasmine.objectContaining({ kind: 'choose', foreign: true }));
      await service.resolveFirstConnection({ kind: 'cancel' });

      expect(time.snapshot().entries.map(e => e.id)).toEqual(['theirs']);
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBe('someone-else');
      expect(outbox.size()).toBe(0);
    });

    it('warns when the data belongs to a different account', async () => {
      localStorage.removeItem(OWNER_KEY);
      localStorage.setItem(LAST_OWNER_KEY, 'someone-else');
      time.applyRemoteState([entry('e1')], null);

      await signIn();

      expect(service.firstConnection()).toEqual(jasmine.objectContaining({ kind: 'choose', foreign: true }));
    });

    it('asks which copy wins when the same account signs in again', async () => {
      localStorage.removeItem(OWNER_KEY);
      localStorage.setItem(LAST_OWNER_KEY, UID);
      time.applyRemoteState([entry('e1')], null);

      await signIn();

      expect(service.firstConnection()).toEqual(jasmine.objectContaining({ kind: 'choose', foreign: false }));
    });

    it('only offers to load the cloud when another instance holds the lock', async () => {
      localStorage.removeItem(OWNER_KEY);
      time.applyRemoteState([entry('e1')], null);
      client.claim = () => ({ acquired: false, device: OTHER_DEVICE });

      await signIn();

      expect(service.firstConnection()).toEqual({ kind: 'reader', localCount: 1, holder: OTHER_DEVICE });
      await service.resolveFirstConnection({ kind: 'toCloud' });
      expect(service.firstConnection()?.kind).withContext('toCloud is refused').toBe('reader');
    });

    it('downloads a fresh device without asking', async () => {
      localStorage.removeItem(OWNER_KEY);
      fakeRemote('r1');

      await signIn();

      expect(service.firstConnection()).toBeNull();
      expect(localStorage.getItem(OWNER_KEY)).toBe(UID);
      expect(time.snapshot().entries.map(e => e.id)).toEqual(['r1']);
    });
  });

  describe('copy direction after an explicit sign-out', () => {
    let remote: Map<string, EntryRow>;

    beforeEach(async () => {
      remote = fakeRemote('a', 'b');
      await signIn();
      expect(time.snapshot().entries.map(e => e.id).sort()).toEqual(['a', 'b']);
      await service.signOut({ wipeLocal: false });

      time.updateEntry('a', 'edited offline', null);
      time.deleteEntry('b');
      time.addEntry(entry('c'));
      await signIn();
      expect(service.firstConnection()?.kind).toBe('choose');
    });

    it('local → cloud makes the cloud equal to this device', async () => {
      await service.resolveFirstConnection({ kind: 'toCloud' });
      await settle();

      expect(remote.get('a')?.title).toBe('edited offline');
      expect(remote.get('b')?.deleted).toBeTrue();
      expect(remote.get('c')?.deleted).toBeFalse();
      expect(time.snapshot().entries.map(e => e.id).sort()).toEqual(['a', 'c']);
      expect(outbox.size()).toBe(0);
    });

    it('cloud → local makes this device equal to the cloud', async () => {
      await service.resolveFirstConnection({ kind: 'toLocal' });
      await settle();

      expect(time.snapshot().entries.map(e => [e.id, e.title]).sort()).toEqual([['a', 'a'], ['b', 'b']]);
      expect(remote.has('c')).toBeFalse();
      expect(localStorage.getItem(OWNER_KEY)).toBe(UID);
    });
  });

  describe('changes made while the data is bound but nothing can be pushed', () => {
    let pushed: string[];

    beforeEach(() => {
      pushed = [];
      client.upsert = async (_table, rows) => {
        pushed.push(...(Array.isArray(rows) ? rows : [rows]).map(r => (r as EntryRowPayload).id ?? ''));
        return { error: null };
      };
    });

    it('queues them before the session is restored (right after a reload)', () => {
      time.addEntry(entry('offline-1'));

      expect(outbox.pendingEntryIds().has('offline-1')).toBeTrue();
    });

    it('keeps queueing after the session ends without a sign-out, and pushes on the next sign-in', async () => {
      await signIn();
      userId.set(null); // refresh token expired or revoked
      TestBed.tick();
      await settle();
      expect(service.state()).toBe('reauth');

      time.addEntry(entry('offline-1'));
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

      time.addEntry(entry('offline-1'));

      expect(outbox.pendingEntryIds().has('offline-1')).toBeTrue();
      expect(pushed).toEqual([]);
    });

    it('stops queueing once the local data is wiped and forgotten', () => {
      outbox.enqueueEntries([closedRow('old')]);
      localStorage.setItem(LAST_OWNER_KEY, UID);

      service.forgetLocalData();
      time.addEntry(entry('offline-1'));

      expect(outbox.size()).toBe(0);
      expect(localStorage.getItem(OWNER_KEY)).toBeNull();
      expect(localStorage.getItem(LAST_OWNER_KEY)).toBeNull();
      expect(service.state()).toBe('disabled');
    });

    it('does not track data that never belonged to an account', () => {
      localStorage.removeItem(OWNER_KEY);

      time.addEntry(entry('local'));

      expect(outbox.size()).toBe(0);
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
