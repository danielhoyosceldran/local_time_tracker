// src/app/services/cloud/cloud-sync.service.ts
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_SETTING_KEYS, STORAGE_KEY, TimeEntryService, parseBackup, parseImportedEntries } from '../time-entry';
import { DataRefreshService } from '../data-refresh.service';
import { StorageHealthService } from '../storage-health.service';
import { WriteAccessService } from '../write-access.service';
import { EntryOrigin, RunningTimeEntry, TimeEntry } from '../../models/time-entry.model';
import { downloadBackup } from '../../utils/download';
import { CloudAuthService, SchemaCheck } from './cloud-auth.service';
import { CLOUD_LAST_OWNER_KEY, CLOUD_OWNER_KEY, CloudOutboxService } from './cloud-outbox.service';
import { ClaimResult, CloudLockService, LOCK_HEARTBEAT_MS, LOCK_LOST_CODE } from './cloud-lock.service';
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

/**
 * Decision needed when a device with local data signs in to an account its
 * cache is not bound to. The cloud is the source of truth once connected, so
 * the two copies are never mixed: one of them replaces the other.
 */
export type FirstConnection =
  /** This instance holds the edit lock: copy in either direction. `foreign`: the local data is another account's. */
  | { kind: 'choose'; localCount: number; remoteCount: number; foreign: boolean }
  /** Another instance holds the lock: this one can only read, so the cloud replaces the local data. */
  | { kind: 'reader'; localCount: number; holder: EntryOrigin | null };

export type FirstConnectionChoice =
  | { kind: 'toCloud' }  // the local data replaces the cloud's
  | { kind: 'toLocal' }  // the cloud's data replaces the local copy
  | { kind: 'cancel' };

// Device-local sync bookkeeping (never exported, never synced).
/** Bound account. While set, the outbox queues every local change (see CloudOutboxService.isEnabled). */
const OWNER_KEY = CLOUD_OWNER_KEY;
const ENTRIES_CURSOR_KEY = 'tt.cloud.cursor.entries';
const SETTINGS_CURSOR_KEY = 'tt.cloud.cursor.settings';
const SHADOW_KEY = 'tt.cloud.settingsShadow';
/** Whose data stays on this device after a sign-out (see CLOUD_LAST_OWNER_KEY). */
const LAST_OWNER_KEY = CLOUD_LAST_OWNER_KEY;
/** Backup of local changes thrown away because another instance took the lock: `{ at, json }`. */
const DISCARDED_KEY = 'tt.cloud.discarded';
/** Ops parked at sign-out by older builds; the explicit copy direction replaced them. */
const LEGACY_PARKED_KEY = 'tt.cloud.parked';

const ENTRY_COLUMNS = 'id,title,description,start_time,end_time,duration,started_by,deleted,updated_at';
const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 500;
/** Re-read a little before the cursor: commits can land slightly out of order. */
const CURSOR_OVERLAP_MS = 10_000;
const TICK_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;
/** How long sign-out waits for the final pull. */
const SIGN_OUT_PULL_MS = 5_000;

/**
 * Sync with Supabase. Once a device is connected the cloud is the source of
 * truth and localStorage is the copy the UI reads (it keeps working offline).
 *
 * Only the instance holding the edit lock (CloudLockService) writes: its
 * mutations are queued in the outbox and pushed. Every other instance is
 * read-only and just pulls. Remote changes are pulled incrementally
 * (triggered by Realtime) and merged by id.
 */
