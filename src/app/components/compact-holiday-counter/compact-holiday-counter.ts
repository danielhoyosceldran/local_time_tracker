// src/app/components/compact-holiday-counter/compact-holiday-counter.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HolidayService, HolidayData } from '../../services/holiday.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-compact-holiday-counter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
        <h3 class="text-slate-900 font-semibold">Vacation Days</h3>
      </div>

      @if (holidays$ | async; as holidays) {
        <div class="flex-1 flex flex-col justify-center space-y-4">
          <!-- Remaining - Main Display -->
          <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 text-center border border-indigo-100">
            <div class="text-4xl font-bold text-indigo-600 mb-1">
              {{ holidays.total - holidays.used }}
            </div>
            <div class="text-xs text-slate-600 uppercase tracking-wide font-medium">Days Remaining</div>
          </div>

          <!-- Total Available -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600">Total Available</span>
            @if (editMode()) {
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  [(ngModel)]="editTotal"
                  (keyup.enter)="saveEdit()"
                  (keyup.escape)="cancelEdit()"
                  class="w-16 px-2 py-1 border border-indigo-300 rounded text-slate-900 font-semibold text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autofocus
                />
                <button
                  (click)="saveEdit()"
                  class="p-1 text-green-600 hover:bg-green-50 rounded transition"
                  title="Save"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </button>
                <button
                  (click)="cancelEdit()"
                  class="p-1 text-red-600 hover:bg-red-50 rounded transition"
                  title="Cancel"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            } @else {
              <div class="flex items-center gap-2">
                <span class="px-3 py-1 bg-slate-100 rounded-lg font-semibold text-slate-900">
                  {{ holidays.total }}
                </span>
                <button
                  (click)="startEdit(holidays.total)"
                  class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                  title="Edit total"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
              </div>
            }
          </div>

          <!-- Used Days with +/- buttons -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600">Days Used</span>
            <div class="flex items-center gap-2">
              <button
                (click)="decrementUsed(holidays.used)"
                [disabled]="holidays.used <= 0"
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 rounded-lg font-bold transition"
                title="Decrease"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                </svg>
              </button>
              <span class="px-4 py-1 bg-orange-100 text-orange-700 rounded-lg font-semibold min-w-[3rem] text-center">
                {{ holidays.used }}
              </span>
              <button
                (click)="incrementUsed(holidays.used)"
                [disabled]="holidays.used >= holidays.total"
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 rounded-lg font-bold transition"
                title="Increase"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CompactHolidayCounterComponent {
  private holidayService = inject(HolidayService);

  holidays$: Observable<HolidayData> = this.holidayService.holidays$;
  editMode = signal(false);
  editTotal = signal(22);

  startEdit(current: number): void {
    this.editTotal.set(current);
    this.editMode.set(true);
  }

  saveEdit(): void {
    this.holidayService.updateTotal(this.editTotal());
    this.editMode.set(false);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  incrementUsed(current: number): void {
    this.holidayService.updateUsed(current + 1);
  }

  decrementUsed(current: number): void {
    if (current > 0) {
      this.holidayService.updateUsed(current - 1);
    }
  }
}
