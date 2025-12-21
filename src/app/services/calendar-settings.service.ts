// src/app/services/calendar-settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CalendarSettingsService {
  private readonly STORAGE_KEY = 'timeTrackerCalendarUrl';

  private _calendarUrl$$ = new BehaviorSubject<string>(this.load());
  public readonly calendarUrl$ = this._calendarUrl$$.asObservable();

  private load(): string {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  }

  save(url: string): void {
    localStorage.setItem(this.STORAGE_KEY, url);
    this._calendarUrl$$.next(url);
  }
}
