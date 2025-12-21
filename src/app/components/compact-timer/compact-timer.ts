// src/app/components/compact-timer/compact-timer.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeEntryService } from '../../services/time-entry';
import { RunningTimeEntry } from '../../models/time-entry.model';
import { formatDuration } from '../../utils/format';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-compact-timer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      @if (runningEntry$ | async; as entry) {
        <!-- Running State -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-900 font-semibold">Timer</h3>
          <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            ACTIVO
          </span>
        </div>

        <!-- Time Display -->
        <div class="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100 mb-4">
          <div class="text-5xl text-indigo-600 font-mono tracking-tight mb-2">
            {{ runningTime$ | async }}
          </div>
          <div class="text-center">
            <p class="text-slate-700 font-medium">{{ entry.title || 'Sin título' }}</p>
            @if (entry.description) {
              <p class="text-sm text-slate-500 mt-1">{{ entry.description }}</p>
            }
          </div>
        </div>

        <!-- Stop Button -->
        <button
          (click)="stopTracking()"
          class="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm transition"
        >
          STOP
        </button>
      } @else {
        <!-- Start Form -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-900 font-semibold">Timer</h3>
        </div>

        <form [formGroup]="timerForm" (ngSubmit)="startTracking()" class="flex-1 flex flex-col space-y-3">
          <div>
            <label for="title" class="block text-xs font-medium text-slate-600 mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              formControlName="title"
              placeholder="Task name..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div class="flex-1 flex flex-col">
            <label for="description" class="block text-xs font-medium text-slate-600 mb-1">
              Description
            </label>
            <textarea
              id="description"
              formControlName="description"
              rows="3"
              placeholder="Details..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none grow"
            ></textarea>
          </div>

          <button
            type="submit"
            class="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm transition mt-auto"
          >
            START
          </button>
        </form>
      }
    </div>
  `,
})
export class CompactTimerComponent {
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
