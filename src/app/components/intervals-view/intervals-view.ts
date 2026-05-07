import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KENDO_DATETIMEPICKER } from '@progress/kendo-angular-dateinputs';
import { TimeEntryService } from '../../services/time-entry';
import { SettingsService } from '../../services/settings.service';
import { HolidayDatesService } from '../../services/holiday-dates.service';
import { DayGroup, TimeEntry } from '../../models/time-entry.model';
import { formatDuration, formatHoursToTime } from '../../utils/format';
import { Observable, combineLatest, map, take } from 'rxjs';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';

interface WeekGroup {
  weekKey: string;
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  days: DayGroup[];
  hoursWorked: number;
  targetHours: number;
}

@Component({
  selector: 'app-intervals-view',
  standalone: true,
  imports: [CommonModule, FormsModule, KENDO_DATETIMEPICKER, TranslatePipe],
  template: `
    <div class="h-full flex flex-col bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white overflow-hidden">
      <!-- Toolbar -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
        <div class="flex gap-1">
          <button
            (click)="expandAllWeeks()"
            class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
            [attr.title]="'intervals.expandAll' | t"
          >
            {{ 'intervals.expand' | t }}
          </button>
          <button
            (click)="collapseAll()"
            class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
            [attr.title]="'intervals.collapseAll' | t"
          >
            {{ 'intervals.collapse' | t }}
          </button>
        </div>
        <button
          (click)="downloadCSV()"
          class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition"
          [attr.title]="'intervals.exportCsv' | t"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </button>
      </div>

      <!-- Week groups -->
      <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-12">
        @if (weekGroups$ | async; as weeks) {
          @if (weeks.length === 0) {
            <div class="text-center text-slate-500 text-sm py-8">
              {{ 'intervals.noEntries' | t }}
            </div>
          } @else {
            @for (week of weeks; track week.weekKey) {
              <div>
                <!-- Week title -->
                <div class="flex items-end justify-between gap-2 px-1 pb-1.5 mb-1.5 border-b-2 border-emerald-200">
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-slate-900">
                      {{ 'intervals.weekLabel' | t }} {{ week.weekNumber }} · {{ week.year }}
                    </div>
                    <div class="text-[10px] text-slate-500">
                      {{ week.startDate | date:'mediumDate' }} – {{ week.endDate | date:'mediumDate' }}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-sm font-bold font-mono"
                         [class.text-emerald-600]="week.hoursWorked >= week.targetHours"
                         [class.text-indigo-600]="week.hoursWorked < week.targetHours">
                      {{ formatHoursToTime(week.hoursWorked) }}
                      <span class="text-slate-400 font-normal">/</span>
                      {{ formatHoursToTime(week.targetHours) }}
                    </div>
                    <div class="text-[10px] text-slate-500">
                      {{ week.days.length }} {{ week.days.length === 1 ? ('intervals.daySingular' | t) : ('intervals.dayPlural' | t) }}
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  @for (day of week.days; track day.date) {
                    <div class="bg-white rounded-md border border-slate-200 overflow-hidden">
                        <button
                          (click)="toggleDay(day.date)"
                          class="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition gap-2"
                        >
                          <div class="flex items-center gap-2 min-w-0 flex-1">
                            <svg
                              class="w-4 h-4 text-slate-400 transition-transform shrink-0"
                              [class.rotate-90]="expandedDays().has(day.date)"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                            <div class="min-w-0 text-left">
                              <div class="text-xs font-semibold text-slate-900 truncate">{{ day.date | date:'mediumDate' }}</div>
                              <div class="text-[10px] text-slate-500">{{ day.entries.length }} {{ day.entries.length === 1 ? ('intervals.intervalSingular' | t) : ('intervals.intervalPlural' | t) }}</div>
                            </div>
                          </div>
                          <div class="text-sm font-bold font-mono text-indigo-600 shrink-0">
                            {{ formatDuration(day.totalDurationMs) }}
                          </div>
                        </button>

                        @if (expandedDays().has(day.date)) {
                          <div class="border-t border-slate-100">
                            @for (entry of day.entries; track entry.id) {
                              <div class="px-3 py-2 border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
                                @if (editingEntry() === entry.id) {
                                  <div class="space-y-2">
                                    <input
                                      type="text"
                                      [ngModel]="editTitle()"
                                      (ngModelChange)="editTitle.set($event)"
                                      [placeholder]="'intervals.titlePlaceholder' | t"
                                      class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <textarea
                                      [ngModel]="editDescription()"
                                      (ngModelChange)="editDescription.set($event)"
                                      rows="2"
                                      [placeholder]="'intervals.descriptionPlaceholder' | t"
                                      class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                                    ></textarea>
                                    <div class="space-y-1">
                                      <kendo-datetimepicker
                                        [value]="editStart()"
                                        (valueChange)="editStart.set($event)"
                                        [format]="'dd/MM/yyyy HH:mm'"
                                        [fillMode]="'outline'"
                                      ></kendo-datetimepicker>
                                      <kendo-datetimepicker
                                        [value]="editEnd()"
                                        (valueChange)="editEnd.set($event)"
                                        [format]="'dd/MM/yyyy HH:mm'"
                                        [fillMode]="'outline'"
                                      ></kendo-datetimepicker>
                                    </div>
                                    <div class="flex justify-end gap-1">
                                      <button
                                        (click)="cancelEdit()"
                                        class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition"
                                      >
                                        {{ 'intervals.cancelBtn' | t }}
                                      </button>
                                      <button
                                        (click)="saveEdit(entry.id)"
                                        class="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                                      >
                                        {{ 'intervals.saveBtn' | t }}
                                      </button>
                                    </div>
                                  </div>
                                } @else {
                                  <div class="flex items-start justify-between gap-2">
                                    <div class="flex-1 min-w-0">
                                      <div class="text-xs font-semibold text-slate-900 truncate">
                                        {{ entry.title || ('intervals.noTitle' | t) }}
                                      </div>
                                      @if (entry.description) {
                                        <div class="text-[11px] text-slate-600 truncate">
                                          {{ entry.description }}
                                        </div>
                                      }
                                      <div class="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                        <span>{{ entry.startTime | date:'shortTime' }}</span>
                                        <span>→</span>
                                        <span>{{ entry.endTime | date:'shortTime' }}</span>
                                      </div>
                                    </div>
                                    <div class="flex flex-col items-end gap-1 shrink-0">
                                      <div class="text-xs font-bold font-mono text-slate-900">
                                        {{ formatDuration(entry.duration) }}
                                      </div>
                                      <div class="flex gap-0.5">
                                        <button
                                          (click)="startEdit(entry)"
                                          class="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
                                          [attr.title]="'intervals.editTitle' | t"
                                        >
                                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                          </svg>
                                        </button>
                                        <button
                                          (click)="deleteEntry(entry.id)"
                                          class="p-1 text-red-600 hover:bg-red-50 rounded transition"
                                          [attr.title]="'intervals.deleteTitle' | t"
                                        >
                                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
              </div>
            }
          }
        }
      </div>
    </div>
  `
})
export class IntervalsViewComponent {
  private timeEntryService = inject(TimeEntryService);
  private settings = inject(SettingsService);
  private holidayDatesService = inject(HolidayDatesService);
  private translation = inject(TranslationService);

