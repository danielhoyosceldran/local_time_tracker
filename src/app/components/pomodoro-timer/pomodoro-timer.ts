import { Component, signal, OnDestroy, OnInit, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { FaviconService } from '../../services/favicon.service';
import { PomodoroSettingsService } from '../../services/pomodoro-settings.service';
import { playSound } from '../../shared/sounds';

type PomodoroPhase = 'work' | 'break';

const POMODORO_STATE_KEY = 'timeTrackerPomodoroState';

interface PomodoroState {
  phase: PomodoroPhase;
  remainingSeconds: number;
  running: boolean;
  timestamp: number;
  endTime?: number;
}

@Component({
  selector: 'app-pomodoro-timer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="rounded-2xl p-3 h-full flex flex-col overflow-y-auto transition-all duration-500"
      [ngClass]="containerClasses()"
    >
      <div class="flex items-center gap-1.5 mb-1">
        <svg class="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="font-bold text-sm text-white">Pomodoro</h3>
      </div>

      <div class="flex justify-center mb-1">
        @if (running()) {
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white">
            {{ phase() === 'work' ? 'Working' : 'Break' }}
          </span>
        } @else {
          <div
            class="flex rounded-full overflow-hidden text-[10px] font-bold uppercase tracking-wider"
            [ngClass]="phase() === 'work' ? 'border border-slate-600' : 'border border-white/30'"
          >
            <button
              type="button"
              (click)="setPhase('work')"
              class="px-3 py-0.5 transition-all active:scale-95"
              [ngClass]="phase() === 'work' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'"
            >Work</button>
            <button
              type="button"
              (click)="setPhase('break')"
              class="px-3 py-0.5 transition-all active:scale-95"
              [ngClass]="phase() === 'break' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'"
            >Break</button>
          </div>
        }
      </div>

      <div class="flex-1 flex items-center justify-center">
        <div class="text-6xl font-extrabold font-mono text-white leading-none">
          {{ displayTime() }}
        </div>
      </div>

      <div class="flex justify-center gap-3 mb-1">
        <button
          (click)="toggleRunning()"
          class="p-2 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 active:scale-95 transition-all text-white"
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
          class="p-2 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 active:scale-95 transition-all text-white"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class PomodoroTimerComponent implements OnInit, OnDestroy {
  private notifications = inject(NotificationService);
  private favicon = inject(FaviconService);
  private settings = inject(PomodoroSettingsService);

  phase            = signal<PomodoroPhase>('work');
  running          = signal(false);
  remainingSeconds = signal(this.settings.workMinutes() * 60);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private endTime: number | null = null;

  containerClasses = computed(() =>
    this.phase() === 'work' ? 'bg-slate-900' : 'bg-emerald-500'
  );

  displayTime = computed(() => {
    const total = this.remainingSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  constructor() {
    // If settings change while idle, reflect them in the countdown.
    effect(() => {
      const w = this.settings.workMinutes();
      const b = this.settings.breakMinutes();
      if (!this.running()) {
        this.remainingSeconds.set((this.phase() === 'work' ? w : b) * 60);
      }
    });
  }

  ngOnInit(): void {
    const raw = localStorage.getItem(POMODORO_STATE_KEY);
    if (!raw) return;
    try {
      const state: PomodoroState = JSON.parse(raw);
      this.phase.set(state.phase);
      state.phase === 'work' ? this.favicon.setWork() : this.favicon.setBreak();
      if (state.running) {
        const endTime = state.endTime ?? (state.timestamp + state.remainingSeconds * 1000);
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          this.remainingSeconds.set(remaining);
          this.endTime = endTime;
          this.startTimer();
          this.running.set(true);
        } else {
          this.switchPhase();
        }
      } else {
        this.remainingSeconds.set(state.remainingSeconds);
      }
    } catch {
      localStorage.removeItem(POMODORO_STATE_KEY);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  toggleRunning(): void {
    if (this.running()) {
      this.clearTimer();
      this.endTime = null;
      this.running.set(false);
      this.saveState();
    } else {
      this.notifications.requestPermission();
      this.endTime = Date.now() + this.remainingSeconds() * 1000;
      this.startTimer();
      this.running.set(true);
      this.saveState();
    }
  }

  reset(): void {
    this.clearTimer();
    this.endTime = null;
    this.running.set(false);
    this.remainingSeconds.set(
      this.phase() === 'work' ? this.settings.workMinutes() * 60 : this.settings.breakMinutes() * 60
    );
    this.saveState();
  }

  setPhase(p: PomodoroPhase): void {
    this.phase.set(p);
    this.remainingSeconds.set(
      p === 'work' ? this.settings.workMinutes() * 60 : this.settings.breakMinutes() * 60
    );
    this.endTime = null;
    p === 'work' ? this.favicon.setWork() : this.favicon.setBreak();
    this.saveState();
  }

  private saveState(): void {
    const state: PomodoroState = {
      phase: this.phase(),
      remainingSeconds: this.remainingSeconds(),
      running: this.running(),
      timestamp: Date.now(),
      endTime: this.endTime ?? undefined,
    };
    localStorage.setItem(POMODORO_STATE_KEY, JSON.stringify(state));
  }

  private startTimer(): void {
    this.clearTimer();
    if (!this.endTime) {
      this.endTime = Date.now() + this.remainingSeconds() * 1000;
    }
    this.intervalId = setInterval(() => {
      const remaining = Math.ceil((this.endTime! - Date.now()) / 1000);
      if (remaining <= 0) {
        this.remainingSeconds.set(0);
        this.endTime = null;
        this.switchPhase();
      } else {
        this.remainingSeconds.set(remaining);
      }
    }, 250);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private switchPhase(): void {
    const workMin = this.settings.workMinutes();
    const breakMin = this.settings.breakMinutes();
    if (this.phase() === 'work') {
      this.phase.set('break');
      this.remainingSeconds.set(breakMin * 60);
      this.endTime = Date.now() + breakMin * 60 * 1000;
      this.favicon.setBreak();
      this.notifications.notify('Pomodoro - Break time!', `Take a ${breakMin} min break.`);
      playSound(this.settings.breakSound());
    } else {
      this.phase.set('work');
      this.remainingSeconds.set(workMin * 60);
      this.endTime = Date.now() + workMin * 60 * 1000;
      this.favicon.setWork();
      this.notifications.notify('Pomodoro - Focus time!', `Work session started: ${workMin} min.`);
      playSound(this.settings.workSound());
    }
    this.saveState();
  }
}
