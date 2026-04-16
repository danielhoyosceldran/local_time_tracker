import { AfterViewInit, Component, inject, signal, ViewChild, ChangeDetectorRef } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KENDO_TIMEPICKER, TimePickerComponent } from '@progress/kendo-angular-dateinputs';
import { TimeEntryService } from '../../services/time-entry';

function timeStringToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

@Component({
  selector: 'app-lunch-config',
  standalone: true,
  imports: [CommonModule, FormsModule, KENDO_TIMEPICKER],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-3 h-full flex flex-col overflow-y-auto">
      <!-- Header + Switch -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 class="font-bold text-slate-800 text-sm">Lunch break</h3>
        </div>
        <button
          (click)="toggleEnabled()"
          class="relative w-10 h-5 rounded-full transition-colors duration-200"
          [ngClass]="enabled() ? 'bg-orange-500' : 'bg-slate-300'"
        >
          <span
            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            [ngClass]="enabled() ? 'translate-x-5' : 'translate-x-0'"
          ></span>
        </button>
      </div>

      <!-- Description -->
      <p class="text-[11px] text-slate-500 mb-3 leading-tight">
        Lunch time is added to the estimated finish time if the hour hasn't passed yet.
      </p>

      <!-- Inputs -->
      <div class="mt-auto grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Hour</label>
          <kendo-timepicker
            #timePicker
            [value]="lunchHourDate()"
            (valueChange)="setHour($event)"
            [format]="'HH:mm'"
            [steps]="{ hour: 1, minute: 30 }"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-timepicker>
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
export class LunchConfigComponent implements AfterViewInit {
  @ViewChild('timePicker') timePicker!: TimePickerComponent;
  
  private timeEntryService = inject(TimeEntryService);

  enabled = signal(true);
  lunchHourDate = signal<Date>(timeStringToDate('14:00'));
  lunchDurationMin = signal(60);

  constructor(private cdr: ChangeDetectorRef) {
    this.timeEntryService.lunchEnabled$.subscribe(v => this.enabled.set(v));
    this.timeEntryService.lunchHour$.subscribe(v =>
      this.lunchHourDate.set(timeStringToDate(v))
    );
    this.timeEntryService.lunchDurationMin$.subscribe(v => this.lunchDurationMin.set(v));
  }

  toggleEnabled(): void {
    this.timeEntryService.setLunchEnabled(!this.enabled());
  }

  ngAfterViewInit() {
    this.forceInitialRender();
  }

  private forceInitialRender() {
    if (this.timePicker) {
      // Abrimos el popup programáticamente
      this.timePicker.toggle(true);
      
      // En Zoneless, debemos avisar a Angular para que pinte la apertura
      this.cdr.detectChanges();

      // Usamos un setTimeout de 0 para que el navegador tenga un "respiro" 
      // para calcular las alturas antes de cerrar
      setTimeout(() => {
        this.timePicker.toggle(false);
        this.cdr.detectChanges();
        console.log('✅ Pre-renderizado de Kendo completado');
      }, 0);
    }
  }

  setHour(date: Date | null): void {
    if (date) {
      this.timeEntryService.setLunchHour(dateToTimeString(date));
    }
  }

  setDuration(value: number): void {
    this.timeEntryService.setLunchDurationMin(value);
  }
}
