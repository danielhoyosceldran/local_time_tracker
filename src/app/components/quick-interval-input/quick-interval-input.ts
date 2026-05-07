// src/app/components/quick-interval-input/quick-interval-input.ts
import { Component, inject } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { KENDO_DATETIMEPICKER } from '@progress/kendo-angular-dateinputs';
import { TimeEntryService } from '../../services/time-entry';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry } from '../../models/time-entry.model';

@Component({
  selector: 'app-quick-interval-input',
  standalone: true,
  imports: [ReactiveFormsModule, KENDO_DATETIMEPICKER],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-4 h-full flex flex-col overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-slate-800 font-bold">Add Interval</h3>
      </div>

      <form [formGroup]="manualForm" (ngSubmit)="addEntry()" class="flex-1 flex justify-between flex-col space-y-3">
        <div class="flex-1 flex flex-col space-y-3">
          <div>
            <input
              type="text"
              formControlName="title"
              placeholder="Task name..."
              class="w-full px-0 py-2 border-0 border-b border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-xs font-medium text-slate-600 mb-1">
                Start <span class="text-rose-500">*</span>
              </label>
              <kendo-datetimepicker
                formControlName="startTime"
                [format]="'dd/MM/yyyy HH:mm'"
                [fillMode]="'outline'"
                [size]="'small'"
              ></kendo-datetimepicker>
            </div>

            <div class="flex-1">
              <label class="block text-xs font-medium text-slate-600 mb-1">
                End <span class="text-rose-500">*</span>
              </label>
              <kendo-datetimepicker
                formControlName="endTime"
                [format]="'dd/MM/yyyy HH:mm'"
                [fillMode]="'outline'"
                [size]="'small'"
              ></kendo-datetimepicker>
            </div>
          </div>

          @if (manualForm.errors?.['invalidTimeRange'] && (manualForm.touched || manualForm.dirty)) {
            <div class="text-rose-600 text-xs p-2 bg-rose-50 rounded-xl border border-rose-200">
              End time must be after start time
            </div>
          }
        </div>

        <button
          type="submit"
          [disabled]="manualForm.invalid"
          class="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 mt-auto"
        >
          ADD
        </button>
      </form>
    </div>
  `,
})
export class QuickIntervalInputComponent {
  private fb = inject(FormBuilder);
  private timeEntryService = inject(TimeEntryService);

  manualForm: FormGroup;

  constructor() {
    const now = new Date();

    this.manualForm = this.fb.group({
      title: [''],
      startTime: [now, Validators.required],
      endTime: [now, Validators.required],
    }, { validators: this.timeRangeValidator });
  }

  private timeRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startControl = group.get('startTime');
    const endControl = group.get('endTime');

    if (!startControl?.value || !endControl?.value) {
      return null;
    }

    const start = (startControl.value as Date).getTime();
    const end = (endControl.value as Date).getTime();

    return end > start ? null : { invalidTimeRange: true };
  }

  addEntry(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const { title, startTime, endTime } = this.manualForm.value;

    const startTimestamp = (startTime as Date).getTime();
    const endTimestamp = (endTime as Date).getTime();
    const duration = endTimestamp - startTimestamp;

    const newEntry: TimeEntry = {
      id: uuidv4(),
      title: title ? title.trim() : null,
      description: null,
      startTime: startTimestamp,
      endTime: endTimestamp,
      duration: duration,
    };

    this.timeEntryService.addEntry(newEntry);

    const now = new Date();
    this.manualForm.reset({
      startTime: now,
      endTime: now,
    });
  }
}
