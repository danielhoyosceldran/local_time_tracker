// src/app/components/manual-entry-form/manual-entry-form.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { TimeEntryService } from '../../services/time-entry';
import { v4 as uuidv4 } from 'uuid';
import { toDatetimeLocal } from '../../utils/format';
import { TimeEntry } from '../../models/time-entry.model';

@Component({
  selector: 'app-manual-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
          <label for="startTime" class="block text-sm font-medium text-gray-700">Start Time *</label>
          <input id="startTime" type="datetime-local" formControlName="startTime" required
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-secondary focus:border-secondary"
          />
        </div>

        <div>
          <label for="endTime" class="block text-sm font-medium text-gray-700">End Time *</label>
          <input id="endTime" type="datetime-local" formControlName="endTime" required
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-secondary focus:border-secondary"
          />
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
    const nowLocal = toDatetimeLocal(Date.now());

    this.manualForm = this.fb.group({
      title: [''],
      description: [''],
      startTime: [nowLocal, Validators.required],
      endTime: [nowLocal, Validators.required],
    }, { validators: this.timeRangeValidator });
  }

  // Custom validator to ensure endTime > startTime
  private timeRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startControl = group.get('startTime');
    const endControl = group.get('endTime');

    if (!startControl || !endControl || !startControl.value || !endControl.value) {
      return null;
    }

    const start = new Date(startControl.value).getTime();
    const end = new Date(endControl.value).getTime();

    return end > start ? null : { invalidTimeRange: true };
  }

  addEntry(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const { title, description, startTime, endTime } = this.manualForm.value;

    const startTimestamp = new Date(startTime).getTime();
    const endTimestamp = new Date(endTime).getTime();
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

    // Reset form and set default dates to current time again
    this.manualForm.reset({
      startTime: toDatetimeLocal(Date.now()),
      endTime: toDatetimeLocal(Date.now()),
    });
  }
}
