// src/app/services/holiday-dates.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PUBLIC_HOLIDAYS } from '../data/public-holidays';

const STORAGE_KEY = 'timeTrackerHolidayDates';

export type HolidayType = 'personal' | 'public';

interface HolidayStore {
  personal: string[];
  public: string[];
}

export interface PresetOption {
  city: string;
  year: string;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class HolidayDatesService {
  private _store$$ = new BehaviorSubject<HolidayStore>(this.loadStore());

  // Combined union (back-compat) — anything in here counts as a holiday day.
  public readonly holidayDates$: Observable<string[]> = new Observable(subscriber => {
    const sub = this._store$$.subscribe(s => subscriber.next(this.union(s)));
    return () => sub.unsubscribe();
  });

  public readonly store$: Observable<HolidayStore> = this._store$$.asObservable();

  constructor() {}

  private loadStore(): HolidayStore {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { personal: [], public: [] };
    try {
      const parsed = JSON.parse(raw);
      // Legacy format: plain array of strings → treat all as personal.
      if (Array.isArray(parsed)) {
        return { personal: [...parsed].sort(), public: [] };
      }
      if (parsed && typeof parsed === 'object') {
        const personal = Array.isArray(parsed.personal) ? parsed.personal : [];
        const pub = Array.isArray(parsed.public) ? parsed.public : [];
        return { personal: [...personal].sort(), public: [...pub].sort() };
      }
    } catch {
      // fall through
    }
    return { personal: [], public: [] };
  }

  private saveStore(store: HolidayStore): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    this._store$$.next(store);
  }

  private union(store: HolidayStore): string[] {
    return [...new Set([...store.personal, ...store.public])].sort();
  }

  private isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  addHolidayDate(date: string, type: HolidayType = 'personal'): boolean {
    if (!this.isValidDate(date)) {
      console.error('Invalid date format. Expected YYYY-MM-DD');
      return false;
    }
    const store = this._store$$.getValue();
    // Reject if already present in either bucket.
    if (store.personal.includes(date) || store.public.includes(date)) {
      return false;
    }
    const next: HolidayStore = {
      personal: type === 'personal' ? [...store.personal, date].sort() : store.personal,
      public: type === 'public' ? [...store.public, date].sort() : store.public,
    };
    this.saveStore(next);
    return true;
  }

  removeHolidayDate(date: string): boolean {
    const store = this._store$$.getValue();
    const inP = store.personal.includes(date);
    const inU = store.public.includes(date);
    if (!inP && !inU) return false;
    this.saveStore({
      personal: inP ? store.personal.filter(d => d !== date) : store.personal,
      public: inU ? store.public.filter(d => d !== date) : store.public,
    });
    return true;
  }

  isHolidayDate(date: string): boolean {
    const s = this._store$$.getValue();
    return s.personal.includes(date) || s.public.includes(date);
  }

  isPublicHoliday(date: string): boolean {
    return this._store$$.getValue().public.includes(date);
  }

  isPersonalHoliday(date: string): boolean {
    return this._store$$.getValue().personal.includes(date);
  }

  getHolidayDates(): string[] {
    return this.union(this._store$$.getValue());
  }

  getPersonalCount(): number {
    return this._store$$.getValue().personal.length;
  }

  getPublicCount(): number {
    return this._store$$.getValue().public.length;
  }

  reloadFromStorage(): void {
    this._store$$.next(this.loadStore());
  }

  // Helper: Obtener días de fiesta en un rango de fechas (solo L-V)
  getWeekdayHolidaysInRange(startDate: Date, endDate: Date): string[] {
    const holidays = this.union(this._store$$.getValue());

    return holidays.filter(dateStr => {
      const date = new Date(dateStr + 'T00:00:00'); // Parsear como fecha local

      if (date < startDate || date > endDate) {
        return false;
      }

      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });
  }

  // ---- Preset support ----

  listPresets(): PresetOption[] {
    const out: PresetOption[] = [];
    for (const city of Object.keys(PUBLIC_HOLIDAYS).sort()) {
      const years = PUBLIC_HOLIDAYS[city];
      if (!years) continue;
      for (const year of Object.keys(years).sort()) {
        const list = years[year];
        if (!list) continue;
        out.push({ city, year, count: list.length });
      }
    }
    return out;
  }

  // Loads a preset's dates as 'public'. Skips dates that already exist
  // (in either bucket) to avoid clobbering personal selections.
  // Returns the number of dates actually added.
  loadPreset(city: string, year: string): number {
    const years = PUBLIC_HOLIDAYS[city];
    const list = years?.[year];
    if (!list) return 0;
    const store = this._store$$.getValue();
    const existing = new Set([...store.personal, ...store.public]);
    const toAdd = list
      .map(h => h.date)
      .filter(d => this.isValidDate(d) && !existing.has(d));
    if (toAdd.length === 0) return 0;
    const next: HolidayStore = {
      personal: store.personal,
      public: [...store.public, ...toAdd].sort(),
    };
    this.saveStore(next);
    return toAdd.length;
  }
}
