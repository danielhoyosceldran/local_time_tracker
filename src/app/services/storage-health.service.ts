// src/app/services/storage-health.service.ts
import { Injectable, signal } from '@angular/core';

/**
 * Guarded localStorage writes for data that must not fail half-way. When the
 * browser refuses a write (quota exceeded, storage disabled) the caller gets
 * `false` instead of an exception, and `full` turns on so the UI can warn
 * that a change was not saved. It stays on until the user dismisses it: a
 * later small write succeeding does not mean the big one would.
 *
 * No dependencies, so TimeEntryService and CloudOutboxService can both use it.
 */
@Injectable({ providedIn: 'root' })
export class StorageHealthService {
  private _full = signal(false);
  readonly full = this._full.asReadonly();

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error(`Could not write "${key}" to localStorage.`, err);
      this._full.set(true);
      return false;
    }
  }

  dismiss(): void {
    this._full.set(false);
  }
}
