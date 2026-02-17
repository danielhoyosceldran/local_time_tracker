import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeEntryService } from '../../services/time-entry';

@Component({
  selector: 'app-lunch-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 h-full flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-1.5 mb-2">
        <svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="font-semibold text-slate-900 text-sm">Lunch break</h3>
      </div>

      <!-- Description -->
      <p class="text-[11px] text-slate-500 mb-3 leading-tight">
        Lunch time is added to the estimated finish time if the hour hasn't passed yet.
      </p>

      <!-- Inputs -->
      <div class="mt-auto grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Hour</label>
          <select
            [ngModel]="lunchHour()"
            (ngModelChange)="setHour($event)"
            class="w-full px-1 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          >
            @for (opt of timeOptions; track opt) {
              <option [value]="opt">{{ opt }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
          <input
            type="number"
            [ngModel]="lunchDurationMin()"
            (ngModelChange)="setDuration($event)"
            min="0"
            max="180"
            class="w-full px-1 py-1 border border-slate-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  `,
})
export class LunchConfigComponent {
  private timeEntryService = inject(TimeEntryService);

  lunchHour = signal('14:00');
  lunchDurationMin = signal(60);

  timeOptions: string[] = [];

  constructor() {
    this.timeOptions = this.generateTimeOptions();

    this.timeEntryService.lunchHour$.subscribe(v => this.lunchHour.set(v));
    this.timeEntryService.lunchDurationMin$.subscribe(v => this.lunchDurationMin.set(v));
  }

  setHour(value: string): void {
    this.timeEntryService.setLunchHour(value);
  }

  setDuration(value: number): void {
    this.timeEntryService.setLunchDurationMin(value);
  }

  private generateTimeOptions(): string[] {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        options.push(`${hh}:${mm}`);
      }
    }
    return options;
  }
}
