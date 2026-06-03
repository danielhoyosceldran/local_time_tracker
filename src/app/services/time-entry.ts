// src/app/services/time-entry.service.ts
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest, interval, switchMap, map, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry, RunningTimeEntry, DailySummary, WeeklySummary, DayGroup, GlobalBalance } from '../models/time-entry.model';
import { take, tap } from 'rxjs';
import { HolidayDatesService } from './holiday-dates.service';
import { SettingsService } from './settings.service';

const STORAGE_KEY = 'timeTrackerEntries';
const RUNNING_KEY = 'timeTrackerRunningEntry';
const MARGIN_ENABLED_KEY = 'timeTrackerMarginEnabled';
const MARGIN_MINUTES_KEY = 'timeTrackerMarginMinutes';
const MARGIN_WINDOW_ENABLED_KEY = 'tt.marginWindowEnabled';
const MARGIN_WINDOW_START_KEY = 'tt.marginWindowStart';
const MARGIN_WINDOW_END_KEY = 'tt.marginWindowEnd';
const MARGIN_WINDOW_START_DEFAULT = '09:00';
const MARGIN_WINDOW_END_DEFAULT = '18:00';
const LUNCH_HOUR_KEY = 'timeTrackerLunchHour';
const LUNCH_DURATION_KEY = 'timeTrackerLunchDurationMin';
const LUNCH_ENABLED_KEY = 'timeTrackerLunchEnabled';

