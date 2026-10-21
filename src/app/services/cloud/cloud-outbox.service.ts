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

  pendingEntryIds(): Set<string> {
    return new Set(Object.keys(this.read().entries));
  }

  clear(): void {
    localStorage.removeItem(OUTBOX_KEY);
    this._size.set(0);
  }

  private write(outbox: Outbox, notify = true): void {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    this._size.set(outboxSize(outbox));
    if (notify) this.changed$.next();
  }
}
