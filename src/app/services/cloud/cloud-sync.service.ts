// src/app/services/cloud/cloud-sync.service.ts
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_SETTING_KEYS, STORAGE_KEY, TimeEntryService, parseBackup, parseImportedEntries } from '../time-entry';
import { DataRefreshService } from '../data-refresh.service';
import { RunningTimeEntry, TimeEntry } from '../../models/time-entry.model';
import { CloudAuthService, SchemaCheck } from './cloud-auth.service';
import {
  CLOUD_LAST_OWNER_KEY,
  CLOUD_OWNER_KEY,
  CLOUD_PARKED_KEY,
  CloudOutboxService,
} from './cloud-outbox.service';
import { SupabaseClientService } from './supabase-client.service';
import {
  EntryRow,
  EntryRowPayload,
  SettingRow,
  diffSettings,
  fromRow,
  isRowRejection,
  mergeRemote,
  resolveRunningConflict,
  toRow,
} from './cloud-sync.logic';

/** What the sync indicator shows. */
export type CloudSyncState =
  | 'disabled'   // not signed in: the app is 100% local
  | 'setup'      // signed in, but waiting for the schema or a first-connection choice
  | 'syncing'
  | 'synced'
  | 'pending'    // local changes waiting to be pushed
  | 'offline'
  | 'error'
  | 'reauth';    // the local data belongs to an account but there is no session: changes queue until sign-in

/** Decision needed the first time this device connects to an account. */
export type FirstConnection =
  | { kind: 'upload'; localCount: number }                     // cloud empty, local has data
  | { kind: 'merge'; localCount: number; remoteCount: number } // both have data
  | { kind: 'foreign' };                                       // local data belongs to another account

export type FirstConnectionChoice =
  | { kind: 'upload' }
  | { kind: 'merge'; settingsFrom: 'cloud' | 'local' }
  | { kind: 'wipeLocal' }
  | { kind: 'cancel' };

// Device-local sync bookkeeping (never exported, never synced).
/** Bound account. While set, the outbox queues every local change (see CloudOutboxService.isEnabled). */
const OWNER_KEY = CLOUD_OWNER_KEY;
const ENTRIES_CURSOR_KEY = 'tt.cloud.cursor.entries';
const SETTINGS_CURSOR_KEY = 'tt.cloud.cursor.settings';
const SHADOW_KEY = 'tt.cloud.settingsShadow';
/** Ops of a signed-out account, kept for its next login (see CLOUD_PARKED_KEY). */
const PARKED_KEY = CLOUD_PARKED_KEY;
/** Whose data stays on this device after a sign-out (see CLOUD_LAST_OWNER_KEY). */
const LAST_OWNER_KEY = CLOUD_LAST_OWNER_KEY;

const ENTRY_COLUMNS = 'id,title,description,start_time,end_time,duration,started_by,deleted,updated_at';
const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 500;
/** Re-read a little before the cursor: commits can land slightly out of order. */
const CURSOR_OVERLAP_MS = 10_000;
const TICK_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;

/**
 * Local-first sync with Supabase. localStorage stays the cache the UI reads;
 * local mutations are queued in the outbox and pushed, remote changes are
 * pulled incrementally (triggered by Realtime) and merged by id.
 */
