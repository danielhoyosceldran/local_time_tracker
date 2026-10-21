// src/app/services/cloud/cloud-sync.service.ts
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_SETTING_KEYS, STORAGE_KEY, TimeEntryService } from '../time-entry';
import { DataRefreshService } from '../data-refresh.service';
import { RunningTimeEntry, TimeEntry } from '../../models/time-entry.model';
import { CloudAuthService, SchemaCheck } from './cloud-auth.service';
import { CloudOutboxService } from './cloud-outbox.service';
import { SupabaseClientService } from './supabase-client.service';
import {
  EntryRow,
  EntryRowPayload,
  SettingRow,
  diffSettings,
  fromRow,
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
  | 'error';

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
const OWNER_KEY = 'tt.cloud.ownerUserId';
const ENTRIES_CURSOR_KEY = 'tt.cloud.cursor.entries';
const SETTINGS_CURSOR_KEY = 'tt.cloud.cursor.settings';
const SHADOW_KEY = 'tt.cloud.settingsShadow';

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
  private flushing = false;
  private flushAgain = false;
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
  }

  /** Re-read config/session after the cloud settings changed. */
  async reconnect(): Promise<void> {
    this.deactivate();
    this.userId = null;
    this.clients.reset();
    await this.auth.init();
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
  }

  private async connect(uid: string): Promise<void> {
    this.state.set('syncing');
    const schema = await this.auth.checkSchema();
    if (uid !== this.userId) return;
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
    if (owner) {
      this.firstConnection.set({ kind: 'foreign' });
      this.state.set('setup');
      return;
    }

    const client = await this.clients.get();
    if (!client) return;
    const { count, error } = await client
      .from('time_entries')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false);
    if (error) {
      this.state.set('offline');
      this.scheduleRetry();
      return;
    }
    const remoteCount = count ?? 0;
    const { entries, running } = this.time.snapshot();
    const localCount = entries.length + (running ? 1 : 0);

    if (localCount === 0) {
      // Fresh device: everything comes from the cloud, settings included.
      localStorage.setItem(OWNER_KEY, uid);
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
        localStorage.setItem(OWNER_KEY, uid);
        this.outbox.setEnabled(true);
        this.enqueueAllLocal({ includeSettings: true });
        this.activate();
        return;
      }

      case 'merge': {
        this.state.set('syncing');
        const client = await this.clients.get();
        if (!client) return;
        try {
          const rows = await this.fetchEntryRows(client, null);
          const remoteIds = new Set(rows.map(r => r.id));
          const local = this.time.snapshot();
          const localOnly = local.entries.filter(e => !remoteIds.has(e.id));
          const localRunning = local.running && !remoteIds.has(local.running.id) ? local.running : null;

          // Local-only ids are treated as pending so the merge keeps them
          // (including an unpushed running timer); the rest is the union.
          const keep = new Set([...localOnly.map(e => e.id), ...(localRunning ? [localRunning.id] : [])]);
          const merged = mergeRemote(local, rows, keep);
          if (merged.changed) this.time.applyRemoteState(merged.entries, merged.running);
          this.saveCursor(ENTRIES_CURSOR_KEY, rows);

          localStorage.setItem(OWNER_KEY, uid);
          this.outbox.setEnabled(true);
          this.outbox.enqueueEntries([...localOnly.map(toRow), ...(localRunning ? [toRow(localRunning)] : [])]);

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
    if (this.active) {
      try {
        await this.flush();
      } catch {
        // Best effort; local data is kept unless wiped below.
      }
    }
    this.deactivate();
    await this.auth.signOut();
    this.userId = null;
    // Forget the account binding: signing in again goes through the
    // first-connection merge, so offline edits made meanwhile are not lost.
    this.clearBookkeeping();
    if (opts.wipeLocal) {
      this.time.resetAll();
      await this.dataRefresh.refreshAll();
    }
  }

  /**
   * Import a JSON backup while signed in: merge it into local + cloud by id.
   * Never deletes rows that only exist in the cloud.
   */
  async importMerge(json: string): Promise<void> {
    const parsed = JSON.parse(json);
    const data = parsed?.data;
    if (!data || typeof data !== 'object') throw new Error('Invalid file shape');
    for (const key of CLOUD_SETTING_KEYS) {
      if (!(key in data)) continue;
      const value = data[key];
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    }
    const rawEntries = data[STORAGE_KEY];
    const entries: TimeEntry[] = rawEntries ? JSON.parse(rawEntries) : [];
    if (Array.isArray(entries)) this.time.mergeEntries(entries);
    await this.dataRefresh.refreshAll();
    this.scanSettings();
  }

  /** Whether the cloud is in charge (used to guard destructive local actions). */
  isActive(): boolean {
    return this.active;
  }

  private activate(online = true): void {
    if (!this.userId) return;
    this.active = true;
    this.outbox.setEnabled(true);
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
    this.active = false;
    this.outbox.setEnabled(false);
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

  private clearBookkeeping(): void {
    for (const key of [OWNER_KEY, ENTRIES_CURSOR_KEY, SETTINGS_CURSOR_KEY, SHADOW_KEY]) {
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

  private async flush(): Promise<void> {
    if (!this.active || !this.userId) return;
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      const client = await this.clients.get();
      if (!client) return;
      for (let attempt = 0; attempt < 5; attempt++) {
        const sent = this.outbox.read();
        const rows = Object.values(sent.entries).map(r => ({ ...r, user_id: this.userId }));
        const settings = Object.entries(sent.settings).map(([key, value]) => ({
          user_id: this.userId,
          key,
          value,
        }));
        if (!rows.length && !settings.length) break;
        this.state.set('syncing');

        // Completed/deleted rows first: closing a timer must land before a new
        // one starts, or the one-running-per-user index rejects the batch.
        const closed = rows.filter(r => r.deleted || r.end_time !== null);
        const live = rows.filter(r => !r.deleted && r.end_time === null);
        for (let i = 0; i < closed.length; i += UPSERT_CHUNK) {
          const { error } = await client
            .from('time_entries')
            .upsert(closed.slice(i, i + UPSERT_CHUNK), { onConflict: 'id' });
          if (error) throw error;
        }
        let conflict = false;
        for (const row of live) {
          const { error } = await client.from('time_entries').upsert(row, { onConflict: 'id' });
          if (error?.code === '23505') {
            await this.resolveRunningConflict(client, row);
            conflict = true;
          } else if (error) {
            throw error;
          }
        }
        if (conflict) continue; // the resolution re-queued rows; push them next round
        if (settings.length) {
          const { error } = await client
            .from('user_settings')
            .upsert(settings, { onConflict: 'user_id,key' });
          if (error) throw error;
        }
        this.outbox.ack(sent);
      }
      this.retryDelay = 5_000;
      this.lastSyncAt.set(Date.now());
      this.state.set(this.outbox.size() ? 'pending' : 'synced');
    } catch (err) {
      console.warn('Cloud push failed; will retry.', err);
      this.state.set(navigator.onLine ? 'error' : 'offline');
      this.scheduleRetry();
    } finally {
      this.flushing = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        void this.flush();
      }
    }
  }

  /** Another device has a different timer running: keep the later one. */
  private async resolveRunningConflict(client: SupabaseClient, localRow: EntryRowPayload): Promise<void> {
    const { data, error } = await client
      .from('time_entries')
      .select(ENTRY_COLUMNS)
      .is('end_time', null)
      .eq('deleted', false)
      .neq('id', localRow.id)
      .maybeSingle();
    if (error) throw error;
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
    try {
      const client = await this.clients.get();
      if (!client) return;

      const rows = await this.fetchEntryRows(client, localStorage.getItem(ENTRIES_CURSOR_KEY));
      if (rows.length) {
        const merged = mergeRemote(this.time.snapshot(), rows, this.outbox.pendingEntryIds());
        if (merged.changed) this.time.applyRemoteState(merged.entries, merged.running);
        this.saveCursor(ENTRIES_CURSOR_KEY, rows);
      }

      const settingRows = await this.fetchSettingRows(client, localStorage.getItem(SETTINGS_CURSOR_KEY));
      if (settingRows.length) {
        if (this.applyRemoteSettings(settingRows)) await this.dataRefresh.refreshAll();
        this.saveCursor(SETTINGS_CURSOR_KEY, settingRows);
      }

      this.lastSyncAt.set(Date.now());
      if (!this.flushing) this.state.set(this.outbox.size() ? 'pending' : 'synced');
    } catch (err) {
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
    const all: EntryRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = client.from('time_entries').select(ENTRY_COLUMNS);
      if (cursor) query = query.gt('updated_at', withOverlap(cursor));
      const { data, error } = await query.order('updated_at').order('id').range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...((data ?? []) as EntryRow[]));
      if (!data || data.length < PAGE_SIZE) return all;
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
