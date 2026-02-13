// src/app/components/quick-interval-input/quick-interval-input.ts
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
  selector: 'app-quick-interval-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatTimepickerModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 h-full flex flex-col overflow-hidden">
      <div class="flex items-center gap-2 mb-1">
        <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        <h3 class="text-slate-900 font-semibold text-sm">Add Interval</h3>
      </div>

      <form [formGroup]="manualForm" (ngSubmit)="addEntry()" class="flex-1 flex flex-col gap-1 min-h-0">
        <input
          type="text"
          formControlName="title"
          placeholder="Task name..."
          class="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <input
          type="text"
          formControlName="description"
          placeholder="Description..."
          class="w-full flex-1 px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        <div class="compact-field space-y-0.5">
          <!-- Start -->
          <div>
            <label class="block text-[10px] font-medium text-slate-500">Start</label>
            <div class="flex gap-1">
              <mat-form-field appearance="outline" class="flex-1">
                <input matInput [matDatepicker]="startDatePicker" formControlName="startDate" />
                <mat-datepicker-toggle matIconSuffix [for]="startDatePicker" />
                <mat-datepicker #startDatePicker />
              </mat-form-field>
              <mat-form-field appearance="outline" class="flex-1">
                <input matInput [matTimepicker]="startTimePicker" formControlName="startTime" />
                <mat-timepicker-toggle matIconSuffix [for]="startTimePicker" />
                <mat-timepicker #startTimePicker interval="5m" />
              </mat-form-field>
            </div>
          </div>

          <!-- End -->
          <div>
            <label class="block text-[10px] font-medium text-slate-500">End</label>
            <div class="flex gap-1">
              <mat-form-field appearance="outline" class="flex-1">
                <input matInput [matDatepicker]="endDatePicker" formControlName="endDate" />
                <mat-datepicker-toggle matIconSuffix [for]="endDatePicker" />
                <mat-datepicker #endDatePicker />
              </mat-form-field>
              <mat-form-field appearance="outline" class="flex-1">
                <input matInput [matTimepicker]="endTimePicker" formControlName="endTime" />
                <mat-timepicker-toggle matIconSuffix [for]="endTimePicker" />
                <mat-timepicker #endTimePicker interval="5m" />
              </mat-form-field>
            </div>
          </div>
        </div>

        @if (manualForm.errors?.['invalidTimeRange'] && (manualForm.touched || manualForm.dirty)) {
          <div class="text-red-600 text-[10px] px-2 py-1 bg-red-50 rounded border border-red-200">
            End time must be after start time
          </div>
        }

        <button
          type="submit"
          [disabled]="manualForm.invalid"
          class="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
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
