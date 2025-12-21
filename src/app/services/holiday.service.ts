// src/app/services/holiday.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface HolidayData {
  total: number;
  used: number;
}

@Injectable({
  providedIn: 'root'
})
export class HolidayService {
  private readonly STORAGE_KEY = 'timeTrackerHolidays';

  private _holidays$$ = new BehaviorSubject<HolidayData>(this.load());
  public readonly holidays$ = this._holidays$$.asObservable();

  private load(): HolidayData {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { total: 22, used: 0 };
    }
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed.total === 'number' && typeof parsed.used === 'number') {
        return parsed;
      }
    } catch (e) {
      console.warn('Invalid holiday data in localStorage, resetting');
    }
    return { total: 22, used: 0 };
  }

  private save(data: HolidayData): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    this._holidays$$.next(data);
  }

  updateTotal(newTotal: number): void {
    const current = this._holidays$$.getValue();
    this.save({ ...current, total: newTotal });
  }

  updateUsed(newUsed: number): void {
    const current = this._holidays$$.getValue();
    this.save({ ...current, used: newUsed });
  }
}
