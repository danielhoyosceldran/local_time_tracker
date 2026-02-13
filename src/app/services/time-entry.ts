// src/app/services/time-entry.service.ts
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest, interval, switchMap, map, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry, RunningTimeEntry, DailySummary, WeeklySummary, DayGroup, GlobalBalance } from '../models/time-entry.model';
import { take, tap } from 'rxjs';
import { HolidayDatesService } from './holiday-dates.service';

const STORAGE_KEY = 'timeTrackerEntries';
const RUNNING_KEY = 'timeTrackerRunningEntry';
const MARGIN_ENABLED_KEY = 'timeTrackerMarginEnabled';
const MARGIN_MINUTES_KEY = 'timeTrackerMarginMinutes';
const LUNCH_HOUR_KEY = 'timeTrackerLunchHour';
const LUNCH_DURATION_KEY = 'timeTrackerLunchDurationMin';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService implements OnDestroy {
  private holidayDatesService = inject(HolidayDatesService);
  // Single Source of Truth for the history
  private _entries$$ = new BehaviorSubject<TimeEntry[]>(this.loadEntries());
  public readonly entries$: Observable<TimeEntry[]> = this._entries$$.asObservable();

  // Single Source of Truth for the currently running task
  private _runningEntry$$ = new BehaviorSubject<RunningTimeEntry | null>(this.loadRunningEntry());
  public readonly runningEntry$: Observable<RunningTimeEntry | null> = this._runningEntry$$.asObservable();

  // Observable for the real-time duration of the running task
  public readonly runningDuration$: Observable<number> = this.runningEntry$.pipe(
    // switchMap to change the observable source when runningEntry$ changes
    switchMap(runningEntry => {
      if (!runningEntry) {
        return of(0); // If no entry is running, duration is 0
      }
      // Emit every second (1000ms) to update the time
      return interval(1000).pipe(
        map(() => Date.now() - runningEntry.startTime)
      );
    })
  );

  private subscription: Subscription = new Subscription();

  private _dailySummary$$ = new BehaviorSubject<DailySummary[]>([]);
  public readonly dailySummary$: Observable<DailySummary[]> = this._dailySummary$$.asObservable();

  private _currentWeekSummary$$ = new BehaviorSubject<WeeklySummary>({
    hoursWorked: 0,
    horasExtra: 0,
    targetHours: 40,
    weekStart: '',
    weekEnd: ''
  });
  public readonly currentWeekSummary$ = this._currentWeekSummary$$.asObservable();

  private _todaySummary$$ = new BehaviorSubject<DailySummary | null>(null);
  public readonly todaySummary$ = this._todaySummary$$.asObservable();

  private _globalBalance$$ = new BehaviorSubject<GlobalBalance>({ balanceHours: 0 });
  public readonly globalBalance$ = this._globalBalance$$.asObservable();

  // Live observables that include running timer duration (update every second)
  public readonly liveTodaySummary$: Observable<DailySummary | null> = combineLatest([
    this._todaySummary$$,
    this.runningDuration$
  ]).pipe(
    map(([summary, runningMs]) => {
      if (!summary) return null;
      return { ...summary, totalDurationMs: summary.totalDurationMs + runningMs };
    })
  );

  public readonly liveWeekSummary$: Observable<WeeklySummary> = combineLatest([
    this._currentWeekSummary$$,
    this.runningDuration$
  ]).pipe(
    map(([summary, runningMs]) => ({
      ...summary,
      hoursWorked: summary.hoursWorked + runningMs / (1000 * 60 * 60)
    }))
  );

  public readonly liveGlobalBalance$: Observable<GlobalBalance> = combineLatest([
    this._globalBalance$$,
    this.runningDuration$
  ]).pipe(
    map(([balance, runningMs]) => ({
      balanceHours: balance.balanceHours + runningMs / (1000 * 60 * 60)
    }))
  );

  constructor() {
    // Basic cleanup check for running entry on startup
    const running = this._runningEntry$$.getValue();
    if (running && running.startTime > Date.now()) {
      console.warn("Detected invalid running entry (startTime in future). Stopping it.");
      this.stopTracking();
    }

    this._entries$$.pipe(
      // Executa la lògica de càlcul cada vegada que l'historial canvia
      tap(entries => {
        this.calculateDailySummary(entries);
        this.calculateWeeklySummary(entries);
        this.calculateTodaySummary(entries);
        this.calculateGlobalBalance(entries);
      })
    ).subscribe();

    // Recalcular cuando cambien las fechas de vacaciones
    this.subscription.add(
      this.holidayDatesService.holidayDates$.pipe(
        tap(() => {
          const entries = this._entries$$.getValue();
          this.calculateWeeklySummary(entries);
          this.calculateGlobalBalance(entries);
        })
      ).subscribe()
    );
  }

  private calculateDailySummary(entries: TimeEntry[]): void {
    const summaryMap = new Map<string, number>();

    // Ús de toISOString per obtenir la data en format YYYY-MM-DDT...
    const getISODate = (timestamp: number): string => 
      new Date(timestamp).toISOString().split('T')[0];

    entries.forEach(entry => {
      // 3. Obtenir la data (YYYY-MM-DD) de l'hora d'inici
      const dateKey = getISODate(entry.startTime);
      const currentTotal = summaryMap.get(dateKey) || 0;
      summaryMap.set(dateKey, currentTotal + entry.duration);
    });

    // 4. Converteix el Map a un Array de DailySummary
    const summaryArray: DailySummary[] = Array.from(summaryMap.entries()).map(([date, totalDurationMs]) => ({
      date,
      totalDurationMs
    }));

    // Ordenar per data, de la més recent a la més antiga
    summaryArray.sort((a, b) => b.date.localeCompare(a.date));

    // 5. Emetre el nou sumari
    this._dailySummary$$.next(summaryArray);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // --- LocalStorage Persistence ---

  private loadEntries(): TimeEntry[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveEntries(entries: TimeEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    this._entries$$.next(entries);
  }

  private loadRunningEntry(): RunningTimeEntry | null {
    const data = localStorage.getItem(RUNNING_KEY);
    return data ? JSON.parse(data) : null;
  }

  private saveRunningEntry(entry: RunningTimeEntry | null): void {
    if (entry) {
      localStorage.setItem(RUNNING_KEY, JSON.stringify(entry));
    } else {
      localStorage.removeItem(RUNNING_KEY);
    }
    this._runningEntry$$.next(entry);
  }

  // --- Margin Config ---
  private _marginEnabled$$ = new BehaviorSubject<boolean>(localStorage.getItem(MARGIN_ENABLED_KEY) === 'true');
  public readonly marginEnabled$ = this._marginEnabled$$.asObservable();

  private _marginMinutes$$ = new BehaviorSubject<number>(
    parseInt(localStorage.getItem(MARGIN_MINUTES_KEY) || '10', 10)
  );
  public readonly marginMinutes$ = this._marginMinutes$$.asObservable();

  setMarginEnabled(enabled: boolean): void {
    localStorage.setItem(MARGIN_ENABLED_KEY, String(enabled));
    this._marginEnabled$$.next(enabled);
  }

  setMarginMinutes(minutes: number): void {
    const clamped = Math.max(1, Math.min(60, minutes));
    localStorage.setItem(MARGIN_MINUTES_KEY, String(clamped));
    this._marginMinutes$$.next(clamped);
  }

  // --- Lunch Config ---
  private _lunchHour$$ = new BehaviorSubject<string>(
    localStorage.getItem(LUNCH_HOUR_KEY) || '14:00'
  );
  public readonly lunchHour$ = this._lunchHour$$.asObservable();

  private _lunchDurationMin$$ = new BehaviorSubject<number>(
    parseInt(localStorage.getItem(LUNCH_DURATION_KEY) || '60', 10)
  );
  public readonly lunchDurationMin$ = this._lunchDurationMin$$.asObservable();

  setLunchHour(hour: string): void {
    localStorage.setItem(LUNCH_HOUR_KEY, hour);
    this._lunchHour$$.next(hour);
  }

  setLunchDurationMin(minutes: number): void {
    const clamped = Math.max(0, Math.min(180, minutes));
    localStorage.setItem(LUNCH_DURATION_KEY, String(clamped));
    this._lunchDurationMin$$.next(clamped);
  }

  // --- Core Logic: Start/Stop Tracking ---

  startTracking(title: string | null, description: string | null): void {
    if (this._runningEntry$$.getValue()) {
      console.warn('A task is already running. Stop it first.');
      return;
    }
    const now = Date.now();
    const newRunningEntry: RunningTimeEntry = {
      id: uuidv4(),
      title,
      description,
      startTime: now,
      endTime: null,
      duration: 0,
    };
    this.saveRunningEntry(newRunningEntry);
  }

  stopTracking(): TimeEntry | null {
    const runningEntry = this._runningEntry$$.getValue();
    if (!runningEntry) {
      return null;
    }

    let endTime = Date.now();
    let duration = endTime - runningEntry.startTime;

    // Apply margin correction if enabled
    if (this._marginEnabled$$.getValue()) {
      const marginMs = this._marginMinutes$$.getValue() * 60 * 1000;
      const today = new Date().toISOString().split('T')[0];
      const todayCompletedMs = this._entries$$.getValue()
        .filter(e => new Date(e.startTime).toISOString().split('T')[0] === today)
        .reduce((sum, e) => sum + e.duration, 0);

      const todayTotalMs = todayCompletedMs + duration;
      const diff = todayTotalMs - EIGHT_HOURS_MS;

      if (Math.abs(diff) <= marginMs) {
        const targetDuration = EIGHT_HOURS_MS - todayCompletedMs;
        if (targetDuration > 0) {
          duration = targetDuration;
          endTime = runningEntry.startTime + duration;
        }
      }
    }

    const completedEntry: TimeEntry = {
      ...runningEntry,
      endTime,
      duration,
    };

    // 1. Add to history
    this.addEntry(completedEntry);

    // 2. Clear running state
    this.saveRunningEntry(null);

    return completedEntry;
  }

  // --- CRUD Operations for History ---

  addEntry(entry: TimeEntry): void {
    const currentEntries = this._entries$$.getValue();
    // Prepend new entry and sort by newest first
    const newEntries = [entry, ...currentEntries].sort((a, b) => b.startTime - a.startTime); 
    this.saveEntries(newEntries);
  }

  updateEntry(id: string, newTitle: string | null, newDescription: string | null): boolean {
    const currentEntries = this._entries$$.getValue();
    const index = currentEntries.findIndex(e => e.id === id);

    if (index > -1) {
      const updatedEntries = [...currentEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        title: newTitle,
        description: newDescription,
      };
      this.saveEntries(updatedEntries);
      return true;
    }
    return false;
  }

  deleteEntry(id: string): void {
    const currentEntries = this._entries$$.getValue();
    const newEntries = currentEntries.filter(e => e.id !== id);
    this.saveEntries(newEntries);
  }

  // --- New Methods for Weekly/Today Calculations ---

  private getCurrentWeekBoundaries(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday, end: sunday };
  }

  private calculateWeeklySummary(entries: TimeEntry[]): void {
    const { start, end } = this.getCurrentWeekBoundaries();

    // Filtrar entradas de la semana actual
    const weekEntries = entries.filter(e =>
      e.startTime >= start.getTime() && e.startTime <= end.getTime()
    );

    // Agrupar por día
    const dailyHoursMap = new Map<string, number>();
    weekEntries.forEach(entry => {
      const date = new Date(entry.startTime).toISOString().split('T')[0];
      const current = dailyHoursMap.get(date) || 0;
      dailyHoursMap.set(date, current + entry.duration);
    });

    // Calcular horas totales y horas extra
    let totalHoursMs = 0;
    let horasExtraMs = 0;
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

    dailyHoursMap.forEach(dailyMs => {
      totalHoursMs += dailyMs;
      if (dailyMs > EIGHT_HOURS_MS) {
        horasExtraMs += (dailyMs - EIGHT_HOURS_MS);
      }
    });

    // Calcular targetHours ajustado según días de vacaciones
    const holidaysInWeek = this.holidayDatesService.getWeekdayHolidaysInRange(start, end);
    const targetHours = 40 - (holidaysInWeek.length * 8);

    this._currentWeekSummary$$.next({
      hoursWorked: totalHoursMs / (1000 * 60 * 60),
      horasExtra: horasExtraMs / (1000 * 60 * 60),
      targetHours: targetHours,
      weekStart: start.toISOString().split('T')[0],
      weekEnd: end.toISOString().split('T')[0]
    });
  }

  private calculateTodaySummary(entries: TimeEntry[]): void {
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e =>
      new Date(e.startTime).toISOString().split('T')[0] === today
    );

    const totalMs = todayEntries.reduce((sum, e) => sum + e.duration, 0);

    this._todaySummary$$.next({/*  */
      date: today,
      totalDurationMs: totalMs
    });
  }

  public getEntriesGroupedByDay(): Observable<DayGroup[]> {
    return this.entries$.pipe(
      map(entries => {
        const grouped = new Map<string, TimeEntry[]>();

        entries.forEach(entry => {
          const date = new Date(entry.startTime).toISOString().split('T')[0];
          if (!grouped.has(date)) {
            grouped.set(date, []);
          }
          grouped.get(date)!.push(entry);
        });

        return Array.from(grouped.entries())
          .map(([date, dayEntries]) => ({
            date,
            entries: dayEntries.sort((a, b) => a.startTime - b.startTime),
            totalDurationMs: dayEntries.reduce((sum, e) => sum + e.duration, 0)
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
      })
    );
  }

  updateEntryTimes(id: string, startTime: number, endTime: number): boolean {
    if (endTime <= startTime) {
      return false;
    }

    const currentEntries = this._entries$$.getValue();
    const index = currentEntries.findIndex(e => e.id === id);

    if (index > -1) {
      const updatedEntries = [...currentEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        startTime,
        endTime,
        duration: endTime - startTime
      };
      this.saveEntries(updatedEntries);
      return true;
    }
    return false;
  }

  private calculateGlobalBalance(entries: TimeEntry[]): void {
    if (entries.length === 0) {
      this._globalBalance$$.next({ balanceHours: 0 });
      return;
    }

    // Encontrar la primera entrada (más antigua)
    const sortedEntries = [...entries].sort((a, b) => a.startTime - b.startTime);
    const firstEntry = sortedEntries[0];
    const firstDate = new Date(firstEntry.startTime);
    firstDate.setHours(0, 0, 0, 0);

    // Obtener la fecha de hoy
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Función helper para obtener el día de la semana (0=Dom, 1=Lun, ..., 6=Sab)
    const getDayOfWeek = (date: Date): number => date.getDay();

    // Función helper para verificar si un día es L-V
    const isWeekday = (dayOfWeek: number): boolean => dayOfWeek >= 1 && dayOfWeek <= 5;

    // Obtener días de vacaciones en el rango (solo L-V)
    const holidayDates = this.holidayDatesService.getWeekdayHolidaysInRange(firstDate, today);
    const holidaySet = new Set(holidayDates);

    // Contar días de L-V desde la primera entrada hasta hoy, excluyendo vacaciones
    let weekdayCount = 0;
    const currentDate = new Date(firstDate);

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (isWeekday(getDayOfWeek(currentDate)) && !holidaySet.has(dateStr)) {
        weekdayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calcular horas trabajadas en L-V y fin de semana
    let weekdayHours = 0;
    let weekendHours = 0;

    entries.forEach(entry => {
      const entryDate = new Date(entry.startTime);
      const dayOfWeek = getDayOfWeek(entryDate);
      const hours = entry.duration / (1000 * 60 * 60);

      if (isWeekday(dayOfWeek)) {
        weekdayHours += hours;
      } else {
        weekendHours += hours;
      }
    });

    // Calcular balance: (horas L-V) - (días L-V × 8) + horas fin de semana
    const expectedWeekdayHours = weekdayCount * 8;
    const balanceHours = (weekdayHours - expectedWeekdayHours) + weekendHours;

    this._globalBalance$$.next({ balanceHours });
  }
}