@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private auth = inject(CloudAuthService);
  private clients = inject(SupabaseClientService);
  private outbox = inject(CloudOutboxService);
  private time = inject(TimeEntryService);
  private dataRefresh = inject(DataRefreshService);

  readonly state = signal<CloudSyncState>('disabled');
  readonly lastSyncAt = signal<number | null>(null);
  readonly schema = signal<SchemaCheck | null>(null);
  readonly firstConnection = signal<FirstConnection | null>(null);

  private userId: string | null = null;
  private active = false;
  private started = false;
  private channel: RealtimeChannel | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 5_000;
  /**
   * Bumped on every deactivate (sign-out, account switch, reconnect). Async
   * work captures it before awaiting and drops its result if it changed, so a
   * request still in flight never writes into a cache that was wiped or now
   * belongs to someone else.
   */
  private epoch = 0;
  private flushing = false;
  private flushAgain = false;
  private flushRun: Promise<void> | null = null;
  private pulling = false;
  private pullAgain = false;
  private tick = 0;

  constructor() {
    effect(() => {
      const uid = this.auth.userId();
      untracked(() => void this.onUserChanged(uid));
    });
    this.outbox.changed$.subscribe(() => this.scheduleFlush());
    this.outbox.settingsScan$.subscribe(() => this.scanSettings());
  }

  /** Restore the session (if any) and start syncing. Call once at startup. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.auth.init();
    this.settleIdle();
  }

  /** Re-read config/session after the cloud settings changed. */
  async reconnect(): Promise<void> {
    this.deactivate();
    this.userId = null;
    this.clients.reset();
    await this.auth.init();
    this.settleIdle();
  }

  /** Manual "Sync now". */
  async syncNow(): Promise<void> {
    if (!this.active) {
      if (this.userId) await this.connect(this.userId);
      return;
    }
    this.scanSettings();
    await this.flush();
    await this.pull();
  }

  // --- Session lifecycle ---

  private async onUserChanged(uid: string | null): Promise<void> {
    if (uid === this.userId) return;
    this.deactivate();
    this.userId = uid;
    if (uid) await this.connect(uid);
    // Session gone without signOut() (expired or revoked refresh token): the
    // data is still bound, so changes keep queueing and the state says so.
    else this.settleIdle();
  }

  /** State while there is no session: say so if changes are piling up for an account. */
  private settleIdle(): void {
    if (this.userId) return;
    this.state.set(this.outbox.isEnabled() && this.auth.status() === 'signedOut' ? 'reauth' : 'disabled');
  }

  private async connect(uid: string): Promise<void> {
    const epoch = this.epoch;
    const stale = () => epoch !== this.epoch || uid !== this.userId;
    this.state.set('syncing');
    const schema = await this.auth.checkSchema();
    if (stale()) return;
    this.schema.set(schema);

    const owner = localStorage.getItem(OWNER_KEY);
    if (schema.kind === 'network') {
      // Offline at startup: keep queueing locally if this cache is ours.
      if (owner === uid) this.activate(false);
      else this.state.set('offline');
      this.scheduleRetry();
      return;
    }
    if (schema.kind !== 'ok') {
      this.state.set('setup');
      return;
    }

    if (owner === uid) {
      this.activate();
      return;
    }
    const { entries, running } = this.time.snapshot();
    const localCount = entries.length + (running ? 1 : 0);
    const lastOwner = localStorage.getItem(LAST_OWNER_KEY);
    if (owner || (localCount > 0 && lastOwner && lastOwner !== uid)) {
      this.firstConnection.set({ kind: 'foreign' });
      this.state.set('setup');
      return;
    }

    const client = await this.clients.get();
    if (!client || stale()) return;
    const { count, error } = await client
      .from('time_entries')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false);
    if (stale()) return;
    if (error) {
      this.state.set('offline');
      this.scheduleRetry();
      return;
    }
    const remoteCount = count ?? 0;

    if (localCount === 0) {
      // Fresh device: everything comes from the cloud, settings included.
      this.bindOwner(uid);
      this.writeShadow(this.readSettings());
      this.activate();
    } else if (remoteCount === 0) {
      this.firstConnection.set({ kind: 'upload', localCount });
      this.state.set('setup');
    } else {
      this.firstConnection.set({ kind: 'merge', localCount, remoteCount });
      this.state.set('setup');
    }
  }

  async resolveFirstConnection(choice: FirstConnectionChoice): Promise<void> {
    const uid = this.userId;
    if (!uid) return;
    const pending = this.firstConnection();
    this.firstConnection.set(null);

    switch (choice.kind) {
      case 'cancel':
        await this.signOut({ wipeLocal: false });
        return;

      case 'wipeLocal':
        this.time.resetAll();
        this.clearBookkeeping();
        await this.dataRefresh.refreshAll();
        await this.connect(uid);
        return;

      case 'upload': {
        // Every local entry is uploaded, so parked ops add nothing.
        this.bindOwner(uid);
        this.enqueueAllLocal({ includeSettings: true });
        this.activate();
        return;
      }

      case 'merge': {
        this.state.set('syncing');
        const epoch = this.epoch;
        const client = await this.clients.get();
        if (!client || epoch !== this.epoch) return;
        try {
          const rows = await this.fetchEntryRows(client, null);
          if (epoch !== this.epoch) return; // signed out while fetching
          const remoteIds = new Set(rows.map(r => r.id));
          const local = this.time.snapshot();
          const localOnly = local.entries.filter(e => !remoteIds.has(e.id));
          const localRunning = local.running && !remoteIds.has(local.running.id) ? local.running : null;
          // Edits/deletes of shared ids that were still unpushed at sign-out.
          const parked = this.parkedRowsFor(uid, local);

          // Local-only and parked ids are treated as pending so the merge
          // keeps the local version (including an unpushed running timer);
          // the rest is the union.
          const keep = new Set([
            ...localOnly.map(e => e.id),
            ...(localRunning ? [localRunning.id] : []),
            ...parked.map(r => r.id),
          ]);
          const merged = mergeRemote(local, rows, keep);
          if (merged.changed) this.time.applyRemoteState(merged.entries, merged.running);
          this.saveCursor(ENTRIES_CURSOR_KEY, rows);

          this.bindOwner(uid);
          this.outbox.enqueueEntries([
            ...localOnly.map(toRow),
            ...(localRunning ? [toRow(localRunning)] : []),
            ...parked,
          ]);

          if (choice.settingsFrom === 'local') {
            this.outbox.enqueueSettings(this.readSettings());
            this.writeShadow(this.readSettings());
          } else {
            // Remote settings win: the next pull starts from scratch for settings.
            localStorage.removeItem(SETTINGS_CURSOR_KEY);
            this.writeShadow(this.readSettings());
          }
          this.activate();
        } catch {
          // Nothing was written yet: ask again.
          this.state.set('error');
          this.firstConnection.set(pending);
        }
        return;
      }
    }
  }

  async signOut(opts: { wipeLocal: boolean }): Promise<void> {
    const uid = this.userId;
    if (this.active) {
      // Best effort (a failed push keeps its ops in the outbox, parked below).
      // flush() hands back the run already in flight, and that run may chain
      // one more pass for changes queued meanwhile: wait for those too.
      await this.flush();
      for (let i = 0; i < 3 && this.flushRun; i++) await this.flushRun;
    }
    this.deactivate();
    await this.auth.signOut();
    this.userId = null;
    // Still unpushed (offline): park the entry ops so the first-connection
    // merge of the next login re-applies them instead of letting the cloud
    // version win. Wiping the local copy discards them (the dialog warns).
    // Read after the await: a change made while it ran was still queued.
    const pending = this.outbox.read().entries;
    // Whose data stays on this device (not necessarily `uid`: signing out of
    // the first-connection dialog leaves the previous owner's data in place).
    const dataOwner = localStorage.getItem(OWNER_KEY) ?? localStorage.getItem(LAST_OWNER_KEY);
    // The outbox queues for the bound account, which is not `uid` when this
    // is the "cancel" of a foreign-data dialog: park the ops under their owner.
    const opsOwner = localStorage.getItem(OWNER_KEY) ?? uid;
    if (opts.wipeLocal) {
      localStorage.removeItem(PARKED_KEY);
    } else if (opsOwner && Object.keys(pending).length) {
      this.outbox.park(opsOwner, Object.values(pending));
    }
    // Forget the account binding: signing in again goes through the
    // first-connection merge, so offline edits made meanwhile are not lost.
    this.clearBookkeeping();
    // The session-change effect may have run during the await above, while
    // the data was still bound, and left 'reauth' behind.
    this.settleIdle();
    if (opts.wipeLocal) {
      this.time.resetAll();
      await this.dataRefresh.refreshAll();
    } else if (dataOwner) {
      localStorage.setItem(LAST_OWNER_KEY, dataOwner);
    }
  }

  /**
   * Import a JSON backup while signed in: merge it into local + cloud by id.
   * Never deletes rows that only exist in the cloud.
   */
  async importMerge(json: string): Promise<void> {
    // Validate everything before the first write (throws on a bad file).
    const updates = parseBackup(json, [...CLOUD_SETTING_KEYS, STORAGE_KEY]);
    const rawEntries = updates[STORAGE_KEY];
    const entries = rawEntries ? parseImportedEntries(JSON.parse(rawEntries)) : [];
    for (const key of CLOUD_SETTING_KEYS) {
      if (!(key in updates)) continue;
      const value = updates[key];
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    this.time.mergeEntries(entries);
    await this.dataRefresh.refreshAll();
    this.scanSettings();
  }

  /** Whether the cloud is in charge (used to guard destructive local actions). */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Whether the local data belongs to an account, with or without a session.
   * Its changes are queued for that account, so an import must merge into it
   * rather than replace it.
   */
  isBound(): boolean {
    return this.outbox.isEnabled();
  }

  /**
   * The local data was wiped (reset while signed out): drop the account
   * binding and every unpushed op with it. The next sign-in starts like a new
   * device and downloads the account; nothing is deleted in the cloud.
   */
  forgetLocalData(): void {
    if (this.userId) return;
    this.clearBookkeeping();
    localStorage.removeItem(PARKED_KEY);
    this.settleIdle();
  }

  private activate(online = true): void {
    if (!this.userId) return;
    this.active = true;
    this.state.set(online ? 'syncing' : 'offline');
    void this.subscribeRealtime();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('pagehide', this.onPageHide);
    this.tickTimer = setInterval(() => this.onTick(), TICK_MS);
    this.scanSettings();
    void this.flush().then(() => this.pull());
  }

  private deactivate(): void {
    this.epoch++;
    this.active = false;
    this.firstConnection.set(null);
    this.schema.set(null);
    this.state.set('disabled');
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('pagehide', this.onPageHide);
    for (const t of [this.retryTimer, this.flushTimer, this.pullTimer]) if (t) clearTimeout(t);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = this.retryTimer = this.flushTimer = this.pullTimer = null;
    const channel = this.channel;
    this.channel = null;
    if (channel) void this.clients.get().then(c => c?.removeChannel(channel));
  }

  /** This device's cache now belongs to `uid`; parked ops were consumed or are moot. */
  private bindOwner(uid: string): void {
    localStorage.setItem(OWNER_KEY, uid);
    localStorage.removeItem(PARKED_KEY);
    localStorage.removeItem(LAST_OWNER_KEY);
  }

  /**
   * Parked ops for `uid`, re-derived from the CURRENT local state: the entry
   * may have changed again while signed out, and that is what the user sees.
   * Gone locally means deleted.
   */
  private parkedRowsFor(uid: string, local: { entries: TimeEntry[]; running: RunningTimeEntry | null }): EntryRowPayload[] {
    const byId = new Map<string, TimeEntry | RunningTimeEntry>(local.entries.map(e => [e.id, e]));
    if (local.running) byId.set(local.running.id, local.running);
    return Object.entries(this.outbox.readParked(uid)).map(([id, row]) => {
      const current = byId.get(id);
      return current ? toRow(current) : { ...row, deleted: true };
    });
  }

  private clearBookkeeping(): void {
    for (const key of [OWNER_KEY, LAST_OWNER_KEY, ENTRIES_CURSOR_KEY, SETTINGS_CURSOR_KEY, SHADOW_KEY]) {
      localStorage.removeItem(key);
    }
    this.outbox.clear();
  }

  // --- Triggers ---

  private onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      this.schedulePull();
      this.scheduleFlush();
    } else {
      this.scanSettings();
      void this.flush();
    }
  };

  private onOnline = (): void => {
    this.retryDelay = 5_000;
    void this.flush().then(() => this.pull());
  };

  private onPageHide = (): void => {
    this.scanSettings();
    void this.flush();
  };

  private onTick(): void {
    this.scanSettings();
    if (this.outbox.size()) this.scheduleFlush();
    // Realtime normally drives pulls; this is a safety net for missed events.
    if (++this.tick % 2 === 0) this.schedulePull();
  }

  private scheduleFlush(): void {
    if (!this.active) return;
    if (this.state() === 'synced') this.state.set('pending');
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 200);
  }

  private schedulePull(): void {
    if (!this.active) return;
    if (this.pullTimer) clearTimeout(this.pullTimer);
    this.pullTimer = setTimeout(() => {
      this.pullTimer = null;
      void this.pull();
    }, 300);
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.active) void this.flush().then(() => this.pull());
      else if (this.userId) void this.connect(this.userId);
    }, delay);
  }

  private async subscribeRealtime(): Promise<void> {
    const client = await this.clients.get();
    const uid = this.userId;
    if (!client || !uid || !this.active) return;
    const filter = `user_id=eq.${uid}`;
    this.channel = client
      .channel(`tt-sync-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter }, () =>
        this.schedulePull(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter }, () =>
        this.schedulePull(),
      )
      .subscribe(status => {
        // Catch up on anything missed while the socket was down.
        if (status === 'SUBSCRIBED') this.schedulePull();
      });
  }

  // --- Push ---

  /** Push the outbox. While a run is in flight, returns that run (and queues one more pass). */
  private flush(): Promise<void> {
    if (!this.active || !this.userId) return Promise.resolve();
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushRun ?? Promise.resolve();
    }
    this.flushing = true;
    this.flushRun = this.runFlush(this.epoch, this.userId);
    return this.flushRun;
  }

  private async runFlush(epoch: number, uid: string): Promise<void> {
    const stale = () => epoch !== this.epoch;
    try {
      const client = await this.clients.get();
      if (!client || stale()) return;
      for (let attempt = 0; attempt < 5; attempt++) {
        const sent = this.outbox.read();
        const rows = Object.values(sent.entries).map(r => ({ ...r, user_id: uid }));
        const settings = Object.entries(sent.settings).map(([key, value]) => ({
          user_id: uid,
          key,
          value,
        }));
        if (!rows.length && !settings.length) break;
        this.state.set('syncing');

        // Completed/deleted rows first: closing a timer must land before a new
        // one starts, or the one-running-per-user index rejects the batch.
        const closed = rows.filter(r => r.deleted || r.end_time !== null);
        const live = rows.filter(r => !r.deleted && r.end_time === null);
        const rejected: Parameters<CloudOutboxService['reject']>[0] = [];
        const rejectRow = (row: { id: string }, error: { code: string; message: string }) =>
          rejected.push({ row: sent.entries[row.id], code: error.code, message: error.message });

        for (let i = 0; i < closed.length; i += UPSERT_CHUNK) {
          const chunk = closed.slice(i, i + UPSERT_CHUNK);
          const { error } = await client.from('time_entries').upsert(chunk, { onConflict: 'id' });
          if (!error) continue;
          if (!isRowRejection(error)) throw error;
          // One bad row fails the whole batch: retry one by one to isolate it.
          for (const row of chunk) {
            const { error: rowError } = await client.from('time_entries').upsert(row, { onConflict: 'id' });
            if (isRowRejection(rowError)) rejectRow(row, rowError!);
            else if (rowError) throw rowError;
          }
        }
        let conflict = false;
        for (const row of live) {
          const { error } = await client.from('time_entries').upsert(row, { onConflict: 'id' });
          if (error?.code === '23505') {
            await this.resolveRunningConflict(client, row, stale);
            conflict = true;
          } else if (isRowRejection(error)) {
            rejectRow(row, error!);
          } else if (error) {
            throw error;
          }
        }
        if (stale()) return;
        if (rejected.length) {
          console.warn('Cloud rejected invalid rows; they were taken out of the queue.', rejected);
          this.outbox.reject(rejected);
        }
        if (conflict) continue; // the resolution re-queued rows; push them next round
        if (settings.length) {
          const { error } = await client
            .from('user_settings')
            .upsert(settings, { onConflict: 'user_id,key' });
          if (error) throw error;
        }
        if (stale()) return;
        this.outbox.ack(sent);
      }
      this.lastSyncAt.set(Date.now());
      if (this.outbox.size()) {
        // Gave up after repeated running-timer conflicts (or new changes
        // arrived meanwhile): try again later instead of waiting for a mutation.
        this.state.set('pending');
        this.scheduleRetry();
      } else {
        this.retryDelay = 5_000;
        this.state.set('synced');
      }
    } catch (err) {
      if (stale()) return;
      console.warn('Cloud push failed; will retry.', err);
      this.state.set(navigator.onLine ? 'error' : 'offline');
      this.scheduleRetry();
    } finally {
      this.flushing = false;
      this.flushRun = null;
      if (this.flushAgain) {
        this.flushAgain = false;
        void this.flush();
      }
    }
  }

  /** Another device has a different timer running: keep the later one. */
  private async resolveRunningConflict(
    client: SupabaseClient,
    localRow: EntryRowPayload,
    stale: () => boolean,
  ): Promise<void> {
    const { data, error } = await client
      .from('time_entries')
      .select(ENTRY_COLUMNS)
      .is('end_time', null)
      .eq('deleted', false)
      .neq('id', localRow.id)
      .maybeSingle();
    if (error) throw error;
    if (stale()) return;
    const local = this.time.snapshot().running;
    if (!data || !local || local.id !== localRow.id) return;
    const remote = fromRow(data as EntryRow) as RunningTimeEntry;
    const { closed, running } = resolveRunningConflict(local, remote);
    this.time.replaceRunning(closed, running);
  }

  // --- Pull ---

  private async pull(): Promise<void> {
    if (!this.active) return;
    if (this.pulling) {
      this.pullAgain = true;
      return;
    }
    this.pulling = true;
    const epoch = this.epoch;
    const stale = () => epoch !== this.epoch;
    try {
      const client = await this.clients.get();
      if (!client || stale()) return;

      const rows = await this.fetchEntryRows(client, localStorage.getItem(ENTRIES_CURSOR_KEY));
      if (stale()) return;
      if (rows.length) {
        const merged = mergeRemote(this.time.snapshot(), rows, this.outbox.pendingEntryIds());
        if (merged.changed) this.time.applyRemoteState(merged.entries, merged.running);
        this.saveCursor(ENTRIES_CURSOR_KEY, rows);
      }

      const settingRows = await this.fetchSettingRows(client, localStorage.getItem(SETTINGS_CURSOR_KEY));
      if (stale()) return;
      if (settingRows.length) {
        // Cursor before the refresh: the refresh awaits, and nothing after it
        // may write once the session is gone.
        const changed = this.applyRemoteSettings(settingRows);
        this.saveCursor(SETTINGS_CURSOR_KEY, settingRows);
        if (changed) await this.dataRefresh.refreshAll();
        if (stale()) return;
      }

      this.lastSyncAt.set(Date.now());
      if (!this.flushing) this.state.set(this.outbox.size() ? 'pending' : 'synced');
    } catch (err) {
      if (stale()) return;
      console.warn('Cloud pull failed; will retry.', err);
      this.state.set(navigator.onLine ? 'error' : 'offline');
      this.scheduleRetry();
    } finally {
      this.pulling = false;
      if (this.pullAgain) {
        this.pullAgain = false;
        void this.pull();
      }
    }
  }

  private async fetchEntryRows(client: SupabaseClient, cursor: string | null): Promise<EntryRow[]> {
    // Keyset pagination on (updated_at, id): with offsets, a row updated while
    // paging shifts the rest back and one row would be skipped for good (the
    // cursor then moves past it). updated_at is compared as the exact string
    // Postgres returned, since a JS Date would drop the microseconds.
    const all: EntryRow[] = [];
    let last: EntryRow | null = null;
    for (;;) {
      let query = client.from('time_entries').select(ENTRY_COLUMNS);
      if (cursor) query = query.gt('updated_at', withOverlap(cursor));
      if (last) {
        const at = `"${last.updated_at}"`;
        query = query.or(`updated_at.gt.${at},and(updated_at.eq.${at},id.gt.${last.id})`);
      }
      const { data, error } = await query.order('updated_at').order('id').limit(PAGE_SIZE);
      if (error) throw error;
      const page = (data ?? []) as EntryRow[];
      all.push(...page);
      if (page.length < PAGE_SIZE) return all;
      last = page[page.length - 1];
    }
  }

  private async fetchSettingRows(client: SupabaseClient, cursor: string | null): Promise<SettingRow[]> {
    let query = client.from('user_settings').select('key,value,updated_at');
    if (cursor) query = query.gt('updated_at', withOverlap(cursor));
    const { data, error } = await query.order('updated_at');
    if (error) throw error;
    return (data ?? []) as SettingRow[];
  }

  /** Write remote settings to localStorage. Returns true if anything changed. */
  private applyRemoteSettings(rows: SettingRow[]): boolean {
    const pending = this.outbox.read().settings;
    const allowed = new Set<string>(CLOUD_SETTING_KEYS);
    const shadow = this.readShadow();
    let changed = false;
    for (const row of rows) {
      if (!allowed.has(row.key) || row.key in pending) continue;
      if (localStorage.getItem(row.key) !== row.value) {
        if (row.value === null) localStorage.removeItem(row.key);
        else localStorage.setItem(row.key, row.value);
        changed = true;
      }
      shadow[row.key] = row.value;
    }
    this.writeShadow(shadow);
    return changed;
  }

  private saveCursor(key: string, rows: { updated_at: string }[]): void {
    let max = Date.parse(localStorage.getItem(key) ?? '') || 0;
    let maxIso = localStorage.getItem(key);
    for (const r of rows) {
      const t = Date.parse(r.updated_at);
      if (t > max) {
        max = t;
        maxIso = r.updated_at;
      }
    }
    if (maxIso) localStorage.setItem(key, maxIso);
  }

  // --- Settings ---

  /** Queue preferences that changed since the last sync (diff against the shadow). */
  private scanSettings(): void {
    if (!this.active) return;
    const current = this.readSettings();
    const changes = diffSettings(current, this.readShadow());
    if (!Object.keys(changes).length) return;
    this.outbox.enqueueSettings(changes);
    this.writeShadow(current);
  }

  private enqueueAllLocal(opts: { includeSettings: boolean }): void {
    const { entries, running } = this.time.snapshot();
    this.outbox.enqueueEntries([...entries.map(toRow), ...(running ? [toRow(running)] : [])]);
    if (opts.includeSettings) this.outbox.enqueueSettings(this.readSettings());
    this.writeShadow(this.readSettings());
  }

  private readSettings(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const key of CLOUD_SETTING_KEYS) out[key] = localStorage.getItem(key);
    return out;
  }

  private readShadow(): Record<string, string | null> {
    try {
      return JSON.parse(localStorage.getItem(SHADOW_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }

  private writeShadow(shadow: Record<string, string | null>): void {
    localStorage.setItem(SHADOW_KEY, JSON.stringify(shadow));
  }
}

function withOverlap(cursor: string): string {
  const t = Date.parse(cursor);
  return Number.isNaN(t) ? cursor : new Date(t - CURSOR_OVERLAP_MS).toISOString();
}
