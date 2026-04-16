// src/app/components/weekly-summary/weekly-summary.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry';
import { WeeklySummary, GlobalBalance } from '../../models/time-entry.model';
import { formatHoursToTime } from '../../utils/format';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-weekly-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="navigateToIntervals()"
      class="bg-white/80 backdrop-blur-xl border border-white rounded-2xl shadow-sm shadow-slate-200/50 p-4 h-full flex flex-col overflow-y-auto cursor-pointer active:scale-95 transition-all"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <h3 class="text-slate-800 font-bold text-sm">Weekly Progress</h3>
      </div>

      @if (weekSummary$ | async; as summary) {
        <!-- Hero number -->
        <div class="text-center my-1">
          <div class="text-4xl font-extrabold font-mono text-emerald-600 leading-none">
            {{ formatHoursToTime(summary.hoursWorked) }}
          </div>
          <div class="text-xs text-slate-500 mt-1">of {{ formatHoursToTime(summary.targetHours) }}</div>
        </div>

        <!-- Mini bar chart -->
        <div class="flex-1 flex flex-col justify-end mt-2">
          <div class="grid grid-cols-7 gap-1 items-end" style="height:48px;">
            @for (h of dailyHours(); track $index) {
              <div
                class="w-full bg-emerald-400 rounded-t-sm transition-all duration-500"
                [style.height.px]="getBarHeightPx(h)"
                style="min-height: 2px;"
              ></div>
            }
          </div>
          <div class="grid grid-cols-7 gap-1 mt-0.5">
            @for (d of dayLabels; track d) {
              <div class="text-[9px] text-slate-400 text-center font-mono">{{ d }}</div>
            }
          </div>
        </div>

        <div class="text-xs text-slate-500 text-center mt-1">
          Remaining: <span class="font-mono font-medium text-slate-700">{{ formatHoursToTime(summary.remainingHours) }}</span>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No entries this week
        </div>
      }

      <!-- Divider + Global Balance -->
      <div class="border-t border-slate-50 mt-2 pt-2 flex items-center justify-between">
        @if (globalBalance$ | async; as balance) {
          <span class="text-xs text-slate-500 font-medium">Total Balance</span>
          <div
            class="px-3 py-0.5 rounded-full text-xs font-bold font-mono"
            [class.bg-emerald-100]="balance.balanceHours >= 0"
            [class.text-emerald-700]="balance.balanceHours >= 0"
            [class.bg-rose-100]="balance.balanceHours < 0"
            [class.text-rose-700]="balance.balanceHours < 0"
          >
            {{ balance.balanceHours >= 0 ? '+' : '-' }}{{ formatHoursToTime(Math.abs(balance.balanceHours)) }}
          </div>
        }
      </div>
    </div>
  `,
})
export class WeeklySummaryComponent {
  private timeEntryService = inject(TimeEntryService);
  private router = inject(Router);

  weekSummary$: Observable<WeeklySummary> = this.timeEntryService.currentWeekSummary$;
  globalBalance$: Observable<GlobalBalance> = this.timeEntryService.globalBalance$;

  formatHoursToTime = formatHoursToTime;
  Math = Math;

  dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  dailyHours = signal<number[]>([0, 0, 0, 0, 0, 0, 0]);

  constructor() {
    this.timeEntryService.entries$.subscribe(entries => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const hours = [0, 0, 0, 0, 0, 0, 0];
      entries
        .filter((e: any) => e.startTime >= monday.getTime() && e.startTime <= sunday.getTime())
        .forEach((e: any) => {
          const dow = new Date(e.startTime).getDay();
          const idx = dow === 0 ? 6 : dow - 1;
          hours[idx] += e.duration / (1000 * 60 * 60);
        });
      this.dailyHours.set(hours);
    });
  }

  getBarHeight(hours: number): number {
    const max = Math.max(...this.dailyHours(), 8);
    return Math.min((hours / max) * 100, 100);
  }

  getBarHeightPx(hours: number): number {
    const max = Math.max(...this.dailyHours(), 8);
    return Math.min((hours / max) * 48, 48);
  }

  getProgress(worked: number, target: number): number {
    return Math.min((worked / target) * 100, 100);
  }

  navigateToIntervals(): void {
    this.router.navigate(['/intervals']);
  }
}
