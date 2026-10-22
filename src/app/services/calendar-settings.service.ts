// src/app/services/calendar-settings.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WriteAccessService } from './write-access.service';

/**
 * The calendar URL ends up in an iframe `src` with Angular's sanitizer
 * bypassed, and it can arrive from a backup or from the cloud. Only `https:`
 * is allowed: `javascript:`/`data:` would run in this app's origin.
 */
export function isSafeCalendarUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

@Injectable({
  providedIn: 'root'
})
export class CalendarSettingsService {
  private readonly STORAGE_KEY = 'timeTrackerCalendarUrl';
  private access = inject(WriteAccessService);

  private _calendarUrl$$ = new BehaviorSubject<string>(this.load());
  public readonly calendarUrl$ = this._calendarUrl$$.asObservable();

  private load(): string {
    const url = localStorage.getItem(this.STORAGE_KEY) || '';
    return isSafeCalendarUrl(url) ? url : '';
  }

  /** Persist the URL (empty clears it). Returns false if it is not a safe https URL. */
  save(url: string): boolean {
    const trimmed = url.trim();
    if (trimmed && !isSafeCalendarUrl(trimmed)) return false;
    if (!this.access.guard()) return false;
    localStorage.setItem(this.STORAGE_KEY, trimmed);
    this._calendarUrl$$.next(trimmed);
    return true;
  }

  reloadFromStorage(): void {
    this._calendarUrl$$.next(this.load());
  }
}
