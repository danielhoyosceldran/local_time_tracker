// src/app/components/quick-interval-input/quick-interval-input.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { KENDO_DATETIMEPICKER } from '@progress/kendo-angular-dateinputs';
import { TimeEntryService } from '../../services/time-entry';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry } from '../../models/time-entry.model';

@Component({
  selector: 'app-quick-interval-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KENDO_DATETIMEPICKER],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <div class="mb-3">
        <h3 class="text-slate-900 font-semibold">Add Interval</h3>
      </div>

      <form [formGroup]="manualForm" (ngSubmit)="addEntry()" class="flex-1 flex flex-col space-y-2">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Task</label>
          <input
            type="text"
            formControlName="title"
            placeholder="Task name..."
            class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div class="grow flex flex-col">
          <label class="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea
            formControlName="description"
            rows="2"
            placeholder="Details..."
            class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none grow"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            Start <span class="text-red-500">*</span>
          </label>
          <kendo-datetimepicker
            formControlName="startTime"
            [format]="'dd/MM/yyyy HH:mm'"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-datetimepicker>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            End <span class="text-red-500">*</span>
          </label>
          <kendo-datetimepicker
            formControlName="endTime"
            [format]="'dd/MM/yyyy HH:mm'"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-datetimepicker>
        </div>

        @if (manualForm.errors?.['invalidTimeRange'] && (manualForm.touched || manualForm.dirty)) {
          <div class="text-red-600 text-xs p-2 bg-red-50 rounded-md border border-red-200">
            End time must be after start time
          </div>
        }

        <button
          type="submit"
          [disabled]="manualForm.invalid"
          class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
        >
          Add
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
      description: [''],
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

    const { title, description, startTime, endTime } = this.manualForm.value;

    const startTimestamp = (startTime as Date).getTime();
    const endTimestamp = (endTime as Date).getTime();
    const duration = endTimestamp - startTimestamp;

    const newEntry: TimeEntry = {
      id: uuidv4(),
      title: title ? title.trim() : null,
      description: description ? description.trim() : null,
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
