import { Injectable, computed, signal } from '@angular/core';

export type TimeFormat = '12h' | '24h';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

const KEYS = {
  workdayHours: 'tt.workdayHours',
  weeklyTargetHours: 'tt.weeklyTargetHours',
  workdays: 'tt.workdays',
  firstDayOfWeek: 'tt.firstDayOfWeek',
  timeFormat: 'tt.timeFormat',
  showExpectedLine: 'tt.showExpectedLine',
  truncateWorkedAtToday: 'tt.truncateWorkedAtToday',
} as const;

const DEFAULTS = {
  workdayHours: 8,
  weeklyTargetHours: 40,
  workdays: [1, 2, 3, 4, 5] as DayOfWeek[],
  firstDayOfWeek: 1 as DayOfWeek,
  timeFormat: '24h' as TimeFormat,
  showExpectedLine: true,
  truncateWorkedAtToday: true,
};

function loadNumber(key: string, def: number): number {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function loadString(key: string, def: string): string {
  return localStorage.getItem(key) ?? def;
}

function loadJSON<T>(key: string, def: T): T {
  const v = localStorage.getItem(key);
  if (!v) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly workdayHours = signal(loadNumber(KEYS.workdayHours, DEFAULTS.workdayHours));
  readonly weeklyTargetHours = signal(loadNumber(KEYS.weeklyTargetHours, DEFAULTS.weeklyTargetHours));
  readonly workdays = signal<DayOfWeek[]>(
    loadJSON<DayOfWeek[]>(KEYS.workdays, DEFAULTS.workdays)
  );
  readonly firstDayOfWeek = signal<DayOfWeek>(
    loadNumber(KEYS.firstDayOfWeek, DEFAULTS.firstDayOfWeek) as DayOfWeek
  );
  readonly timeFormat = signal<TimeFormat>(
    loadString(KEYS.timeFormat, DEFAULTS.timeFormat) as TimeFormat
  );
  readonly showExpectedLine = signal<boolean>(
    loadString(KEYS.showExpectedLine, String(DEFAULTS.showExpectedLine)) === 'true'
  );
  readonly truncateWorkedAtToday = signal<boolean>(
    loadString(KEYS.truncateWorkedAtToday, String(DEFAULTS.truncateWorkedAtToday)) === 'true'
  );

  readonly workdayMs = computed(() => this.workdayHours() * 60 * 60 * 1000);
  readonly isWorkday = computed(() => {
    const set = new Set(this.workdays());
    return (dayOfWeek: number): boolean => set.has(dayOfWeek as DayOfWeek);
  });

  setWorkdayHours(hours: number): void {
    const clamped = Math.max(0.5, Math.min(24, hours));
    this.workdayHours.set(clamped);
    localStorage.setItem(KEYS.workdayHours, String(clamped));
  }

  setWeeklyTargetHours(hours: number): void {
    const clamped = Math.max(0, Math.min(168, hours));
    this.weeklyTargetHours.set(clamped);
    localStorage.setItem(KEYS.weeklyTargetHours, String(clamped));
  }

  setWorkdays(days: DayOfWeek[]): void {
    const uniq = Array.from(new Set(days)).sort((a, b) => a - b) as DayOfWeek[];
    this.workdays.set(uniq);
    localStorage.setItem(KEYS.workdays, JSON.stringify(uniq));
  }

  toggleWorkday(day: DayOfWeek): void {
    const current = this.workdays();
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    this.setWorkdays(next as DayOfWeek[]);
  }

  setFirstDayOfWeek(day: DayOfWeek): void {
    this.firstDayOfWeek.set(day);
    localStorage.setItem(KEYS.firstDayOfWeek, String(day));
  }

  setTimeFormat(format: TimeFormat): void {
    this.timeFormat.set(format);
    localStorage.setItem(KEYS.timeFormat, format);
  }

  setShowExpectedLine(value: boolean): void {
    this.showExpectedLine.set(value);
    localStorage.setItem(KEYS.showExpectedLine, String(value));
  }

  setTruncateWorkedAtToday(value: boolean): void {
    this.truncateWorkedAtToday.set(value);
    localStorage.setItem(KEYS.truncateWorkedAtToday, String(value));
  }

  reloadFromStorage(): void {
    this.workdayHours.set(loadNumber(KEYS.workdayHours, DEFAULTS.workdayHours));
    this.weeklyTargetHours.set(loadNumber(KEYS.weeklyTargetHours, DEFAULTS.weeklyTargetHours));
    this.workdays.set(loadJSON<DayOfWeek[]>(KEYS.workdays, DEFAULTS.workdays));
    this.firstDayOfWeek.set(loadNumber(KEYS.firstDayOfWeek, DEFAULTS.firstDayOfWeek) as DayOfWeek);
    this.timeFormat.set(loadString(KEYS.timeFormat, DEFAULTS.timeFormat) as TimeFormat);
    this.showExpectedLine.set(loadString(KEYS.showExpectedLine, String(DEFAULTS.showExpectedLine)) === 'true');
    this.truncateWorkedAtToday.set(loadString(KEYS.truncateWorkedAtToday, String(DEFAULTS.truncateWorkedAtToday)) === 'true');
  }

  resetDefaults(): void {
    this.setWorkdayHours(DEFAULTS.workdayHours);
    this.setWeeklyTargetHours(DEFAULTS.weeklyTargetHours);
    this.setWorkdays(DEFAULTS.workdays);
    this.setFirstDayOfWeek(DEFAULTS.firstDayOfWeek);
    this.setTimeFormat(DEFAULTS.timeFormat);
    this.setShowExpectedLine(DEFAULTS.showExpectedLine);
    this.setTruncateWorkedAtToday(DEFAULTS.truncateWorkedAtToday);
  }

  /** Compute week boundaries (start/end) respecting firstDayOfWeek. */
  getWeekBoundaries(ref: Date = new Date()): { start: Date; end: Date } {
    const first = this.firstDayOfWeek();
    const dow = ref.getDay();
    const diffToStart = (dow - first + 7) % 7;
    const start = new Date(ref);
    start.setDate(ref.getDate() - diffToStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
}
