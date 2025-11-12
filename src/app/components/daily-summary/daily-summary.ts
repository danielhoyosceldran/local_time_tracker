// src/app/components/daily-summary/daily-summary.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeEntryService } from '../../services/time-entry';
import { formatDuration } from '../../utils/format';
import { DailySummary } from '../../models/time-entry.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-daily-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 bg-white shadow-xl rounded-lg border border-gray-100 mt-8">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Daily Hours Summary</h2>
      
      @if ((dailySummary$ | async)?.length === 0) {
        <div class="text-center py-4 text-gray-500 text-sm">
          No entries recorded yet to create a summary.
        </div>
      } @else {
        <div class="space-y-3">
          @for (summary of dailySummary$ | async; track summary.date) {
            <div class="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-indigo-700">Date</span>
                <span class="text-lg font-mono">{{ summary.date | date:'mediumDate' }}</span>
              </div>
              
              <div class="text-right">
                <span class="text-xs font-semibold text-indigo-700">Total Tracked</span>
                <span class="text-2xl font-bold text-primary block">
                  {{ formatDuration(summary.totalDurationMs) }}
                </span>
                <span class="text-m text-secondary block">
                  Queden: {{ formatDuration(28800000-summary.totalDurationMs) }}
                </span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})

export class DailySummaryComponent {
  private timeEntryService = inject(TimeEntryService);
  
  dailySummary$: Observable<DailySummary[]> = this.timeEntryService.dailySummary$;
  
  // Exposar la funció de format a la plantilla
  formatDuration = formatDuration;

  constructor() {
    // Es pot injectar Calendar, però per ara només injectem el servei.
  }
}