  weekGroups$: Observable<WeekGroup[]> = combineLatest([
    this.timeEntryService.entries$,
    this.holidayDatesService.holidayDates$
  ]).pipe(
    map(([entries]) => this.buildWeekGroups(entries))
  );

  expandedWeeks = signal(new Set<string>());
  expandedDays = signal(new Set<string>());
  editingEntry = signal<string | null>(null);
  editTitle = signal<string | null>(null);
  editDescription = signal<string | null>(null);
  editStart = signal<Date | null>(null);
  editEnd = signal<Date | null>(null);

  formatDuration = formatDuration;
  formatHoursToTime = formatHoursToTime;

  constructor() {
    // Default: expand current week
    const currentKey = this.weekKeyFor(new Date());
    this.expandedWeeks.set(new Set([currentKey]));
  }

  private buildWeekGroups(entries: TimeEntry[]): WeekGroup[] {
    if (entries.length === 0) return [];

    // Group entries by day first
    const dayMap = new Map<string, TimeEntry[]>();
    entries.forEach(entry => {
      const dateKey = new Date(entry.startTime).toLocaleDateString('en-CA');
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey)!.push(entry);
    });

    // Group days by week
    const weekMap = new Map<string, { startDate: Date; endDate: Date; days: DayGroup[] }>();
    dayMap.forEach((dayEntries, dateKey) => {
      const refDate = new Date(dateKey + 'T12:00:00');
      const { start, end } = this.settings.getWeekBoundaries(refDate);
      const key = this.weekKeyFromDate(start);
      if (!weekMap.has(key)) {
        weekMap.set(key, { startDate: start, endDate: end, days: [] });
      }
      weekMap.get(key)!.days.push({
        date: dateKey,
        entries: dayEntries.sort((a, b) => a.startTime - b.startTime),
        totalDurationMs: dayEntries.reduce((sum, e) => sum + e.duration, 0)
      });
    });

