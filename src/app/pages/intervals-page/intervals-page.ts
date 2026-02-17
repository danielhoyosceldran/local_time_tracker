// src/app/pages/intervals-page/intervals-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry';
import { DayGroup, TimeEntry, WeeklySummary } from '../../models/time-entry.model';
import { formatDuration, formatHoursToTime, toDatetimeLocal } from '../../utils/format';
import { Observable, take } from 'rxjs';

@Component({
  selector: 'app-intervals-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <button
              (click)="navigateBack()"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>

            <button
              (click)="downloadCSV()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Export CSV
            </button>
          </div>

          @if (weekSummary$ | async; as summary) {
            <div class="flex items-center justify-between text-sm">
              <div>
                <span class="text-slate-600">Week: </span>
                <span class="font-semibold text-slate-900">{{ summary.weekStart }} to {{ summary.weekEnd }}</span>
              </div>
              <div class="flex gap-4">
                <div>
                  <span class="text-slate-600">Total: </span>
                  <span class="font-bold text-indigo-600">{{ formatHoursToTime(summary.hoursWorked) }}</span>
                </div>
                @if (summary.horasExtra > 0) {
                  <div>
                    <span class="text-slate-600">Extra: </span>
                    <span class="font-bold text-green-600">+{{ formatHoursToTime(summary.horasExtra) }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Controls -->
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold text-slate-900">Time Intervals</h1>
          <div class="flex gap-2">
            <button
              (click)="expandAll()"
              class="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
            >
              Expand All
            </button>
            <button
              (click)="collapseAll()"
              class="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
            >
              Collapse All
            </button>
          </div>
        </div>

        <!-- Day Groups -->
        @if (dayGroups$ | async; as dayGroups) {
          @if (dayGroups.length === 0) {
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
              No time entries yet. Start tracking to see your intervals here!
            </div>
          } @else {
            <div class="space-y-4">
              @for (day of dayGroups; track day.date) {
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <!-- Day Header -->
                  <button
                    (click)="toggleDay(day.date)"
                    class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div class="flex items-center gap-4">
                      <svg
                        class="w-5 h-5 text-slate-400 transition-transform"
                        [class.rotate-90]="expandedDays.has(day.date)"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                      <div>
                        <h3 class="font-semibold text-slate-900">{{ day.date | date:'fullDate' }}</h3>
                        <p class="text-sm text-slate-500">{{ day.entries.length }} intervals</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-2xl font-bold text-indigo-600">
                        {{ formatDuration(day.totalDurationMs) }}
                      </div>
                    </div>
                  </button>

                  <!-- Day Entries -->
                  @if (expandedDays.has(day.date)) {
                    <div class="border-t border-slate-200">
                      @for (entry of day.entries; track entry.id) {
                        <div class="px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                          @if (editingEntry() === entry.id) {
                            <!-- Edit Mode -->
                            <div class="space-y-3">
                              <div>
                                <label class="block text-xs font-medium text-slate-600 mb-1">Title</label>
                                <input
                                  type="text"
                                  [(ngModel)]="editTitle"
                                  placeholder="No title"
                                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label class="block text-xs font-medium text-slate-600 mb-1">Description</label>
                                <textarea
                                  [(ngModel)]="editDescription"
                                  rows="2"
                                  placeholder="No description"
                                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                ></textarea>
                              </div>
                              <div class="grid grid-cols-2 gap-3">
                                <div>
                                  <label class="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                                  <input
                                    type="datetime-local"
                                    [(ngModel)]="editStart"
                                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  />
                                </div>
                                <div>
                                  <label class="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                                  <input
                                    type="datetime-local"
                                    [(ngModel)]="editEnd"
                                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  />
                                </div>
                              </div>
                              <div class="flex justify-end gap-2">
                                <button
                                  (click)="cancelEdit()"
                                  class="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  (click)="saveEdit(entry.id)"
                                  class="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          } @else {
                            <!-- View Mode -->
                            <div class="flex items-start justify-between">
                              <div class="flex-1">
                                <div class="font-semibold text-slate-900 mb-1">
                                  {{ entry.title || '(No title)' }}
                                </div>
                                @if (entry.description) {
                                  <div class="text-sm text-slate-600 mb-2">
                                    {{ entry.description }}
                                  </div>
                                }
                                <div class="flex items-center gap-4 text-xs text-slate-500">
                                  <span>{{ entry.startTime | date:'shortTime' }}</span>
                                  <span>→</span>
                                  <span>{{ entry.endTime | date:'shortTime' }}</span>
                                </div>
                              </div>
                              <div class="flex items-center gap-4 ml-4">
                                <div class="text-right">
                                  <div class="text-xl font-bold text-slate-900">
                                    {{ formatDuration(entry.duration) }}
                                  </div>
                                </div>
                                <div class="flex gap-2">
                                  <button
                                    (click)="startEdit(entry)"
                                    class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                    title="Edit"
                                  >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                  </button>
                                  <button
                                    (click)="deleteEntry(entry.id)"
                                    class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Delete"
                                  >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          }
        }
      </div>
    </div>
  `
})
export class IntervalsPageComponent {
  private router = inject(Router);
  private timeEntryService = inject(TimeEntryService);

  dayGroups$: Observable<DayGroup[]> = this.timeEntryService.getEntriesGroupedByDay();
  weekSummary$: Observable<WeeklySummary> = this.timeEntryService.currentWeekSummary$;

  expandedDays = new Set<string>();
  editingEntry = signal<string | null>(null);
  editTitle = signal<string | null>(null);
  editDescription = signal<string | null>(null);
  editStart = signal('');
  editEnd = signal('');

  formatDuration = formatDuration;
  formatHoursToTime = formatHoursToTime;

  toggleDay(date: string): void {
    if (this.expandedDays.has(date)) {
      this.expandedDays.delete(date);
    } else {
      this.expandedDays.add(date);
    }
  }

  expandAll(): void {
    this.dayGroups$.pipe(take(1)).subscribe(groups => {
      groups.forEach(group => this.expandedDays.add(group.date));
    });
  }

  collapseAll(): void {
    this.expandedDays.clear();
  }

  startEdit(entry: TimeEntry): void {
    this.editingEntry.set(entry.id);
    this.editTitle.set(entry.title);
    this.editDescription.set(entry.description);
    this.editStart.set(toDatetimeLocal(entry.startTime));
    this.editEnd.set(toDatetimeLocal(entry.endTime));
  }

  cancelEdit(): void {
    this.editingEntry.set(null);
  }

  saveEdit(id: string): void {
    const startTime = new Date(this.editStart()).getTime();
    const endTime = new Date(this.editEnd()).getTime();

    if (endTime <= startTime) {
      alert('End time must be after start time');
      return;
    }

    const title = this.editTitle()?.trim() || null;
    const description = this.editDescription()?.trim() || null;

    const timesOk = this.timeEntryService.updateEntryTimes(id, startTime, endTime);
    this.timeEntryService.updateEntry(id, title, description);

    if (timesOk) {
      this.editingEntry.set(null);
    } else {
      alert('Failed to update entry');
    }
  }

  deleteEntry(id: string): void {
    if (confirm('Are you sure you want to delete this entry?')) {
      this.timeEntryService.deleteEntry(id);
    }
  }

  downloadCSV(): void {
    this.timeEntryService.entries$.pipe(take(1)).subscribe(entries => {
      if (!entries.length) return;

      // Agrupar entradas por día
      const dailyMap = new Map<string, number>();
      entries.forEach(e => {
        const date = new Date(e.startTime).toISOString().split('T')[0];
        const current = dailyMap.get(date) || 0;
        dailyMap.set(date, current + e.duration);
      });

      // Convertir a array y ordenar por fecha (más antigua primero)
      const dailyData = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

      // Formatear datos
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

  navigateBack(): void {
    this.router.navigate(['/']);
  }
}
