// src/app/pages/dashboard/dashboard.ts
import { Component, signal } from '@angular/core';

import { CompactTimerComponent } from '../../components/compact-timer/compact-timer';
import { QuickIntervalInputComponent } from '../../components/quick-interval-input/quick-interval-input';
import { DailySummaryComponent } from '../../components/daily-summary/daily-summary';
import { WeeklySummaryComponent } from '../../components/weekly-summary/weekly-summary';
import { CompactHolidayCalendarComponent } from '../../components/compact-holiday-calendar/compact-holiday-calendar';
import { WeeklyChartComponent } from '../../components/weekly-chart/weekly-chart';
import { PomodoroTimerComponent } from '../../components/pomodoro-timer/pomodoro-timer';
import { MarginConfigComponent } from '../../components/margin-config/margin-config';
import { LunchConfigComponent } from '../../components/lunch-config/lunch-config';
import { ReminderNotificationComponent } from '../../components/reminder-notification/reminder-notification';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CompactTimerComponent,
    QuickIntervalInputComponent,
    DailySummaryComponent,
    WeeklySummaryComponent,
    CompactHolidayCalendarComponent,
    WeeklyChartComponent,
    PomodoroTimerComponent,
    MarginConfigComponent,
    LunchConfigComponent,
    ReminderNotificationComponent
],
  template: `
    <div class="h-screen bg-slate-100 overflow-hidden p-4">
      <div class="h-full overflow-hidden">
        <div class="h-full grid grid-cols-5 grid-rows-4 gap-4">

          <!-- Col 1, Rows 1-4: Holiday Calendar -->
          <div class="col-span-1 row-span-4 h-full min-h-0">
            <app-compact-holiday-calendar />
          </div>

          <!-- Col 2, Rows 1-2: Timer / Add Interval (toggle) -->
          <div class="col-span-1 row-span-2 h-full min-h-0 relative">
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

          <!-- Col 3, Rows 1-2: Pomodoro -->
          <div class="col-span-1 row-span-2 h-full min-h-0">
            <app-pomodoro-timer />
          </div>

          <!-- Col 4, Rows 1-2: Daily Summary -->
          <div class="col-span-1 row-span-2 h-full min-h-0">
            <app-daily-summary />
          </div>

          <!-- Col 5, Rows 1-2: Weekly Summary -->
          <div class="col-span-1 row-span-2 h-full min-h-0">
            <app-weekly-summary />
          </div>

          <!-- Cols 2-5, Row 3: Weekly Chart -->
          <div class="col-span-4 h-full min-h-0">
            <app-weekly-chart />
          </div>

          <!-- Col 2, Row 4: Auto round -->
          <div class="col-span-1 h-full min-h-0">
            <app-margin-config />
          </div>

          <!-- Col 3, Row 4: Lunch break -->
          <div class="col-span-1 h-full min-h-0">
            <app-lunch-config />
          </div>

          <!-- Col 4, Row 4: Reminder -->
          <div class="col-span-1 h-full min-h-0">
            <app-reminder-notification />
          </div>

          <!-- Col 5, Row 4: empty -->
          <div class="col-span-1 h-full min-h-0"></div>

        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  showTimer = signal(true);
}
