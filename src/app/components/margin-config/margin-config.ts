import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeEntryService } from '../../services/time-entry';

@Component({
  selector: 'app-margin-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 h-full flex flex-col">
      <!-- Header + Switch -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
          </svg>
          <h3 class="font-semibold text-slate-900 text-sm">Auto-round</h3>
        </div>
        <button
          (click)="toggleEnabled()"
          class="relative w-10 h-5 rounded-full transition-colors duration-200"
          [ngClass]="enabled() ? 'bg-amber-500' : 'bg-slate-300'"
        >
          <span
            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            [ngClass]="enabled() ? 'translate-x-5' : 'translate-x-0'"
          ></span>
        </button>
      </div>

      <!-- Description -->
      <p class="text-[11px] text-slate-500 mb-3 leading-tight">
        When stopping the timer, if today's total is within the margin of 8h, the interval adjusts to hit exactly 8:00:00.
      </p>

      <!-- Margin input -->
      <div class="mt-auto">
        <label class="block text-xs font-medium text-slate-600 mb-1">Margin (minutes)</label>
        <input
          type="number"
          [ngModel]="marginMinutes()"
          (ngModelChange)="setMargin($event)"
          min="1"
          max="60"
          class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>
    </div>
  `,
})
export class MarginConfigComponent {
  private timeEntryService = inject(TimeEntryService);

  enabled = signal(false);
  marginMinutes = signal(10);

  constructor() {
    this.timeEntryService.marginEnabled$.subscribe(v => this.enabled.set(v));
    this.timeEntryService.marginMinutes$.subscribe(v => this.marginMinutes.set(v));
  }

  toggleEnabled(): void {
    const next = !this.enabled();
    this.timeEntryService.setMarginEnabled(next);
  }

  setMargin(value: number): void {
    this.timeEntryService.setMarginMinutes(value);
  }
}
