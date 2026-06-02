// src/app/pages/dashboard/dashboard.ts
import { Component, inject, signal } from '@angular/core';

import { CompactTimerComponent } from '../../components/compact-timer/compact-timer';
import { QuickIntervalInputComponent } from '../../components/quick-interval-input/quick-interval-input';
import { DailySummaryComponent } from '../../components/daily-summary/daily-summary';
import { WeeklySummaryComponent } from '../../components/weekly-summary/weekly-summary';
import { CompactHolidayCalendarComponent } from '../../components/compact-holiday-calendar/compact-holiday-calendar';
import { MonthlyChartComponent } from '../../components/monthly-chart/monthly-chart';
import { DashboardNavComponent } from '../../components/dashboard-nav/dashboard-nav';
import { PomodoroTimerComponent } from '../../components/pomodoro-timer/pomodoro-timer';
import { ReminderNotificationComponent } from '../../components/reminder-notification/reminder-notification';
import { IntervalsViewComponent } from '../../components/intervals-view/intervals-view';
import { CompanyTenureComponent } from '../../components/company-tenure/company-tenure';
import { ViewStateService } from '../../services/view-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CompactTimerComponent,
    QuickIntervalInputComponent,
    DailySummaryComponent,
    WeeklySummaryComponent,
    CompactHolidayCalendarComponent,
    MonthlyChartComponent,
    DashboardNavComponent,
    PomodoroTimerComponent,
    ReminderNotificationComponent,
    IntervalsViewComponent,
    CompanyTenureComponent,
  ],
  template: `
    <div class="min-h-screen xl:h-screen bg-slate-100 xl:overflow-hidden p-4">
      <div class="xl:h-full xl:overflow-hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 xl:h-full xl:grid-rows-[2rem_1fr_1fr_1fr_1fr]">

          <!-- Nav: full width at every breakpoint -->
          <div class="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5 min-h-[2.5rem] xl:min-h-0 xl:h-full">
            <app-dashboard-nav />
          </div>

          <!-- Timer / Quick-interval (toggle) -->
          <div class="min-h-[280px] xl:min-h-0 xl:h-full xl:row-span-2 xl:col-start-2 xl:row-start-2 relative">
            <button
              (click)="showTimer.set(!showTimer())"
              class="absolute top-2 right-2 z-10 p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              [title]="showTimer() ? 'Switch to Add Interval' : 'Switch to Timer'"
            >
              @if (showTimer()) {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
            </button>
            @if (showTimer()) {
              <app-compact-timer class="h-full" />
            } @else {
              <app-quick-interval-input class="h-full" />
            }
          </div>

          <!-- Daily Summary -->
          <div class="min-h-[280px] xl:min-h-0 xl:h-full xl:row-span-2 xl:col-start-4 xl:row-start-2">
            <app-daily-summary />
          </div>

          <!-- Calendar / Intervals (tabs in nav) -->
          <div class="min-h-[320px] xl:min-h-0 xl:h-full xl:row-span-4 xl:col-start-1 xl:row-start-2">
            @if (viewState.activeTab() === 'calendar') {
              <app-compact-holiday-calendar />
            } @else {
              <app-intervals-view />
            }
          </div>

          <!-- Weekly Summary -->
          <div class="min-h-[280px] xl:min-h-0 xl:h-full xl:row-span-2 xl:col-start-5 xl:row-start-2">
            <app-weekly-summary />
          </div>

          <!-- Pomodoro -->
          <div class="min-h-[280px] xl:min-h-0 xl:h-full xl:row-span-2 xl:col-start-3 xl:row-start-2">
            <app-pomodoro-timer />
          </div>

          <!-- Monthly Chart: wide -->
          <div class="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 min-h-[300px] xl:min-h-0 xl:h-full xl:col-span-4 xl:col-start-2 xl:row-start-4">
            <app-monthly-chart />
          </div>

          <!-- Reminder -->
          <div class="min-h-[200px] xl:min-h-0 xl:h-full xl:col-start-2 xl:row-start-5">
            <app-reminder-notification />
          </div>

          <!-- Company tenure -->
          <div class="min-h-[200px] xl:min-h-0 xl:h-full xl:col-start-3 xl:row-start-5">
            <app-company-tenure />
          </div>

        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  showTimer = signal(true);
  viewState = inject(ViewStateService);
}