    const workdayHours = this.settings.workdayHours();
    const weeklyTarget = this.settings.weeklyTargetHours();

    const groups: WeekGroup[] = [];
    weekMap.forEach((data, key) => {
      data.days.sort((a, b) => b.date.localeCompare(a.date));

      const hoursWorked = data.days.reduce((s, d) => s + d.totalDurationMs, 0) / (1000 * 60 * 60);
      const holidaysInWeek = this.holidayDatesService.getWeekdayHolidaysInRange(data.startDate, data.endDate);
      const targetHours = Math.max(0, weeklyTarget - holidaysInWeek.length * workdayHours);

      const { year, week } = this.isoWeek(data.startDate);
      groups.push({
        weekKey: key,
        weekNumber: week,
        year,
        startDate: data.startDate,
        endDate: data.endDate,
        days: data.days,
        hoursWorked,
        targetHours
      });
    });

    groups.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    return groups;
  }

  private weekKeyFor(date: Date): string {
    const { start } = this.settings.getWeekBoundaries(date);
    return this.weekKeyFromDate(start);
  }

  private weekKeyFromDate(start: Date): string {
    return start.toLocaleDateString('en-CA');
  }

  private isoWeek(d: Date): { year: number; week: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
    return { year: date.getUTCFullYear(), week };
  }

  toggleWeek(key: string): void {
    this.expandedWeeks.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  toggleDay(date: string): void {
    this.expandedDays.update(set => {
      const next = new Set(set);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  expandAllWeeks(): void {
    this.weekGroups$.pipe(take(1)).subscribe(groups => {
      this.expandedWeeks.set(new Set(groups.map(g => g.weekKey)));
    });
  }

  collapseAll(): void {
    this.expandedWeeks.set(new Set());
    this.expandedDays.set(new Set());
  }

  startEdit(entry: TimeEntry): void {
    this.editingEntry.set(entry.id);
    this.editTitle.set(entry.title);
    this.editDescription.set(entry.description);
    this.editStart.set(new Date(entry.startTime));
    this.editEnd.set(new Date(entry.endTime));
  }

  cancelEdit(): void {
    this.editingEntry.set(null);
  }

  saveEdit(id: string): void {
    const start = this.editStart();
    const end = this.editEnd();

    if (!start || !end) {
      alert(this.translation.t('intervals.fillTimes'));
      return;
    }

    const startTime = start.getTime();
    const endTime = end.getTime();

    if (endTime <= startTime) {
      alert(this.translation.t('intervals.endAfterStart'));
      return;
    }

    const title = this.editTitle()?.trim() || null;
    const description = this.editDescription()?.trim() || null;

    const timesOk = this.timeEntryService.updateEntryTimes(id, startTime, endTime);
    this.timeEntryService.updateEntry(id, title, description);

    if (timesOk) {
      this.editingEntry.set(null);
    } else {
      alert(this.translation.t('intervals.failedUpdate'));
    }
  }

  deleteEntry(id: string): void {
    if (confirm(this.translation.t('intervals.deleteConfirm'))) {
      this.timeEntryService.deleteEntry(id);
    }
  }

  downloadCSV(): void {
    this.timeEntryService.entries$.pipe(take(1)).subscribe(entries => {
      if (!entries.length) return;

      const dailyMap = new Map<string, number>();
      entries.forEach(e => {
        const date = new Date(e.startTime).toISOString().split('T')[0];
        const current = dailyMap.get(date) || 0;
        dailyMap.set(date, current + e.duration);
      });

      const dailyData = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

      const headers = ['Date', 'Day of Week', 'Hours Worked'];
      const rows = dailyData.map(([dateStr, durationMs]) => {
        const date = new Date(dateStr);
        const dayMonth = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        const hoursWorked = formatDuration(durationMs);

        return [dayMonth, dayOfWeek, hoursWorked];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'time_tracker_daily_summary.csv');
      link.style.visibility = 'hidden';

      setTimeout(() => {
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 0);
    });
  }
}
