// src/app/services/write-access.service.ts
import { Injectable, computed, signal } from '@angular/core';
import { EntryOrigin } from '../models/time-entry.model';

/**
 * Whether this app instance may change data, as decided by the cloud edit
 * lock (see CloudLockService and supabase/migrations/0004_edit_lock.sql):
 *
 *  - `local`    no account involved (or no session to check with): always writable.
 *  - `checking` signed in, waiting for the first answer of the lock.
 *  - `holder`   this instance holds the lock (or held it and lost the network,
 *               or could not reach the server at all: it keeps working, and
 *               the server fences its writes if someone else took over).
 *  - `reader`   another instance holds the lock: read-only.
 *
 * No dependencies, so every service that writes data can ask it without a
 * circular reference to the sync engine (which drives it).
 */
export type WriteAccess =
  | { kind: 'local' }
  | { kind: 'checking' }
  | { kind: 'holder' }
  | { kind: 'reader'; holder: EntryOrigin | null };

/** Session and account binding, read synchronously at startup (see CloudSyncService). */
const OWNER_KEY = 'tt.cloud.ownerUserId';
const SESSION_KEY = 'tt.cloud.session';

@Injectable({ providedIn: 'root' })
export class WriteAccessService {
  // A bound cache with a stored session will be checked against the lock as
  // soon as the sync starts: refuse writes until then (a few hundred ms).
  private _state = signal<WriteAccess>(
    localStorage.getItem(OWNER_KEY) && localStorage.getItem(SESSION_KEY) ? { kind: 'checking' } : { kind: 'local' },
  );
  readonly state = this._state.asReadonly();
  readonly canWrite = computed(() => {
    const kind = this._state().kind;
    return kind === 'local' || kind === 'holder';
  });

  /** Bumped when a change was refused, so the read-only banner can draw attention. */
  private _refused = signal(0);
  readonly refused = this._refused.asReadonly();

  set(state: WriteAccess): void {
    this._state.set(state);
  }

  /** Call before every data change: true if it may go ahead. */
  guard(): boolean {
    if (this.canWrite()) return true;
    this._refused.update(n => n + 1);
    return false;
  }
}
