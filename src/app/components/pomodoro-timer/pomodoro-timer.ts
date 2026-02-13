import { Component, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type PomodoroPhase = 'work' | 'break';

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="rounded-xl border p-3 h-full flex flex-col transition-colors duration-300 bg-gradient-to-br"
      [ngClass]="backgroundClasses()"
    >
      <!-- Header -->
      <div class="flex items-center gap-1.5 mb-1">
        <svg class="w-4 h-4" [ngClass]="iconColor()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="font-semibold text-slate-900 text-sm">Pomodoro</h3>
      </div>

        <!-- Phase Label -->
        <div class="text-center mb-1">
          <span
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            [ngClass]="phase() === 'work'
              ? 'bg-blue-200 text-blue-800'
              : 'bg-green-200 text-green-800'"
          >
            {{ phase() === 'work' ? 'Working' : 'Break' }}
          </span>
        </div>

        <!-- Countdown -->
        <div class="flex-1 flex items-center justify-center">
          <div
            class="text-3xl font-bold font-mono"
            [ngClass]="phase() === 'work' ? 'text-blue-600' : 'text-green-600'"
          >
            {{ displayTime() }}
          </div>
        </div>

        <!-- Controls -->
        <div class="flex justify-center gap-2 mb-1">
          <button
            (click)="toggleRunning()"
            class="p-1.5 rounded-lg transition"
            [ngClass]="phase() === 'work'
              ? 'text-blue-600 hover:bg-blue-100'
              : 'text-green-600 hover:bg-green-100'"
          >
            @if (running()) {
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            }
          </button>
          <button
            (click)="reset()"
            class="p-1.5 rounded-lg transition text-slate-500 hover:bg-slate-100"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>

        <!-- Config (only when not running) -->
        @if (!running()) {
          <div class="grid grid-cols-2 gap-1.5">
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Work (min)</label>
              <input
                type="number"
                [ngModel]="workMinutes()"
                (ngModelChange)="setWorkMinutes($event)"
                min="1"
                max="60"
                class="w-full px-1 py-0.5 border border-slate-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Break (min)</label>
              <input
                type="number"
                [ngModel]="breakMinutes()"
                (ngModelChange)="setBreakMinutes($event)"
                min="1"
                max="30"
                class="w-full px-1 py-0.5 border border-slate-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
            </div>
          </div>
        }
    </div>
  `,
})
export class PomodoroTimerComponent implements OnDestroy {
  phase = signal<PomodoroPhase>('work');
  running = signal(false);
  remainingSeconds = signal(25 * 60);

  workMinutes = signal(25);
  breakMinutes = signal(5);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  backgroundClasses = computed(() =>
    this.phase() === 'work'
      ? 'from-blue-50 to-indigo-50 border-blue-200'
      : 'from-green-50 to-emerald-100 border-green-200'
  );

  iconColor = computed(() =>
    this.phase() === 'work' ? 'text-blue-600' : 'text-green-600'
  );

  displayTime = computed(() => {
    const total = this.remainingSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  toggleRunning(): void {
    if (this.running()) {
      this.clearTimer();
      this.running.set(false);
    } else {
      this.startTimer();
      this.running.set(true);
    }
  }

  reset(): void {
    this.clearTimer();
    this.running.set(false);
    this.remainingSeconds.set(
      this.phase() === 'work'
        ? this.workMinutes() * 60
        : this.breakMinutes() * 60
    );
  }

  setWorkMinutes(value: number): void {
    const clamped = Math.max(1, Math.min(60, value));
    this.workMinutes.set(clamped);
    if (this.phase() === 'work' && !this.running()) {
      this.remainingSeconds.set(clamped * 60);
    }
  }

  setBreakMinutes(value: number): void {
    const clamped = Math.max(1, Math.min(30, value));
    this.breakMinutes.set(clamped);
    if (this.phase() === 'break' && !this.running()) {
      this.remainingSeconds.set(clamped * 60);
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.intervalId = setInterval(() => {
      const current = this.remainingSeconds();
      if (current <= 1) {
        this.playBeep();
        this.switchPhase();
      } else {
        this.remainingSeconds.set(current - 1);
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private switchPhase(): void {
    if (this.phase() === 'work') {
      this.phase.set('break');
      this.remainingSeconds.set(this.breakMinutes() * 60);
    } else {
      this.phase.set('work');
      this.remainingSeconds.set(this.workMinutes() * 60);
    }
  }

  private playBeep(): void {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      setTimeout(() => ctx.close(), 600);
    } catch {
      // Audio not supported
    }
  }
}
