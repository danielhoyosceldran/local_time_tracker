// src/app/components/daily-summary/daily-summary.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry';
import { formatDuration } from '../../utils/format';
import { DailySummary } from '../../models/time-entry.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-daily-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="navigateToIntervals()"
      class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 h-full flex flex-col cursor-pointer hover:shadow-md transition"
    >
      <div class="flex items-center gap-2 mb-3">
        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <h3 class="text-slate-900 font-semibold">Daily Progress</h3>
      </div>

      @if (todaySummary$ | async; as summary) {
        <div class="flex-1 flex flex-col justify-center">
          <div class="text-center mb-2">
            <div class="text-3xl font-bold text-blue-600">
              {{ formatDuration(summary.totalDurationMs) }}
            </div>
            <div class="text-sm text-slate-600">of 08:00:00</div>
          </div>

          <!-- Progress Bar -->
          <div class="w-full bg-blue-100 rounded-full h-2 overflow-hidden mb-1">
            <div
              class="bg-blue-600 h-full rounded-full transition-all"
              [style.width.%]="getProgress(summary.totalDurationMs)"
            ></div>
          </div>

          <div class="text-xs text-slate-600 text-center">
            Remaining: {{ formatDuration(getRemaining(summary.totalDurationMs)) }}
          </div>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-slate-500 text-sm">
          No entries today
        </div>
      }
    </div>
  `,
})
export class DailySummaryComponent {
  private timeEntryService = inject(TimeEntryService);
  private router = inject(Router);

  todaySummary$: Observable<DailySummary | null> = this.timeEntryService.todaySummary$;

  formatDuration = formatDuration;

  getProgress(ms: number): number {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    return Math.min((ms / EIGHT_HOURS_MS) * 100, 100);
  }

  getRemaining(ms: number): number {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    return Math.max(EIGHT_HOURS_MS - ms, 0);
  }

  navigateToIntervals(): void {
    this.router.navigate(['/intervals']);
  }
}