@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private auth = inject(CloudAuthService);
  private clients = inject(SupabaseClientService);
  private outbox = inject(CloudOutboxService);
  private lock = inject(CloudLockService);
  private access = inject(WriteAccessService);
  private time = inject(TimeEntryService);
  private dataRefresh = inject(DataRefreshService);
  private storage = inject(StorageHealthService);

  readonly state = signal<CloudSyncState>('disabled');
  readonly lastSyncAt = signal<number | null>(null);
  readonly schema = signal<SchemaCheck | null>(null);
  readonly firstConnection = signal<FirstConnection | null>(null);
  /** When local changes were last discarded after losing the lock (a backup is kept). */
  readonly discardedAt = signal<number | null>(readDiscarded()?.at ?? null);

  private userId: string | null = null;
  private active = false;
  private started = false;
  private channel: RealtimeChannel | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lockTimer: ReturnType<typeof setInterval> | null = null;
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
  private pullRun: Promise<void> | null = null;
  private claimRun: Promise<void> | null = null;
  /** Counts behind the first-connection dialog, to switch it if the lock changes hands meanwhile. */
  private setupCounts: { localCount: number; remoteCount: number; foreign: boolean } | null = null;
  /** The discarded backup when localStorage had no room for it. */
  private discardedInMemory: { at: number; json: string } | null = null;
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
    await this.checkLock();
    this.scanSettings();
    await this.flush();
    await this.pull();
  }

  /** "Take control": take the lock from the instance using it now. That one turns read-only. */
  async takeControl(): Promise<void> {
    if (!this.userId) return;
    await this.checkLock(true);
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
    this.access.set({ kind: 'local' });
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
      // Offline at startup: if this cache is ours, keep working on it (the
      // lock is claimed once the server answers; see onClaim).
      if (owner === uid) this.activate(false);
      else this.state.set('offline');
      this.scheduleRetry();
      return;
    }
    if (schema.kind !== 'ok') {
      this.access.set({ kind: 'local' });
      this.state.set('setup');
      return;
    }

    if (owner === uid) {
      this.activate();
      return;
    }

    // Not bound yet: whether this instance may write decides what it can offer.
    // The heartbeat keeps the lock while the dialog waits for an answer.
    this.access.set({ kind: 'checking' });
    this.startLockLoop();
    const claim = await this.lock.claim();
    if (stale()) return;
    const client = await this.clients.get();
    if (!client || stale()) return;
    const { count, error } = await client
      .from('time_entries')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false);
    if (stale()) return;
    if (error || claim.kind === 'network') {
      this.stopLockLoop();
      this.access.set({ kind: 'local' });
      this.state.set('offline');
      this.scheduleRetry();
      return;
    }

    const { entries, running } = this.time.snapshot();
    const localCount = entries.length + (running ? 1 : 0);
    if (localCount === 0) {
      // Fresh device: everything comes from the cloud, settings included.
      this.bindOwner(uid);
      this.writeShadow(this.readSettings());
      this.activate();
      return;
    }
    const lastOwner = localStorage.getItem(LAST_OWNER_KEY);
    this.setupCounts = {
      localCount,
      remoteCount: count ?? 0,
      foreign: !!owner || (!!lastOwner && lastOwner !== uid),
    };
    this.firstConnection.set(
      claim.kind === 'held'
        ? { kind: 'reader', localCount, holder: claim.holder }
        : { kind: 'choose', ...this.setupCounts },
    );
    this.state.set('setup');
  }

  async resolveFirstConnection(choice: FirstConnectionChoice): Promise<void> {
    const uid = this.userId;
    if (!uid) return;
    const pending = this.firstConnection();
    if (choice.kind === 'cancel') {
      this.firstConnection.set(null);
      await this.signOut({ wipeLocal: false });
      return;
    }
    // Lost the lock while the dialog was open (it switched to 'reader').
    if (choice.kind === 'toCloud' && pending?.kind !== 'choose') return;

    this.firstConnection.set(null);
    this.state.set('syncing');
    const epoch = this.epoch;
    try {
      const client = await this.clients.get();
      if (!client) throw new Error('Supabase is not configured');
      if (choice.kind === 'toLocal') {
        if (!(await this.replaceLocalWithCloud(client, epoch))) return;
        this.bindOwner(uid);
      } else {
        const rows = await this.fetchEntryRows(client, null);
        if (epoch !== this.epoch) return;
        this.bindOwner(uid);
        // Ops queued for whoever owned this cache before do not apply here.
        this.outbox.clear();
        this.enqueueReplaceCloud(rows);
        this.saveCursor(ENTRIES_CURSOR_KEY, rows);
      }
      this.activate();
    } catch {
      if (epoch !== this.epoch) return;
      // Nothing was written yet (or the copy can simply run again): ask again.
      this.state.set('error');
      this.firstConnection.set(pending);
    }
  }

  async signOut(opts: { wipeLocal: boolean }): Promise<void> {
    if (this.active) {
      const holder = this.access.state().kind === 'holder';
      if (holder) {
        // Best effort. flush() hands back the run already in flight, and that
        // run may chain one more pass for changes queued meanwhile.
        await this.flush();
        for (let i = 0; i < 3 && this.flushRun; i++) await this.flushRun;
      }
      // Leave this device with the cloud's latest state as its local copy
      // (pointless if it is about to be wiped). Bounded: a hung request must
      // not keep the user from signing out.
      if (!opts.wipeLocal) await Promise.race([this.pull(), delay(SIGN_OUT_PULL_MS)]);
    }
    // Also when the first-connection dialog is cancelled (it may hold the
    // lock). A no-op on the server unless this instance is the holder.
    if (this.userId) await this.lock.release();
    this.deactivate();
    await this.auth.signOut();
    this.userId = null;
    // Whose data stays on this device (not necessarily the one signing out:
    // cancelling the first-connection dialog leaves the previous owner's data).
    const dataOwner = localStorage.getItem(OWNER_KEY) ?? localStorage.getItem(LAST_OWNER_KEY);
    // Forget the account binding and anything still unpushed (offline): the
    // data stays here, and the next sign-in asks which copy wins.
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
   * Never deletes rows that only exist in the cloud. Only the lock holder may.
   */
  async importMerge(json: string): Promise<void> {
    if (!this.access.guard()) throw new Error('Read-only: another instance holds the edit lock');
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
    this.settleIdle();
  }

  /** Save the backup taken when local changes were discarded. */
  downloadDiscarded(): void {
    const backup = this.discardedInMemory ?? readDiscarded();
    if (backup) downloadBackup(backup.json, new Date(backup.at));
  }

  dismissDiscarded(): void {
    this.discardedInMemory = null;
    localStorage.removeItem(DISCARDED_KEY);
    this.discardedAt.set(null);
  }

  private activate(online = true): void {
    if (!this.userId) return;
    this.active = true;
    this.state.set(online ? 'syncing' : 'offline');
    // Offline: keep working on the bound copy until the server can answer.
    this.access.set(online ? { kind: 'checking' } : { kind: 'holder' });
    void this.subscribeRealtime();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
    this.tickTimer = setInterval(() => this.onTick(), TICK_MS);
    this.startLockLoop();
    // The lock's answer decides between pushing (holder) and only pulling (reader).
    void this.checkLock();
  }

  private deactivate(): void {
    this.epoch++;
    this.active = false;
    this.firstConnection.set(null);
    this.setupCounts = null;
    this.schema.set(null);
    this.state.set('disabled');
    this.access.set({ kind: 'local' });
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    for (const t of [this.retryTimer, this.flushTimer, this.pullTimer]) if (t) clearTimeout(t);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = this.retryTimer = this.flushTimer = this.pullTimer = null;
    this.stopLockLoop();
    this.claimRun = null;
    const channel = this.channel;
    this.channel = null;
    if (channel) void this.clients.get().then(c => c?.removeChannel(channel));
  }

  /** This device's cache now belongs to `uid`. */
  private bindOwner(uid: string): void {
    localStorage.setItem(OWNER_KEY, uid);
    localStorage.removeItem(LAST_OWNER_KEY);
  }

  private clearBookkeeping(): void {
    for (const key of [OWNER_KEY, LAST_OWNER_KEY, ENTRIES_CURSOR_KEY, SETTINGS_CURSOR_KEY, SHADOW_KEY, LEGACY_PARKED_KEY]) {
      localStorage.removeItem(key);
    }
    this.outbox.clear();
    this.outbox.clearRejected();
  }

  // --- Edit lock ---

  private startLockLoop(): void {
    this.stopLockLoop();
    this.lockTimer = setInterval(() => void this.checkLock(), LOCK_HEARTBEAT_MS);
  }

  private stopLockLoop(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }

  /**
   * Claim the lock (the holder's heartbeat; for the others, an attempt to
   * take it if it went stale) and act on the answer. One claim at a time,
   * except a forced one ("take control").
   */
  private checkLock(force = false): Promise<void> {
    if (!this.userId) return Promise.resolve();
    if (this.claimRun && !force) return this.claimRun;
    const run: Promise<void> = this.runClaim(force).finally(() => {
      if (this.claimRun === run) this.claimRun = null;
    });
    this.claimRun = run;
    return run;
  }

  private async runClaim(force: boolean): Promise<void> {
    const epoch = this.epoch;
    const result = await this.lock.claim(force);
    if (epoch !== this.epoch) return;
    if (this.active) await this.onClaim(result, epoch);
    else this.onSetupClaim(result);
  }

  private async onClaim(result: ClaimResult, epoch: number): Promise<void> {
    const prev = this.access.state().kind;

    if (result.kind === 'network') {
      // No answer at all: keep working on the local copy. If another instance
      // took the lock meanwhile, the server refuses our writes later and
      // the 'held' branch below throws them away (with a backup).
      if (prev === 'checking') this.access.set({ kind: 'holder' });
      return;
    }

    if (result.kind === 'held') {
      this.access.set({ kind: 'reader', holder: result.holder });
      if (prev === 'reader') return;
      if (await this.lock.isOpenHere(result.instance)) {
        // Another open tab of this browser holds it: the shared localStorage
        // (outbox included) is its working copy and it pushes it itself.
        // Discarding or reloading it from the cloud would lose its changes.
        if (epoch === this.epoch) this.schedulePull();
        return;
      }
      if (epoch !== this.epoch) return;
      if (this.outbox.pendingCount()) {
        // Lost the lock with changes still unpushed (offline, frozen tab, or
        // taken by force): the cloud wins. Keep a backup, then adopt it.
        this.discardLocalChanges();
        await this.resyncFromCloud(epoch, { backedUp: true });
      } else {
        this.schedulePull();
      }
      return;
    }

    // Acquired.
    if (prev === 'holder') {
      if (this.outbox.pendingCount()) this.scheduleFlush();
      return;
    }
    if (prev === 'reader') {
      // Taking over: start from the cloud's exact state, so nothing this
      // instance shows (a missed pull, a setting tweaked while read-only) is
      // pushed as if it were a change.
      this.access.set({ kind: 'checking' });
      // Anything still queued belongs to the tab of this browser that held the
      // lock until now (taken by force, or it froze/died before pushing): it
      // was written under its lock, not ours. The cloud wins, with a backup
      // (taken only once the cloud copy arrived: if it fails, nothing is lost).
      await this.resyncFromCloud(epoch, { backedUp: false });
      if (epoch !== this.epoch) return;
    }
    this.access.set({ kind: 'holder' });
    this.scanSettings();
    void this.flush().then(() => this.pull());
  }

  /** While the first-connection dialog is open: offer only what the lock allows. */
  private onSetupClaim(result: ClaimResult): void {
    const fc = this.firstConnection();
    if (!fc || !this.setupCounts) return;
    if (result.kind === 'held' && fc.kind === 'choose') {
      this.firstConnection.set({ kind: 'reader', localCount: fc.localCount, holder: result.holder });
    } else if (result.kind === 'acquired' && fc.kind === 'reader') {
      this.firstConnection.set({ kind: 'choose', ...this.setupCounts });
    }
  }

  /** Throw away the unpushed changes, keeping a full backup the user can download. */
  private discardLocalChanges(): void {
    const backup = { at: Date.now(), json: this.time.exportAll() };
    this.discardedInMemory = this.storage.setItem(DISCARDED_KEY, JSON.stringify(backup)) ? null : backup;
    this.discardedAt.set(backup.at);
    console.warn('The edit lock changed hands: unpushed local changes were discarded for the cloud copy (a backup was kept).');
    this.outbox.clear();
  }

  /** After the lock changed hands. `backedUp`: the caller already discarded (and backed up) the queue. */
  private async resyncFromCloud(epoch: number, opts: { backedUp: boolean }): Promise<void> {
    try {
      const client = await this.clients.get();
      if (!client || epoch !== this.epoch) return;
      await this.replaceLocalWithCloud(client, epoch, { lockChange: true, backedUp: opts.backedUp });
    } catch (err) {
      if (epoch !== this.epoch) return;
      console.warn('Could not reload the cloud copy; will retry.', err);
      this.state.set(navigator.onLine ? 'error' : 'offline');
      this.scheduleRetry();
    }
  }

  /**
   * Make the local copy exactly the cloud's: entries, running timer and
   * settings (a key without a row goes back to its default). Queues nothing.
   * Returns false if the session changed meanwhile (nothing was written).
   *
   * `lockChange` (the lock changed hands, not an explicit "cloud → local"):
   * entries the server refused stay, since they can never be in the cloud and
   * the rejected notice promises they are kept on this device; and unless the
   * caller already did (`backedUp`), a backup is kept first if anything
   * unpushed or local-only is about to go.
   */
  private async replaceLocalWithCloud(
    client: SupabaseClient,
    epoch: number,
    opts: { lockChange: boolean; backedUp: boolean } = { lockChange: false, backedUp: false },
  ): Promise<boolean> {
    const rows = await this.fetchEntryRows(client, null);
    const settingRows = await this.fetchSettingRows(client, null);
    if (epoch !== this.epoch) return false;

    let kept: TimeEntry[] = [];
    if (opts.lockChange) {
      const inCloud = new Set(rows.map(r => r.id)); // tombstones included
      const refused = this.outbox.rejectedEntryIds();
      const local = this.time.snapshot();
      kept = local.entries.filter(e => refused.has(e.id) && !inCloud.has(e.id));
      const keptIds = new Set(kept.map(e => e.id));
      const dropped = [...local.entries, ...(local.running ? [local.running] : [])]
        .filter(e => !inCloud.has(e.id) && !keptIds.has(e.id));
      if (!opts.backedUp && (this.outbox.pendingCount() || dropped.length)) this.discardLocalChanges();
    }

    const live = rows.filter(r => !r.deleted).map(fromRow);
    const running = (live.find(e => e.endTime === null) as RunningTimeEntry | undefined) ?? null;
    const entries = [...(live.filter(e => e.endTime !== null) as TimeEntry[]), ...kept]
      .sort((a, b) => b.startTime - a.startTime);
    this.time.applyRemoteState(entries, running);

    const remote = new Map(settingRows.map(r => [r.key, r.value]));
    for (const key of CLOUD_SETTING_KEYS) {
      const value = remote.get(key) ?? null;
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    this.outbox.clear();
    // "Cloud → local": the refused entries went with the rest of the local copy.
    if (!opts.lockChange) this.outbox.clearRejected();
    this.saveCursor(ENTRIES_CURSOR_KEY, rows);
    this.saveCursor(SETTINGS_CURSOR_KEY, settingRows);
    this.writeShadow(this.readSettings());
    await this.dataRefresh.refreshAll();
    return epoch === this.epoch;
  }

  /** Queue what makes the cloud equal to the local copy: every local entry, a tombstone for the rest. */
  private enqueueReplaceCloud(remote: EntryRow[]): void {
    const { entries, running } = this.time.snapshot();
    const localIds = new Set([...entries.map(e => e.id), ...(running ? [running.id] : [])]);
    const gone = remote
      .filter(r => !r.deleted && !localIds.has(r.id))
      .map(r => ({ ...toRow(fromRow(r)), deleted: true }));
    this.outbox.enqueueEntries([...gone, ...entries.map(toRow), ...(running ? [toRow(running)] : [])]);
    this.outbox.enqueueSettings(this.readSettings());
    this.writeShadow(this.readSettings());
  }

  // --- Triggers ---

  private onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      // Background tabs may have missed heartbeats: find out where we stand first.
      void this.checkLock();
      this.schedulePull();
      this.scheduleFlush();
    } else {
      this.scanSettings();
      void this.flush();
    }
  };

  private onOnline = (): void => {
    this.retryDelay = 5_000;
    void this.checkLock().then(() => this.flush()).then(() => this.pull());
  };

  private onPageHide = (): void => {
    this.scanSettings();
    if (this.access.state().kind !== 'holder') return;
    // Release now so the next instance does not wait 2 minutes, unless there
    // is still something to push: then keep the lock (it goes stale on its
    // own) so this device can push it the next time it opens.
    if (this.outbox.size()) void this.flush();
    else this.lock.releaseOnClose();
  };

  /** Back from the back/forward cache: the lock may have been released at pagehide. */
  private onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) void this.checkLock();
  };

  private onTick(): void {
    this.scanSettings();
    if (this.outbox.size()) this.scheduleFlush();
    // Realtime normally drives pulls; this is a safety net for missed events.
    if (++this.tick % 2 === 0) this.schedulePull();
  }

  private scheduleFlush(): void {
    if (!this.active || this.access.state().kind !== 'holder') return;
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
      if (this.active) void this.checkLock().then(() => this.flush()).then(() => this.pull());
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

  /** Push the outbox (lock holder only). While a run is in flight, returns that run (and queues one more pass). */
  private flush(): Promise<void> {
    if (!this.active || !this.userId || this.access.state().kind !== 'holder') return Promise.resolve();
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
    // Every row says which instance wrote it: the server refuses it unless
    // that instance holds the lock (tt_require_lock, migration 0004).
    const writer = this.lock.instanceId;
    try {
      const client = await this.clients.get();
      if (!client || stale()) return;
      for (let attempt = 0; attempt < 5; attempt++) {
        const sent = this.outbox.read();
        const rows = Object.values(sent.entries).map(r => ({ ...r, user_id: uid, writer_instance: writer }));
        const settings = Object.entries(sent.settings).map(([key, value]) => ({
          user_id: uid,
          key,
          value,
          writer_instance: writer,
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
        // Refused before and accepted now (edited, deleted): no longer refused.
        const refused = new Set(rejected.map(r => r.row.id));
        this.outbox.forgetRejected(rows.map(r => r.id).filter(id => !refused.has(id)));
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
      if ((err as { code?: string } | null)?.code === LOCK_LOST_CODE) {
        // Another instance took the lock: ask the server who has it now (if
        // it went stale meanwhile, we get it back and push again).
        void this.checkLock();
        return;
      }
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

  /** Pull remote changes. While a run is in flight, returns that run (and queues one more pass). */
  private pull(): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (this.pulling) {
      this.pullAgain = true;
      return this.pullRun ?? Promise.resolve();
    }
    this.pulling = true;
    this.pullRun = this.runPull(this.epoch);
    return this.pullRun;
  }

  private async runPull(epoch: number): Promise<void> {
    const stale = () => epoch !== this.epoch;
    try {
      const client = await this.clients.get();
      if (!client || stale()) return;

      // A push acknowledged while the request was out drops its ids from the
      // outbox, so the merge would no longer protect them, yet the rows may
      // have been read before that push landed: applying them would revert
      // the change (a stopped timer running again). Any outbox change in
      // between, in any tab, throws the response away (the cursor stays put)
      // and asks again shortly.
      const changedMeanwhile = (rev: string) => {
        if (this.outbox.revision() === rev) return false;
        this.schedulePull();
        return true;
      };

      let rev = this.outbox.revision();
      const rows = await this.fetchEntryRows(client, localStorage.getItem(ENTRIES_CURSOR_KEY));
      if (stale() || changedMeanwhile(rev)) return;
      if (rows.length) {
        const merged = mergeRemote(this.time.snapshot(), rows, this.outbox.pendingEntryIds());
        if (merged.changed) this.time.applyRemoteState(merged.entries, merged.running);
        this.saveCursor(ENTRIES_CURSOR_KEY, rows);
      }

      rev = this.outbox.revision();
      const settingRows = await this.fetchSettingRows(client, localStorage.getItem(SETTINGS_CURSOR_KEY));
      if (stale() || changedMeanwhile(rev)) return;
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
      this.pullRun = null;
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

  /**
   * Queue preferences that changed since the last sync (diff against the
   * shadow). Lock holder only: what a read-only instance tweaks stays on it
   * and is replaced by the cloud's values when it takes over.
   */
  private scanSettings(): void {
    if (!this.active || this.access.state().kind !== 'holder') return;
    const current = this.readSettings();
    const changes = diffSettings(current, this.readShadow());
    if (!Object.keys(changes).length) return;
    this.outbox.enqueueSettings(changes);
    this.writeShadow(current);
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readDiscarded(): { at: number; json: string } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISCARDED_KEY) ?? 'null');
    return parsed && typeof parsed.at === 'number' && typeof parsed.json === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