const KNOWN_STORAGE_KEYS = [
  STORAGE_KEY, RUNNING_KEY,
  MARGIN_ENABLED_KEY, MARGIN_MINUTES_KEY,
  MARGIN_WINDOW_ENABLED_KEY, MARGIN_WINDOW_START_KEY, MARGIN_WINDOW_END_KEY,
  LUNCH_HOUR_KEY, LUNCH_DURATION_KEY, LUNCH_ENABLED_KEY,
  'timeTrackerHolidays', 'timeTrackerHolidayDates', 'timeTrackerCalendarUrl',
  'timeTrackerReminderEnabled', 'timeTrackerReminderTime',
  'timeTrackerReminderMessage', 'timeTrackerReminderSound',
  'timeTrackerPomodoroWork', 'timeTrackerPomodoroBreak',
  'timeTrackerPomodoroSoundWork', 'timeTrackerPomodoroSoundBreak',
  'timeTrackerPomodoroState',
  'tt.workdayHours', 'tt.weeklyTargetHours', 'tt.workdays',
  'tt.firstDayOfWeek', 'tt.timeFormat',
  'tt.showExpectedLine', 'tt.truncateWorkedAtToday',
  'tt.companyStartDate', 'tt.tenureCelebrations',
  'tt.language', 'tt.themeMode',
];

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService implements OnDestroy {
  private holidayDatesService = inject(HolidayDatesService);
  private settings = inject(SettingsService);
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
    remainingHours: 40,
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
    map(([summary, runningMs]) => {
      const extraHours = runningMs / (1000 * 60 * 60);
      return {
        ...summary,
        hoursWorked: summary.hoursWorked + extraHours,
        remainingHours: Math.max(0, summary.remainingHours - extraHours)
      };
    })
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

    const getISODate = (timestamp: number): string =>
      new Date(timestamp).toLocaleDateString('en-CA');

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

  // When enabled, the margin only absorbs time worked inside this daily window;
  // work before the start or after the end is never truncated.
  private _marginWindowEnabled$$ = new BehaviorSubject<boolean>(
    localStorage.getItem(MARGIN_WINDOW_ENABLED_KEY) === 'true'
  );
  public readonly marginWindowEnabled$ = this._marginWindowEnabled$$.asObservable();

  private _marginWindowStart$$ = new BehaviorSubject<string>(
    localStorage.getItem(MARGIN_WINDOW_START_KEY) || MARGIN_WINDOW_START_DEFAULT
  );
  public readonly marginWindowStart$ = this._marginWindowStart$$.asObservable();

  private _marginWindowEnd$$ = new BehaviorSubject<string>(
    localStorage.getItem(MARGIN_WINDOW_END_KEY) || MARGIN_WINDOW_END_DEFAULT
  );
  public readonly marginWindowEnd$ = this._marginWindowEnd$$.asObservable();

  setMarginWindowEnabled(enabled: boolean): void {
    localStorage.setItem(MARGIN_WINDOW_ENABLED_KEY, String(enabled));
    this._marginWindowEnabled$$.next(enabled);
  }

  setMarginWindowStart(time: string): void {
    localStorage.setItem(MARGIN_WINDOW_START_KEY, time);
    this._marginWindowStart$$.next(time);
  }

  setMarginWindowEnd(time: string): void {
    localStorage.setItem(MARGIN_WINDOW_END_KEY, time);
    this._marginWindowEnd$$.next(time);
  }

  /** Milliseconds of [startTs, endTs] that fall inside the configured daily
   *  window (evaluated on the interval's start day). Falls back to the full
   *  interval if the window is misconfigured (end <= start). */
  private windowOverlapMs(startTs: number, endTs: number): number {
    if (endTs <= startTs) return 0;
    const [sh, sm] = (this._marginWindowStart$$.getValue() || MARGIN_WINDOW_START_DEFAULT).split(':').map(Number);
    const [eh, em] = (this._marginWindowEnd$$.getValue() || MARGIN_WINDOW_END_DEFAULT).split(':').map(Number);
    const winStart = new Date(startTs); winStart.setHours(sh, sm, 0, 0);
    const winEnd = new Date(startTs); winEnd.setHours(eh, em, 0, 0);
    const ws = winStart.getTime();
    const we = winEnd.getTime();
    if (we <= ws) return endTs - startTs;
    return Math.max(0, Math.min(endTs, we) - Math.max(startTs, ws));
  }

  // --- Lunch Config ---
  private _lunchEnabled$$ = new BehaviorSubject<boolean>(
    localStorage.getItem(LUNCH_ENABLED_KEY) !== 'false'
  );
  public readonly lunchEnabled$ = this._lunchEnabled$$.asObservable();

  private _lunchHour$$ = new BehaviorSubject<string>(
    localStorage.getItem(LUNCH_HOUR_KEY) || '14:00'
  );
  public readonly lunchHour$ = this._lunchHour$$.asObservable();

  private _lunchDurationMin$$ = new BehaviorSubject<number>(
    parseInt(localStorage.getItem(LUNCH_DURATION_KEY) || '60', 10)
  );
  public readonly lunchDurationMin$ = this._lunchDurationMin$$.asObservable();

  setLunchEnabled(enabled: boolean): void {
    localStorage.setItem(LUNCH_ENABLED_KEY, String(enabled));
    this._lunchEnabled$$.next(enabled);
  }

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
      const workdayMs = this.settings.workdayMs();
      const today = new Date().toLocaleDateString('en-CA');
      const windowed = this._marginWindowEnabled$$.getValue();

      const todayEntries = this._entries$$.getValue()
        .filter(e => new Date(e.startTime).toLocaleDateString('en-CA') === today);

      // When the window is on, only time inside the window participates in the
      // margin. Work before/after the window is left untouched (counted in full).
      const measure = windowed
        ? (start: number, end: number) => this.windowOverlapMs(start, end)
        : (start: number, end: number) => end - start;

      const todayCompletedMs = todayEntries
        .reduce((sum, e) => sum + measure(e.startTime, e.endTime), 0);
      const currentRelevantMs = measure(runningEntry.startTime, endTime);

      const totalMs = todayCompletedMs + currentRelevantMs;
      const diff = totalMs - workdayMs;

      if (Math.abs(diff) <= marginMs) {
        // Trim/extend the running session by the surplus/deficit. The adjusted
        // tail sits inside the window (that is when the margin can trigger), so
        // out-of-window time stays intact.
        const adjusted = duration - diff;
        if (adjusted > 0) {
          duration = adjusted;
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
    return this.settings.getWeekBoundaries(new Date());
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
      const date = new Date(entry.startTime).toLocaleDateString('en-CA');
      const current = dailyHoursMap.get(date) || 0;
      dailyHoursMap.set(date, current + entry.duration);
    });

    // Calcular horas totales y horas extra
    let totalHoursMs = 0;
    let horasExtraMs = 0;
    const workdayMs = this.settings.workdayMs();
    const workdayHours = this.settings.workdayHours();

    dailyHoursMap.forEach(dailyMs => {
      totalHoursMs += dailyMs;
      if (dailyMs > workdayMs) {
        horasExtraMs += (dailyMs - workdayMs);
      }
    });

    // Calcular targetHours ajustado según días de vacaciones
    const holidaysInWeek = this.holidayDatesService.getWeekdayHolidaysInRange(start, end);
    const targetHours = this.settings.weeklyTargetHours() - (holidaysInWeek.length * workdayHours);

    // Calcular horas pendientes: solo días laborables desde hoy hasta fin de semana
    const toLocalDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const holidaysSet = new Set(holidaysInWeek);
    const isWorkday = this.settings.isWorkday();
    let remainingWorkingDays = 0;
    const dayIter = new Date(todayStart);
    while (dayIter <= end) {
      const dow = dayIter.getDay();
      if (isWorkday(dow) && !holidaysSet.has(toLocalDateStr(dayIter))) {
        remainingWorkingDays++;
      }
      dayIter.setDate(dayIter.getDate() + 1);
    }

    const hoursWorkedFromTodayMs = weekEntries
      .filter(e => e.startTime >= todayStart.getTime())
      .reduce((sum, e) => sum + e.duration, 0);

    const remainingHours = Math.max(0, remainingWorkingDays * workdayHours - hoursWorkedFromTodayMs / (1000 * 60 * 60));

    this._currentWeekSummary$$.next({
      hoursWorked: totalHoursMs / (1000 * 60 * 60),
      horasExtra: horasExtraMs / (1000 * 60 * 60),
      targetHours: targetHours,
      remainingHours: remainingHours,
      weekStart: start.toLocaleDateString('en-CA'),
      weekEnd: end.toLocaleDateString('en-CA')
    });
  }

  private calculateTodaySummary(entries: TimeEntry[]): void {
    const today = new Date().toLocaleDateString('en-CA');
    const todayEntries = entries.filter(e =>
      new Date(e.startTime).toLocaleDateString('en-CA') === today
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
          const date = new Date(entry.startTime).toLocaleDateString('en-CA');
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

    // Helper: obtiene fecha local como string YYYY-MM-DD usando la timezone del navegador
    const toLocalDateStr = (ts: number): string =>
      new Date(ts).toLocaleDateString('en-CA'); // en-CA produce formato YYYY-MM-DD

    // Helper: obtiene el día de la semana (0=Dom, 1=Lun, ..., 6=Sab) en timezone local
    const getLocalDayOfWeek = (ts: number): number => new Date(ts).getDay();

    // Verificar si un día es laborable según la configuración del usuario
    const isWeekday = this.settings.isWorkday();

    // Encontrar la primera entrada (más antigua)
    const sortedEntries = [...entries].sort((a, b) => a.startTime - b.startTime);
    const firstEntry = sortedEntries[0];

    // Fecha de inicio: medianoche local del día de la primera entrada
    const firstDateStr = toLocalDateStr(firstEntry.startTime);
    const firstDate = new Date(firstDateStr + 'T00:00:00');

    // Fecha de hoy: fin del día local
    const todayStr = toLocalDateStr(Date.now());
    const today = new Date(todayStr + 'T23:59:59');

    // Obtener días de vacaciones en el rango (solo L-V)
    const holidayDates = this.holidayDatesService.getWeekdayHolidaysInRange(firstDate, today);
    const holidaySet = new Set(holidayDates);

    // Contar días de L-V desde la primera entrada hasta hoy, excluyendo vacaciones
    let weekdayCount = 0;
    const currentDate = new Date(firstDate);

    while (currentDate <= today) {
      const dateStr = toLocalDateStr(currentDate.getTime());
      if (isWeekday(currentDate.getDay()) && !holidaySet.has(dateStr)) {
        weekdayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calcular horas trabajadas en L-V y fin de semana
    let weekdayHours = 0;
    let weekendHours = 0;

    entries.forEach(entry => {
      const dayOfWeek = getLocalDayOfWeek(entry.startTime);
      const hours = entry.duration / (1000 * 60 * 60);

      if (isWeekday(dayOfWeek)) {
        weekdayHours += hours;
      } else {
        weekendHours += hours;
      }
    });

    // Calcular balance: (horas L-V) - (días L-V × workday hours) + horas fin de semana
    const expectedWeekdayHours = weekdayCount * this.settings.workdayHours();
    const balanceHours = (weekdayHours - expectedWeekdayHours) + weekendHours;

    this._globalBalance$$.next({ balanceHours });
  }

  /** Reload in-memory state from localStorage (used after import/reset). */
  reloadFromStorage(): void {
    this._entries$$.next(this.loadEntries());
    this._runningEntry$$.next(this.loadRunningEntry());
    this._marginEnabled$$.next(localStorage.getItem(MARGIN_ENABLED_KEY) === 'true');
    this._marginMinutes$$.next(parseInt(localStorage.getItem(MARGIN_MINUTES_KEY) || '10', 10));
    this._marginWindowEnabled$$.next(localStorage.getItem(MARGIN_WINDOW_ENABLED_KEY) === 'true');
    this._marginWindowStart$$.next(localStorage.getItem(MARGIN_WINDOW_START_KEY) || MARGIN_WINDOW_START_DEFAULT);
    this._marginWindowEnd$$.next(localStorage.getItem(MARGIN_WINDOW_END_KEY) || MARGIN_WINDOW_END_DEFAULT);
    this._lunchEnabled$$.next(localStorage.getItem(LUNCH_ENABLED_KEY) !== 'false');
    this._lunchHour$$.next(localStorage.getItem(LUNCH_HOUR_KEY) || '14:00');
    this._lunchDurationMin$$.next(parseInt(localStorage.getItem(LUNCH_DURATION_KEY) || '60', 10));
    this.recomputeAll();
  }

  /** Re-run all derived summaries; used after settings change. */
  recomputeAll(): void {
    const entries = this._entries$$.getValue();
    this.calculateDailySummary(entries);
    this.calculateWeeklySummary(entries);
    this.calculateTodaySummary(entries);
    this.calculateGlobalBalance(entries);
  }

  // --- Data management ---

  exportAll(): string {
    const data: Record<string, string | null> = {};
    for (const key of KNOWN_STORAGE_KEYS) {
      data[key] = localStorage.getItem(key);
    }
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  importAll(json: string): void {
    const parsed = JSON.parse(json);
    const data = parsed?.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid file shape');
    }
    for (const key of KNOWN_STORAGE_KEYS) {
      if (key in data) {
        const value = data[key];
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      }
    }
  }

  resetAll(): void {
    for (const key of KNOWN_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }
}