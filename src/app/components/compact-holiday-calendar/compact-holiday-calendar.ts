// src/app/components/compact-holiday-calendar/compact-holiday-calendar.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HolidayDatesService } from '../../services/holiday-dates.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-compact-holiday-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-3">
        <svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <h3 class="text-slate-900 font-semibold">Holiday Calendar</h3>
      </div>

      <!-- Date Input -->
      <div class="flex gap-2 mb-3">
        <input
          type="date"
          [(ngModel)]="selectedDate"
          class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <button
          (click)="addHoliday()"
          [disabled]="!selectedDate()"
          class="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
          title="Add holiday"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add
        </button>
      </div>

      <!-- Holiday List -->
      <div class="flex-1 overflow-y-auto">
        @if (holidayDates$ | async; as dates) {
          @if (dates.length > 0) {
            <div class="space-y-1.5">
              @for (date of dates; track date) {
                <div class="flex items-center justify-between px-3 py-2 bg-teal-50 rounded-lg border border-teal-100 hover:bg-teal-100 transition">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span class="text-sm font-medium text-slate-900">
                      {{ formatDate(date) }}
                    </span>
                    <span class="text-xs text-slate-500">
                      ({{ getDayName(date) }})
                    </span>
                  </div>
                  <button
                    (click)="removeHoliday(date)"
                    class="p-1 text-red-500 hover:bg-red-100 rounded transition"
                    title="Remove"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
              No holidays registered
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class CompactHolidayCalendarComponent {
  private holidayDatesService = inject(HolidayDatesService);

  holidayDates$: Observable<string[]> = this.holidayDatesService.holidayDates$;
  selectedDate = signal<string>('');

  addHoliday(): void {
    const date = this.selectedDate();
    if (!date) return;

    const success = this.holidayDatesService.addHolidayDate(date);
    if (success) {
      this.selectedDate.set('');
    }
  }

  removeHoliday(date: string): void {
    this.holidayDatesService.removeHolidayDate(date);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getDayName(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { weekday: 'short' });
  }
}
