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
  tombstone,
} from './cloud-sync.logic';

const OUTBOX_KEY = 'tt.cloud.outbox';
/**
 * Account this device's local data belongs to (set by CloudSyncService when
 * the cache is bound to an account, cleared on sign-out). While it is set,
 * every local change is queued, with or without a live session.
 */
export const CLOUD_OWNER_KEY = 'tt.cloud.ownerUserId';
/**
 * Account the local data belonged to when it was last signed out. OWNER is
 * cleared on sign-out (the next login must go through the merge), so this is
 * what lets a different account's login spot data that is not its own.
 */
export const CLOUD_LAST_OWNER_KEY = 'tt.cloud.lastOwnerUserId';
/**
 * Entry ops of a signed-out account: those still unpushed at sign-out, plus
 * every local change made afterwards. The first-connection merge of that
 * account's next login re-applies them (local wins) instead of letting the
 * cloud version silently undo them.
 */
export const CLOUD_PARKED_KEY = 'tt.cloud.parked';
/** Rows the server refused because of their data (device-local, diagnostic). */
const REJECTED_KEY = 'tt.cloud.rejected';
const MAX_REJECTED = 200;

export interface ParkedOps {
  userId: string;
  entries: Outbox['entries'];
}

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

  /** Whether enqueueEntries() records anything: queued for a bound account, or parked for a signed-out one. */
  isTracking(): boolean {
    return this.isEnabled() || localStorage.getItem(CLOUD_LAST_OWNER_KEY) !== null;
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
    if (!rows.length) return;
    if (this.isEnabled()) {
      this.write(enqueueEntries(this.read(), rows));
      return;
    }
    // Signed out, but the data is known to be an account's: remember which
    // entries changed, or the next login's merge would let the cloud undo
    // the edits and resurrect the deletes. Only the ids matter (the merge
    // re-derives each row from the current local entry; a gone one becomes a
    // tombstone), so bare tombstones keep a long local-only stretch from
    // duplicating the data in storage.
    const owner = localStorage.getItem(CLOUD_LAST_OWNER_KEY);
    if (owner) this.park(owner, rows.map(r => tombstone(r.id)));
  }

  /** Parked entry ops of `uid` (empty if what is parked belongs to someone else). */
  readParked(uid: string): Outbox['entries'] {
    try {
      const parked = JSON.parse(localStorage.getItem(CLOUD_PARKED_KEY) ?? 'null') as ParkedOps | null;
      return parked?.userId === uid && parked.entries && typeof parked.entries === 'object'
        ? parked.entries
        : {};
    } catch {
      return {};
    }
  }

  /** Add ops to `uid`'s parked set (coalesced by id, like the outbox). */
  park(uid: string, rows: EntryRowPayload[]): void {
    const entries = enqueueEntries({ entries: this.readParked(uid), settings: {} }, rows).entries;
    const parked: ParkedOps = { userId: uid, entries };
    this.storage.setItem(CLOUD_PARKED_KEY, JSON.stringify(parked));
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
   * themselves are untouched.
   */
  reject(rejected: { row: EntryRowPayload; code: string; message: string }[]): void {
    if (!rejected.length) return;
    const entries: Record<string, EntryRowPayload> = {};
    for (const r of rejected) entries[r.row.id] = r.row;
    this.write(ackOutbox(this.read(), { entries, settings: {} }), false);
    const at = Date.now();
    const list = [...this.readRejected(), ...rejected.map(r => ({ ...r, at }))].slice(-MAX_REJECTED);
    try {
      localStorage.setItem(REJECTED_KEY, JSON.stringify(list));
    } catch {
      // Diagnostic list only: losing it under quota pressure is acceptable.
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

  clear(): void {
    this.unsaved = null;
    localStorage.removeItem(OUTBOX_KEY);
    this._size.set(0);
    this.clearRejected();
  }

  private write(outbox: Outbox, notify = true): void {
    this.unsaved = this.storage.setItem(OUTBOX_KEY, JSON.stringify(outbox)) ? null : outbox;
    this._size.set(outboxSize(outbox));
    if (notify) this.changed$.next();
  }
}
