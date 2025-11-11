// src/app/components/timer-control/timer-control.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeEntryService } from '../../services/time-entry';
import { RunningTimeEntry } from '../../models/time-entry.model';
import { formatDuration } from '../../utils/format';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-timer-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-6 bg-white shadow-xl rounded-lg border border-gray-100">
      <h2 class="text-3xl font-bold mb-4 text-gray-800">Time Tracker</h2>
      <div *ngIf="runningEntry$ | async as entry; else startForm">
        <div class="text-center p-4 bg-primary text-white rounded-lg mb-4 shadow-md">
          <p class="text-sm opacity-75">Tracking: {{ entry.title || '(No Title)' }}</p>
          <div class="text-6xl font-mono my-2">{{ runningTime$ | async }}</div>
          <p *ngIf="entry.description" class="text-sm opacity-90 truncate max-w-full mx-auto">{{ entry.description }}</p>
        </div>
        <button
          (click)="stopTracking()"
          class="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition duration-150"
        >
          STOP
        </button>
      </div>

      <ng-template #startForm>
        <form [formGroup]="timerForm" (ngSubmit)="startTracking()" class="space-y-4">
          <div>
            <label for="title" class="block text-sm font-medium text-gray-700">Title (Optional)</label>
            <input
              id="title"
              type="text"
              formControlName="title"
              placeholder="e.g. Develop Angular component"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label for="description" class="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              id="description"
              formControlName="description"
              rows="2"
              placeholder="Detailed notes on the task..."
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary focus:border-primary"
            ></textarea>
          </div>
          <button
            type="submit"
            class="w-full py-3 px-4 bg-primary hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-150"
          >
            START
          </button>
        </form>
      </ng-template>
    </div>
  `,
})
export class TimerControlComponent {
  // Inject the service directly (Angular 19 style)
  private timeEntryService = inject(TimeEntryService); 
  private fb = inject(FormBuilder);

  timerForm: FormGroup = this.fb.group({
    title: [''],
    description: [''],
  });

  runningEntry$: Observable<RunningTimeEntry | null> = this.timeEntryService.runningEntry$;
  runningTime$: Observable<string> = this.timeEntryService.runningDuration$.pipe(
    map(formatDuration)
  );

  startTracking(): void {
    const { title, description } = this.timerForm.value;
    const finalTitle = title ? title.trim() : null;
    const finalDescription = description ? description.trim() : null;

    this.timeEntryService.startTracking(finalTitle, finalDescription);

    this.timerForm.reset();
  }

  stopTracking(): void {
    this.timeEntryService.stopTracking();
  }
}