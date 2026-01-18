// src/app/services/holiday-dates.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'timeTrackerHolidayDates';

@Injectable({
  providedIn: 'root'
})
export class HolidayDatesService {
  private _holidayDates$$ = new BehaviorSubject<string[]>(this.loadHolidayDates());
  public readonly holidayDates$: Observable<string[]> = this._holidayDates$$.asObservable();

  constructor() {}

  private loadHolidayDates(): string[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveHolidayDates(dates: string[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
    this._holidayDates$$.next(dates);
  }

  addHolidayDate(date: string): boolean {
    const currentDates = this._holidayDates$$.getValue();

    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format. Expected YYYY-MM-DD');
      return false;
    }

    // Evitar duplicados
    if (currentDates.includes(date)) {
      console.warn('Date already exists in holiday dates');
      return false;
    }

    const newDates = [...currentDates, date].sort();
    this.saveHolidayDates(newDates);
    return true;
  }

  removeHolidayDate(date: string): boolean {
    const currentDates = this._holidayDates$$.getValue();
    const newDates = currentDates.filter(d => d !== date);

    if (newDates.length === currentDates.length) {
      return false; // No se encontró la fecha
    }

    this.saveHolidayDates(newDates);
    return true;
  }

  isHolidayDate(date: string): boolean {
    return this._holidayDates$$.getValue().includes(date);
  }

  getHolidayDates(): string[] {
    return this._holidayDates$$.getValue();
  }

  // Helper: Obtener días de fiesta en un rango de fechas (solo L-V)
  getWeekdayHolidaysInRange(startDate: Date, endDate: Date): string[] {
    const holidays = this._holidayDates$$.getValue();

    return holidays.filter(dateStr => {
      const date = new Date(dateStr + 'T00:00:00'); // Parsear como fecha local

      // Verificar que esté en el rango
      if (date < startDate || date > endDate) {
        return false;
      }

      // Verificar que sea L-V (1-5, siendo 0=Domingo)
      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });
  }
}
