// src/app/services/cloud/cloud-outbox.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { StorageHealthService } from '../storage-health.service';
import {
  EntryRowPayload,
  Outbox,
  ackOutbox,
  emptyOutbox,
  enqueueEntries,
  enqueueSettings,
  outboxSize,
} from './cloud-sync.logic';

const OUTBOX_KEY = 'tt.cloud.outbox';
/**
 * Counter bumped on every outbox change (enqueue, ack, reject, clear), in any
 * tab. Never reset, so equal values mean "nothing changed in between".
 */
const OUTBOX_REV_KEY = 'tt.cloud.outboxRev';
/**
 * Account this device's local data belongs to (set by CloudSyncService when
 * the cache is bound to an account, cleared on sign-out). While it is set,
 * every local change is queued, with or without a live session.
 */
export const CLOUD_OWNER_KEY = 'tt.cloud.ownerUserId';
/**
 * Account the local data belonged to when it was last signed out. OWNER is
 * cleared on sign-out (the next login asks which copy wins), so this is what
 * lets a different account's login warn that the data is not its own.
 */
export const CLOUD_LAST_OWNER_KEY = 'tt.cloud.lastOwnerUserId';
/** Rows the server refused because of their data (device-local, diagnostic). */
const REJECTED_KEY = 'tt.cloud.rejected';
const MAX_REJECTED = 200;

export interface RejectedRow {
  row: EntryRowPayload;
  code: string;
  message: string;
  at: number;
}

/**
 * Persistent queue of local changes waiting to be pushed. It has no other
 * dependencies, so TimeEntryService and the settings draft can enqueue without
 * a circular reference to CloudSyncService (which drains it).
 *
 * Every operation reads and writes localStorage directly instead of caching
 * in memory: several tabs of the same origin share one outbox.
 */
@Injectable({ providedIn: 'root' })
export class CloudOutboxService {
  private storage = inject(StorageHealthService);

  /**
   * The outbox when localStorage refused to store it (quota). Kept in memory
   * so the change is still pushed while this tab is open; the next write that
   * fits in storage drops it.
   */
  private unsaved: Outbox | null = null;

  private _size = signal(outboxSize(this.read()));
  readonly size = this._size.asReadonly();

  private _rejectedCount = signal(this.readRejected().length);
  readonly rejectedCount = this._rejectedCount.asReadonly();

  /** Emits whenever something is enqueued (CloudSyncService schedules a push). */
  readonly changed$ = new Subject<void>();
  /** Emits when settings may have changed and should be diffed against the shadow. */
  readonly settingsScan$ = new Subject<void>();

  constructor() {
    // Another tab of this browser queued or pushed: keep the count true here too.
    window.addEventListener('storage', event => {
      if (event.key === OUTBOX_KEY || event.key === null) this.pendingCount();
    });
  }

  /** Ops queued right now, read from storage (the size signal can lag behind other tabs). */
  pendingCount(): number {
    const n = outboxSize(this.read());
    this._size.set(n);
    return n;
  }

  /**
   * Whether local changes are queued: while the local data belongs to an
   * account, not only while a session is live. An expired session, a schema
   * waiting for its migration or the first instants after a reload must not
   * let a change slip by unqueued: nothing would ever push it later. Read from
   * storage, so every tab agrees.
   */
  isEnabled(): boolean {
    return localStorage.getItem(CLOUD_OWNER_KEY) !== null;
  }

