// src/app/components/manual-entry-form/manual-entry-form.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TimeEntryService } from '../../services/time-entry';
import { v4 as uuidv4 } from 'uuid';
import { combineDateAndTime } from '../../utils/format';
import { TimeEntry } from '../../models/time-entry.model';

@Component({
  selector: 'app-manual-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatTimepickerModule],
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
          <div class="flex gap-2">
            <mat-form-field appearance="outline" class="flex-1">
              <input matInput [matDatepicker]="startDatePicker" formControlName="startDate" placeholder="Date" />
              <mat-datepicker-toggle matIconSuffix [for]="startDatePicker" />
              <mat-datepicker #startDatePicker />
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <input matInput [matTimepicker]="startTimePicker" formControlName="startTime" placeholder="Time" />
              <mat-timepicker-toggle matIconSuffix [for]="startTimePicker" />
              <mat-timepicker #startTimePicker interval="5m" />
            </mat-form-field>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
          <div class="flex gap-2">
            <mat-form-field appearance="outline" class="flex-1">
              <input matInput [matDatepicker]="endDatePicker" formControlName="endDate" placeholder="Date" />
              <mat-datepicker-toggle matIconSuffix [for]="endDatePicker" />
              <mat-datepicker #endDatePicker />
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <input matInput [matTimepicker]="endTimePicker" formControlName="endTime" placeholder="Time" />
              <mat-timepicker-toggle matIconSuffix [for]="endTimePicker" />
              <mat-timepicker #endTimePicker interval="5m" />
            </mat-form-field>
          </div>
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
      startDate: [now, Validators.required],
      startTime: [now, Validators.required],
      endDate: [now, Validators.required],
      endTime: [now, Validators.required],
    }, { validators: this.timeRangeValidator });
  }

  private timeRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startDate = group.get('startDate');
    const startTime = group.get('startTime');
    const endDate = group.get('endDate');
    const endTime = group.get('endTime');

    if (!startDate?.value || !startTime?.value || !endDate?.value || !endTime?.value) {
      return null;
    }

    const start = combineDateAndTime(startDate.value, startTime.value).getTime();
    const end = combineDateAndTime(endDate.value, endTime.value).getTime();

    return end > start ? null : { invalidTimeRange: true };
  }

  addEntry(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const { title, description, startDate, startTime, endDate, endTime } = this.manualForm.value;

    const startTimestamp = combineDateAndTime(startDate, startTime).getTime();
    const endTimestamp = combineDateAndTime(endDate, endTime).getTime();
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
      startDate: now,
      startTime: now,
      endDate: now,
      endTime: now,
    });
  }
}
