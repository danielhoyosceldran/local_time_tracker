// src/app/components/weekly-summary/weekly-summary.ts
import { Component, inject } from '@angular/core';
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
      class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 h-full flex flex-col cursor-pointer hover:shadow-md transition"
    >
      <!-- 2/3 Superior: Weekly Progress -->
      <div class="flex-[2] flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <h3 class="text-slate-900 font-semibold">Weekly Progress</h3>
          </div>
        </div>

        @if (weekSummary$ | async; as summary) {
          <div class="flex-1 flex flex-col justify-center">
            <div class="text-center mb-2">
              <div class="text-3xl font-bold text-green-600">
                {{ formatHoursToTime(summary.hoursWorked) }}
              </div>
              <div class="text-sm text-slate-600">of {{ formatHoursToTime(summary.targetHours) }}</div>
            </div>

            <!-- Progress Bar -->
            <div class="w-full bg-green-100 rounded-full h-2 overflow-hidden mb-1">
              <div
                class="bg-green-600 h-full rounded-full transition-all"
                [style.width.%]="getProgress(summary.hoursWorked, summary.targetHours)"
              ></div>
            </div>

            <div class="text-xs text-slate-600 text-center">
              Remaining: {{ formatHoursToTime(getRemaining(summary.hoursWorked, summary.targetHours)) }}
            </div>
          </div>
        } @else {
          <div class="flex-1 flex items-center justify-center text-slate-500 text-sm">
            No entries this week
          </div>
        }
      </div>  
      
      <!-- Divider -->
      <div class="border-t border-green-200 my-2"></div>
  
      <!-- 1/3 Inferior: Global Balance -->
      <div class="flex-1 flex items-center justify-between">
        @if (globalBalance$ | async; as balance) {
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path>
            </svg>
            <span class="text-xs text-slate-600 font-medium">Total Balance</span>
          </div>
          <div
            class="px-3 py-1 rounded-full text-sm font-bold"
            [class.bg-green-100]="balance.balanceHours >= 0"
            [class.text-green-700]="balance.balanceHours >= 0"
            [class.bg-red-100]="balance.balanceHours < 0"
            [class.text-red-700]="balance.balanceHours < 0"
          >
            {{ balance.balanceHours >= 0 ? '+ ' : '- ' }}{{ formatHoursToTime(Math.abs(balance.balanceHours)) }}
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

  getProgress(worked: number, target: number): number {
    return Math.min((worked / target) * 100, 100);
  }

  getRemaining(worked: number, target: number): number {
    return Math.max(target - worked, 0);
  }

  navigateToIntervals(): void {
    this.router.navigate(['/intervals']);
  }
}
