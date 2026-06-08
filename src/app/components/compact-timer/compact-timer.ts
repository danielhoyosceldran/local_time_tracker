// src/app/components/compact-timer/compact-timer.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeEntryService } from '../../services/time-entry';
import { RunningTimeEntry } from '../../models/time-entry.model';
import { formatDuration } from '../../utils/format';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, combineLatest, map } from 'rxjs';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';

@Component({
  selector: 'app-compact-timer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div
      class="backdrop-blur-xl rounded-2xl shadow-sm border p-4 h-full flex flex-col overflow-y-auto transition-colors duration-300"
      [class]="(lunchBreakActive$ | async)
        ? 'bg-orange-50/90 border-orange-200 shadow-orange-100'
        : 'bg-white/80 border-white shadow-slate-200/50'"
    >
      @if (lunchBreakActive$ | async) {
        <!-- Lunch Break State -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-orange-700 font-bold">{{ 'timer.lunchBreakTitle' | t }}</h3>
          <span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-bold rounded-full tracking-wider">
            {{ 'timer.lunchBreakBadge' | t }}
          </span>
        </div>

        <div class="flex-1 flex flex-col items-center justify-center rounded-xl p-6 mb-4">
          <!-- Fork & knife icon -->
          <div class="text-orange-400 mb-3">
            <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          </div>

          <!-- Elapsed time -->
          <div class="text-5xl font-extrabold font-mono tracking-tighter text-orange-500 mb-1">
            {{ lunchElapsed$ | async }}
          </div>

          <!-- Countdown or "over" label -->
          @if ((lunchBreakOver$ | async) === false) {
            <div class="text-sm text-orange-400 font-medium">
              {{ 'timer.lunchBreakRemaining' | t }} <span class="font-mono font-bold">{{ lunchRemaining$ | async }}</span>
            </div>
          } @else {
            <div class="text-sm text-orange-600 font-bold">
              {{ 'timer.lunchBreakOver' | t }}
            </div>
          }
        </div>

        <!-- Resume Button -->
        <button
          (click)="resumeFromLunch()"
          class="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all"
        >
          {{ 'timer.resumeFromLunch' | t }}
        </button>
      } @else if (runningView$ | async; as view) {
        <!-- Running State -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-800 font-bold">{{ 'timer.compactTitle' | t }}</h3>
          <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full tracking-wider">
            {{ 'timer.active' | t }}
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
              [value]="view.entry.title || translation.t('timer.noTitle')"
              readonly
              class="text-slate-700 font-medium text-center bg-transparent border-none outline-none w-full cursor-default"
            />
            @if (view.entry.startedBy; as origin) {
              <div class="mt-1 text-xs text-slate-400 flex items-center justify-center gap-1">
                <!-- Device icon -->
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="12" rx="2"/>
                  <path d="M8 20h8M12 16v4"/>
                </svg>
                {{ 'timer.startedOn' | t: { device: origin.deviceName, browser: origin.browser } }}
              </div>
            }
          </div>
        </div>

        <!-- Stop + Lunch buttons -->
        <div class="flex gap-2">
          <button
            (click)="stopTracking()"
            [disabled]="!view.canControl"
            [title]="view.canControl
              ? ('timer.stopBtn' | t)
              : ('timer.lockedHint' | t: { device: view.entry.startedBy?.deviceName ?? '', browser: view.entry.startedBy?.browser ?? '' })"
            [class.opacity-40]="!view.canControl"
            [class.cursor-not-allowed]="!view.canControl"
            class="flex-1 py-4 px-4 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 transition-all"
          >
            {{ 'timer.stopBtn' | t }}
          </button>
          @if (lunchButtonEnabled$ | async) {
            <button
              (click)="startLunch()"
              [disabled]="!view.canControl"
              [class.opacity-40]="!view.canControl"
              [class.cursor-not-allowed]="!view.canControl"
              class="py-4 px-4 bg-orange-100 hover:bg-orange-200 active:scale-95 text-orange-600 font-bold rounded-2xl transition-all"
              [title]="view.canControl
                ? ('timer.lunchBtn' | t)
                : ('timer.lockedHint' | t: { device: view.entry.startedBy?.deviceName ?? '', browser: view.entry.startedBy?.browser ?? '' })"
            >
              <!-- Pause icon -->
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            </button>
          }
        </div>
      } @else {
        <!-- Start Form -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-slate-800 font-bold">{{ 'timer.compactTitle' | t }}</h3>
        </div>

        <form [formGroup]="timerForm" (ngSubmit)="startTracking()" class="flex-1 justify-between flex flex-col space-y-3">
          <div>
            <input
              id="title"
              type="text"
              formControlName="title"
              [placeholder]="'timer.taskName' | t"
              class="w-full px-0 py-2 border-0 border-b border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            class="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all mt-auto"
          >
            {{ 'timer.startBtn' | t }}
          </button>
        </form>
      }
    </div>
  `,
})
export class CompactTimerComponent {
  private timeEntryService = inject(TimeEntryService);
  private fb = inject(FormBuilder);
  protected translation = inject(TranslationService);

  timerForm: FormGroup = this.fb.group({ title: [''] });

  runningEntry$: Observable<RunningTimeEntry | null> = this.timeEntryService.runningEntry$;
  // Running entry paired with whether THIS device may pause/stop it. A timer
  // started on another device (shared via gist) is shown read-only here.
  runningView$: Observable<{ entry: RunningTimeEntry; canControl: boolean } | null> = combineLatest([
    this.timeEntryService.runningEntry$,
    this.timeEntryService.canControlRunning$,
  ]).pipe(map(([entry, canControl]) => (entry ? { entry, canControl } : null)));
  runningTime$: Observable<string> = this.timeEntryService.runningDuration$.pipe(map(formatDuration));
  lunchBreakActive$: Observable<boolean> = this.timeEntryService.lunchBreakActive$;
  lunchButtonEnabled$: Observable<boolean> = this.timeEntryService.lunchBreakButtonEnabled$;

  private lunchDurationMs$: Observable<number> = this.timeEntryService.lunchDurationMin$.pipe(
    map(min => min * 60 * 1000)
  );

  lunchElapsed$: Observable<string> = this.timeEntryService.lunchBreakElapsedMs$.pipe(
    map(ms => formatDuration(ms))
  );

  lunchRemaining$: Observable<string> = combineLatest([
    this.timeEntryService.lunchBreakElapsedMs$,
    this.lunchDurationMs$,
  ]).pipe(
    map(([elapsed, total]) => formatDuration(Math.max(0, total - elapsed)))
  );

  lunchBreakOver$: Observable<boolean> = combineLatest([
    this.timeEntryService.lunchBreakElapsedMs$,
    this.lunchDurationMs$,
  ]).pipe(
    map(([elapsed, total]) => elapsed >= total)
  );

  startTracking(): void {
    const { title } = this.timerForm.value;
    this.timeEntryService.startTracking(title ? title.trim() : null, null);
    this.timerForm.reset();
  }

  stopTracking(): void {
    this.timeEntryService.stopTracking();
  }

  startLunch(): void {
    this.timeEntryService.startLunchBreak();
  }

  resumeFromLunch(): void {
    this.timeEntryService.resumeFromLunchBreak();
  }
}