  read(): Outbox {
    if (this.unsaved) return this.unsaved;
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && parsed.entries && parsed.settings) return parsed;
    } catch {
      // Corrupt outbox: start over rather than block syncing forever.
    }
    return emptyOutbox();
  }

  enqueueEntries(rows: EntryRowPayload[]): void {
    if (!rows.length || !this.isEnabled()) return;
    this.write(enqueueEntries(this.read(), rows));
  }

  enqueueSettings(changes: Record<string, string | null>): void {
    if (!Object.keys(changes).length || !this.isEnabled()) return;
    this.write(enqueueSettings(this.read(), changes));
  }

  /** Ask for a settings diff (after the settings modal saves, an import, …). */
  requestSettingsScan(): void {
    if (this.isEnabled()) this.settingsScan$.next();
  }

  ack(sent: Outbox): void {
    this.write(ackOutbox(this.read(), sent), false);
  }

  /**
   * Take rows the server will never accept out of the queue (so they stop
   * blocking the rest) and keep them aside for inspection. The local entries
   * themselves are untouched, and a reload from the cloud keeps them too
   * (see rejectedEntryIds).
   */
  reject(rejected: { row: EntryRowPayload; code: string; message: string }[]): void {
    if (!rejected.length) return;
    const entries: Record<string, EntryRowPayload> = {};
    for (const r of rejected) entries[r.row.id] = r.row;
    this.write(ackOutbox(this.read(), { entries, settings: {} }), false);
    const at = Date.now();
    // One item per id: the latest refusal replaces earlier ones.
    const list = [...this.readRejected().filter(r => !(r.row.id in entries)), ...rejected.map(r => ({ ...r, at }))]
      .slice(-MAX_REJECTED);
    this.writeRejected(list);
  }

  /** Ids of local entries the server refused (live rows only: a refused delete keeps nothing). */
  rejectedEntryIds(): Set<string> {
    return new Set(this.readRejected().filter(r => !r.row.deleted).map(r => r.row.id));
  }

  /** The server accepted these ids after all (edited, deleted…): they are no longer refused. */
  forgetRejected(ids: string[]): void {
    if (!ids.length) return;
    const gone = new Set(ids);
    const list = this.readRejected();
    const kept = list.filter(r => !gone.has(r.row.id));
    if (kept.length !== list.length) this.writeRejected(kept);
  }

  private writeRejected(list: RejectedRow[]): void {
    try {
      if (list.length) localStorage.setItem(REJECTED_KEY, JSON.stringify(list));
      else localStorage.removeItem(REJECTED_KEY);
    } catch {
      // Quota: the entries stay in the local copy; only a reload from the cloud
      // (taking over the lock) would no longer know to keep them.
    }
    this._rejectedCount.set(list.length);
  }

  readRejected(): RejectedRow[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(REJECTED_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  clearRejected(): void {
    localStorage.removeItem(REJECTED_KEY);
    this._rejectedCount.set(0);
  }

  pendingEntryIds(): Set<string> {
    return new Set(Object.keys(this.read().entries));
  }

  /** Drop every queued op. The refused rows stay listed: their entries still exist locally. */
  clear(): void {
    this.unsaved = null;
    localStorage.removeItem(OUTBOX_KEY);
    this.bumpRevision();
    this._size.set(0);
  }

  /**
   * Changes whenever the outbox changes, here or in another tab. A pull
   * compares it before and after its request: rows fetched while an op was
   * queued or acknowledged may predate that op, so they must not be merged.
   */
  revision(): string {
    return `${localStorage.getItem(OUTBOX_REV_KEY) ?? 0}:${this.localRevision}`;
  }

  /** Per-tab part of revision(), for when storage refuses the shared counter. */
  private localRevision = 0;

  private bumpRevision(): void {
    this.localRevision++;
    const next = (Number(localStorage.getItem(OUTBOX_REV_KEY)) || 0) + 1;
    try {
      localStorage.setItem(OUTBOX_REV_KEY, String(next));
    } catch {
      // Quota: the per-tab counter still covers this tab's own changes.
    }
  }

  private write(outbox: Outbox, notify = true): void {
    this.bumpRevision();
    this.unsaved = this.storage.setItem(OUTBOX_KEY, JSON.stringify(outbox)) ? null : outbox;
    this._size.set(outboxSize(outbox));
    if (notify) this.changed$.next();
  }
}
