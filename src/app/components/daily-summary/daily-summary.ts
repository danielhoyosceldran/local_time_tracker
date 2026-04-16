// src/app/components/daily-summary/daily-summary.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry';
import { formatDuration } from '../../utils/format';
import { DailySummary } from '../../models/time-entry.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-daily-summary',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div
      (click)="navigateToIntervals()"
      class="bg-white/80 backdrop-blur-xl border border-white rounded-2xl shadow-sm shadow-slate-200/50 p-4 h-full flex flex-col overflow-hidden cursor-pointer active:scale-95 transition-all relative"
    >
      <!-- Water tank background layer -->
      @if (todaySummary$ | async; as summary) {
        <div
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/20 to-indigo-500/30 rounded-b-2xl transition-all duration-700"
          [style.height.%]="getProgress(summary.totalDurationMs)"
        >
          <!-- Water surface shimmer -->
          <div class="absolute top-0 left-0 right-0 h-1 bg-white/40 blur-sm animate-pulse"></div>
        </div>
      }

      <!-- Content (above water) -->
      <div class="relative z-10 flex flex-col h-full">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <h3 class="text-slate-800 font-bold text-sm">Daily Progress</h3>
        </div>

        @if (todaySummary$ | async; as summary) {
          <div class="flex-1 flex flex-col justify-center">
            <div class="text-center mb-1">
              <div class="text-4xl font-extrabold font-mono text-indigo-600 leading-none">
                {{ formatDuration(summary.totalDurationMs) }}
              </div>
              <div class="text-xs text-slate-500 mt-1">of 08:00:00</div>
            </div>

            <div class="text-center mt-3">
              <span class="text-lg font-mono font-bold text-indigo-400">
                {{ getProgress(summary.totalDurationMs) | number:'1.0-0' }}%
              </span>
            </div>

            <div class="text-xs text-slate-500 text-center mt-2">
              Remaining: <span class="font-mono font-medium text-slate-700">{{ formatDuration(getRemaining(summary.totalDurationMs)) }}</span>
            </div>

            @if (getRemaining(summary.totalDurationMs) > 0) {
              <div class="text-xs text-indigo-500 font-medium text-center mt-1">
                Est. finish: <span class="font-mono">{{ getExpectedEndTime(getRemaining(summary.totalDurationMs)) }}</span>
              </div>
            } @else {
              <div class="text-xs text-emerald-600 font-bold text-center mt-1">
                Daily target reached!
              </div>
            }
          </div>
        } @else {
          <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
            No entries today
          </div>
        }
      </div>
    </div>
  `,
})
export class DailySummaryComponent {
  private timeEntryService = inject(TimeEntryService);
  private router = inject(Router);

  todaySummary$: Observable<DailySummary | null> = this.timeEntryService.liveTodaySummary$;

  private lunchEnabled = signal(true);
  private lunchHour = signal('14:00');
  private lunchDurationMin = signal(60);

  constructor() {
    this.timeEntryService.lunchEnabled$.subscribe(v => this.lunchEnabled.set(v));
    this.timeEntryService.lunchHour$.subscribe(v => this.lunchHour.set(v));
    this.timeEntryService.lunchDurationMin$.subscribe(v => this.lunchDurationMin.set(v));
  }

  formatDuration = formatDuration;

  getProgress(ms: number): number {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    return Math.min((ms / EIGHT_HOURS_MS) * 100, 100);
  }

  getRemaining(ms: number): number {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    return Math.max(EIGHT_HOURS_MS - ms, 0);
  }

  getExpectedEndTime(remainingMs: number): string {
    let totalRemainingMs = remainingMs;

    // If lunch hour hasn't passed yet, add lunch duration
    const now = new Date();
    const [lh, lm] = this.lunchHour().split(':').map(Number);
    const lunchTime = new Date();
    lunchTime.setHours(lh, lm, 0, 0);

    if (this.lunchEnabled() && now < lunchTime) {
      totalRemainingMs += this.lunchDurationMin() * 60 * 1000;
    }

    const end = new Date(Date.now() + totalRemainingMs);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  navigateToIntervals(): void {
    this.router.navigate(['/intervals']);
  }
}
