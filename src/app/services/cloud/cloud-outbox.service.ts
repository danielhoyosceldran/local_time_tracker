// src/app/services/cloud/cloud-outbox.service.ts
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
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
  /** True while signed in; local changes are only queued when it is set. */
  private enabled = false;

  private _size = signal(outboxSize(this.read()));
  readonly size = this._size.asReadonly();

  private _rejectedCount = signal(this.readRejected().length);
  readonly rejectedCount = this._rejectedCount.asReadonly();

  /** Emits whenever something is enqueued (CloudSyncService schedules a push). */
  readonly changed$ = new Subject<void>();
  /** Emits when settings may have changed and should be diffed against the shadow. */
  readonly settingsScan$ = new Subject<void>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  read(): Outbox {
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
    if (!this.enabled || !rows.length) return;
    this.write(enqueueEntries(this.read(), rows));
  }

  enqueueSettings(changes: Record<string, string | null>): void {
    if (!this.enabled || !Object.keys(changes).length) return;
    this.write(enqueueSettings(this.read(), changes));
  }

  /** Ask for a settings diff (after the settings modal saves, an import, …). */
  requestSettingsScan(): void {
    if (this.enabled) this.settingsScan$.next();
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
    localStorage.setItem(REJECTED_KEY, JSON.stringify(list));
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
    localStorage.removeItem(OUTBOX_KEY);
    this._size.set(0);
    this.clearRejected();
  }

  private write(outbox: Outbox, notify = true): void {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    this._size.set(outboxSize(outbox));
    if (notify) this.changed$.next();
  }
}
