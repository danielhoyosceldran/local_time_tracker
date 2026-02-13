// src/app/pages/dashboard/dashboard.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgendaCalendarComponent } from '../../components/agenda-calendar/agenda-calendar';
import { CompactTimerComponent } from '../../components/compact-timer/compact-timer';
import { QuickIntervalInputComponent } from '../../components/quick-interval-input/quick-interval-input';
import { DailySummaryComponent } from '../../components/daily-summary/daily-summary';
import { WeeklySummaryComponent } from '../../components/weekly-summary/weekly-summary';
import { CompactHolidayCounterComponent } from '../../components/compact-holiday-counter/compact-holiday-counter';
import { CompactHolidayCalendarComponent } from '../../components/compact-holiday-calendar/compact-holiday-calendar';
import { WeeklyChartComponent } from '../../components/weekly-chart/weekly-chart';
import { PomodoroTimerComponent } from '../../components/pomodoro-timer/pomodoro-timer';
import { MarginConfigComponent } from '../../components/margin-config/margin-config';
import { LunchConfigComponent } from '../../components/lunch-config/lunch-config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AgendaCalendarComponent,
    CompactTimerComponent,
    QuickIntervalInputComponent,
    DailySummaryComponent,
    WeeklySummaryComponent,
    CompactHolidayCounterComponent,
    CompactHolidayCalendarComponent,
    WeeklyChartComponent,
    PomodoroTimerComponent,
    MarginConfigComponent,
    LunchConfigComponent
  ],
  template: `
    <div class="h-screen bg-slate-50 flex overflow-hidden">
      <!-- Sidebar Fixed -->
      <app-agenda-calendar
        class="w-96 shrink-0 h-full"
      />

      <!-- Dashboard Grid -->
      <div class="flex-1 p-4 overflow-hidden">
        <div class="h-full grid grid-cols-4 grid-rows-4 gap-4">
          <!-- Timer: 2 cols, 2 rows -->
          <div class="col-span-2 row-span-2 h-full min-h-0">
            <app-compact-timer />
          </div>

          <!-- Quick Input: 1 col, 1 row -->
          <div class="col-span-1 h-full min-h-0">
            <app-quick-interval-input />
          </div>

          <!-- Row 1: Daily Summary -->
          <div class="col-span-1 h-full min-h-0">
            <app-daily-summary />
          </div>

          <!-- Row 2: Pomodoro + Weekly Summary -->
          <div class="col-span-1 h-full min-h-0">
            <app-pomodoro-timer />
          </div>
          <div class="col-span-1 h-full min-h-0">
            <app-weekly-summary />
          </div>
          
          <!-- Row 3: Chart (3 cols) + Holiday -->
          <div class="col-span-3 h-full min-h-0">
            <app-weekly-chart />
          </div>
          <div class="col-span-1 h-full min-h-0">
            <app-compact-holiday-counter />
          </div>

          <!-- Row 4: Margin Config + Lunch Config + Empty + Holiday Calendar -->
          <div class="col-span-1 h-full min-h-0">
            <app-margin-config />
          </div>
          <div class="col-span-1 h-full min-h-0">
            <app-lunch-config />
          </div>
          <div class="col-span-1 h-full min-h-0">
            <!-- Empty cell -->
          </div>
          <div class="col-span-1 h-full min-h-0">
            <app-compact-holiday-calendar />
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {}
