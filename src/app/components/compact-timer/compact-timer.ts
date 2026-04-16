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
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-4 h-full flex flex-col overflow-y-auto">
      @if (runningEntry$ | async; as entry) {
        <!-- Running State -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-800 font-bold">Timer</h3>
          <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full tracking-wider">
            ACTIVO
          </span>
        </div>

        <!-- Time Display -->
        <div class="flex-1 flex flex-col items-center justify-center rounded-xl p-6 mb-4">
          <div class="text-5xl font-extrabold font-mono tracking-tighter text-indigo-600 mb-2">
            {{ runningTime$ | async }}
          </div>
          <div class="text-center">
            <input
              type="text"
              [value]="entry.title || 'Sin título'"
              readonly
              class="text-slate-700 font-medium text-center bg-transparent border-none outline-none w-full cursor-default"
            />
          </div>
        </div>

        <!-- Stop Button -->
        <button
          (click)="stopTracking()"
          class="w-full py-4 px-4 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 transition-all"
        >
          STOP
        </button>
      } @else {
        <!-- Start Form -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-800 font-bold">Timer</h3>
        </div>

        <form [formGroup]="timerForm" (ngSubmit)="startTracking()" class="flex-1 justify-between flex flex-col space-y-3">
          <div>
            <input
              id="title"
              type="text"
              formControlName="title"
              placeholder="Task name..."
              class="w-full px-0 py-2 border-0 border-b border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            class="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all mt-auto"
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
  });

  runningEntry$: Observable<RunningTimeEntry | null> = this.timeEntryService.runningEntry$;
  runningTime$: Observable<string> = this.timeEntryService.runningDuration$.pipe(
    map(formatDuration)
  );

  startTracking(): void {
    const { title } = this.timerForm.value;
    const finalTitle = title ? title.trim() : null;

    this.timeEntryService.startTracking(finalTitle, null);
    this.timerForm.reset();
  }

  stopTracking(): void {
    this.timeEntryService.stopTracking();
  }
}
