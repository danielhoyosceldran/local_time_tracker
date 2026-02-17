// src/app/components/manual-entry-form/manual-entry-form.component.ts
import { Component, inject } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { KENDO_DATETIMEPICKER } from '@progress/kendo-angular-dateinputs';
import { TimeEntryService } from '../../services/time-entry';
import { v4 as uuidv4 } from 'uuid';
import { TimeEntry } from '../../models/time-entry.model';

@Component({
  selector: 'app-manual-entry-form',
  standalone: true,
  imports: [ReactiveFormsModule, KENDO_DATETIMEPICKER],
  template: `
    <div class="p-6 bg-white shadow-xl rounded-lg border border-gray-100">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Add Manual Entry</h2>
      <form [formGroup]="manualForm" (ngSubmit)="addEntry()" class="space-y-4">

        <div>
          <label for="manTitle" class="block text-sm font-medium text-gray-700">Title (Optional)</label>
          <input id="manTitle" type="text" formControlName="title"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-secondary focus:border-secondary"
          />
        </div>
        <div>
          <label for="manDesc" class="block text-sm font-medium text-gray-700">Description (Optional)</label>
          <textarea id="manDesc" formControlName="description" rows="2"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-secondary focus:border-secondary"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
          <kendo-datetimepicker
            formControlName="startTime"
            [format]="'dd/MM/yyyy HH:mm'"
            [fillMode]="'outline'"
          ></kendo-datetimepicker>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
          <kendo-datetimepicker
            formControlName="endTime"
            [format]="'dd/MM/yyyy HH:mm'"
            [fillMode]="'outline'"
          ></kendo-datetimepicker>
        </div>

        @if (manualForm.errors?.['invalidTimeRange'] && (manualForm.touched || manualForm.dirty)) {
          <div class="text-red-500 text-sm p-2 bg-red-50 rounded-md border border-red-200">
            End Time must be after Start Time.
          </div>
        }

        <button
          type="submit"
          [disabled]="manualForm.invalid"
          class="w-full py-3 px-4 bg-secondary hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-md transition duration-150 disabled:opacity-50"
        >
          ADD ENTRY
        </button>
      </form>
    </div>
  `,
})
export class ManualEntryFormComponent {
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
