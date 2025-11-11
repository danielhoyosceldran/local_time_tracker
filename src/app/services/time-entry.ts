// src/app/services/time-entry.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval, switchMap, map, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry, RunningTimeEntry, DailySummary } from '../models/time-entry.model';
import { take, tap } from 'rxjs'; // Afegir tap si no el tens

const STORAGE_KEY = 'timeTrackerEntries';
const RUNNING_KEY = 'timeTrackerRunningEntry';

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService implements OnDestroy {
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

  constructor() {
    // Basic cleanup check for running entry on startup
    const running = this._runningEntry$$.getValue();
    if (running && running.startTime > Date.now()) {
      console.warn("Detected invalid running entry (startTime in future). Stopping it.");
      this.stopTracking();
    }

    this._entries$$.pipe(
      // Executa la lògica de càlcul cada vegada que l'historial canvia
      tap(entries => this.calculateDailySummary(entries))
    ).subscribe();
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

    const now = Date.now();
    const duration = now - runningEntry.startTime;

    const completedEntry: TimeEntry = {
      ...runningEntry,
      endTime: now,
      duration: duration,
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
}