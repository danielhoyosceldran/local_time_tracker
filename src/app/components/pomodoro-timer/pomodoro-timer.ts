import { Component, signal, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { FaviconService } from '../../services/favicon.service';
import { SOUNDS, SoundId, playSound } from '../../shared/sounds';
import { SoundPickerModalComponent } from '../../shared/sound-picker-modal';

type PomodoroPhase = 'work' | 'break';

const POMODORO_WORK_KEY        = 'timeTrackerPomodoroWork';
const POMODORO_BREAK_KEY       = 'timeTrackerPomodoroBreak';
const POMODORO_STATE_KEY       = 'timeTrackerPomodoroState';
const POMODORO_SOUND_WORK_KEY  = 'timeTrackerPomodoroSoundWork';
const POMODORO_SOUND_BREAK_KEY = 'timeTrackerPomodoroSoundBreak';

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
  imports: [CommonModule, FormsModule, SoundPickerModalComponent],
  template: `
    <div
      class="rounded-2xl p-3 h-full flex flex-col overflow-y-auto transition-all duration-500"
      [ngClass]="containerClasses()"
    >
      <!-- Header -->
      <div class="flex items-center gap-1.5 mb-1">
        <svg class="w-4 h-4" [ngClass]="headerIconColor()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="font-bold text-sm" [ngClass]="headerTextColor()">Pomodoro</h3>
      </div>

      <!-- Phase selector / label -->
      <div class="flex justify-center mb-1">
        @if (running()) {
          <span
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm"
            [ngClass]="phase() === 'work' ? 'text-white' : 'text-white'"
          >
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
              [ngClass]="phase() === 'work' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10 text-white'"
            >Work</button>
            <button
              type="button"
              (click)="setPhase('break')"
              class="px-3 py-0.5 transition-all active:scale-95"
              [ngClass]="phase() === 'break' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10 text-white'"
            >Break</button>
          </div>
        }
      </div>

      <!-- Countdown -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-6xl font-extrabold font-mono text-white leading-none">
          {{ displayTime() }}
        </div>
      </div>

      <!-- Controls -->
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

      <!-- Config (only when not running) -->
      @if (!running()) {
        <div class="grid grid-cols-2 gap-1.5">
          <!-- Work minutes -->
          <div>
            <label class="block text-[10px] text-white/60 mb-0.5">Work (min)</label>
            <input
              type="number"
              [ngModel]="workMinutes()"
              (ngModelChange)="setWorkMinutes($event)"
              (input)="cleanValue($event)"
              min="0"
              class="w-full px-1 py-0.5 border border-white/20 rounded-lg text-xs text-center bg-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-white/40 focus:border-transparent"
            />
          </div>
          <!-- Break minutes -->
          <div>
            <label class="block text-[10px] text-white/60 mb-0.5">Break (min)</label>
            <input
              type="number"
              [ngModel]="breakMinutes()"
              (ngModelChange)="setBreakMinutes($event)"
              min="0"
              class="w-full px-1 py-0.5 border border-white/20 rounded-lg text-xs text-center bg-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-white/40 focus:border-transparent"
            />
          </div>

          <!-- Work sound -->
          <div>
            <label class="block text-[10px] text-white/60 mb-0.5">Work sound</label>
            <button
              type="button"
              (click)="soundModalFor.set('work')"
              class="w-full flex items-center justify-between px-1.5 py-0.5 border border-white/20 rounded-lg text-xs bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80"
            >
              <span class="truncate">{{ soundLabel(workSound()) }}</span>
              <svg class="w-3 h-3 shrink-0 ml-1 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </button>
          </div>

          <!-- Break sound -->
          <div>
            <label class="block text-[10px] text-white/60 mb-0.5">Break sound</label>
            <button
              type="button"
              (click)="soundModalFor.set('break')"
              class="w-full flex items-center justify-between px-1.5 py-0.5 border border-white/20 rounded-lg text-xs bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80"
            >
              <span class="truncate">{{ soundLabel(breakSound()) }}</span>
              <svg class="w-3 h-3 shrink-0 ml-1 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </button>
          </div>

          @if (soundModalFor() === 'work') {
            <app-sound-picker-modal
              title="Work sound"
              [current]="workSound()"
              (soundSelected)="setWorkSound($event)"
              (closed)="soundModalFor.set(null)"
            />
          }
          @if (soundModalFor() === 'break') {
            <app-sound-picker-modal
              title="Break sound"
              [current]="breakSound()"
              (soundSelected)="setBreakSound($event)"
              (closed)="soundModalFor.set(null)"
            />
          }

        </div>
      }
    </div>
  `,
})
export class PomodoroTimerComponent implements OnInit, OnDestroy {
  private notifications = inject(NotificationService);
  private favicon = inject(FaviconService);

  phase            = signal<PomodoroPhase>('work');
  running          = signal(false);
  workMinutes      = signal(parseInt(localStorage.getItem(POMODORO_WORK_KEY)  || '25', 10));
  breakMinutes     = signal(parseInt(localStorage.getItem(POMODORO_BREAK_KEY) || '5',  10));
  remainingSeconds = signal(parseInt(localStorage.getItem(POMODORO_WORK_KEY)  || '25', 10) * 60);
  workSound        = signal<SoundId>((localStorage.getItem(POMODORO_SOUND_WORK_KEY)  || 'beep') as SoundId);
  breakSound       = signal<SoundId>((localStorage.getItem(POMODORO_SOUND_BREAK_KEY) || 'beep') as SoundId);
  soundModalFor    = signal<'work' | 'break' | null>(null);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private endTime: number | null = null;

  backgroundClasses = computed(() =>
    this.phase() === 'work'
      ? 'from-blue-50 to-indigo-50 border-blue-200'
      : 'from-green-50 to-emerald-100 border-green-200'
  );

  iconColor = computed(() =>
    this.phase() === 'work' ? 'text-blue-600' : 'text-green-600'
  );

  containerClasses = computed(() =>
    this.phase() === 'work'
      ? 'bg-slate-900'
      : 'bg-emerald-500'
  );

  headerIconColor = computed(() => 'text-white/70');

  headerTextColor = computed(() => 'text-white');

  displayTime = computed(() => {
    const total = this.remainingSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  soundLabel(id: SoundId): string {
    return SOUNDS.find(s => s.id === id)?.label ?? '';
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
      this.phase() === 'work' ? this.workMinutes() * 60 : this.breakMinutes() * 60
    );
    this.saveState();
  }

  setWorkMinutes(value: number): void {
    const clamped = Math.max(0, value);
    this.workMinutes.set(clamped);
    localStorage.setItem(POMODORO_WORK_KEY, String(clamped));
    if (this.phase() === 'work' && !this.running()) {
      this.remainingSeconds.set(clamped * 60);
    }
  }

  setBreakMinutes(value: number): void {
    const clamped = Math.max(0, value);
    this.breakMinutes.set(clamped);
    localStorage.setItem(POMODORO_BREAK_KEY, String(clamped));
    if (this.phase() === 'break' && !this.running()) {
      this.remainingSeconds.set(clamped * 60);
    }
  }

  setPhase(p: PomodoroPhase): void {
    this.phase.set(p);
    this.remainingSeconds.set(p === 'work' ? this.workMinutes() * 60 : this.breakMinutes() * 60);
    this.endTime = null;
    p === 'work' ? this.favicon.setWork() : this.favicon.setBreak();
    this.saveState();
  }

  setWorkSound(id: SoundId): void {
    this.workSound.set(id);
    localStorage.setItem(POMODORO_SOUND_WORK_KEY, id);
  }

  setBreakSound(id: SoundId): void {
    this.breakSound.set(id);
    localStorage.setItem(POMODORO_SOUND_BREAK_KEY, id);
  }

  preview(id: SoundId): void {
    playSound(id);
  }

  cleanValue(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
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
    if (this.phase() === 'work') {
      this.phase.set('break');
      this.remainingSeconds.set(this.breakMinutes() * 60);
      this.endTime = Date.now() + this.breakMinutes() * 60 * 1000;
      this.favicon.setBreak();
      this.notifications.notify('Pomodoro - Break time!', `Take a ${this.breakMinutes()} min break.`);
      playSound(this.breakSound());
    } else {
      this.phase.set('work');
      this.remainingSeconds.set(this.workMinutes() * 60);
      this.endTime = Date.now() + this.workMinutes() * 60 * 1000;
      this.favicon.setWork();
      this.notifications.notify('Pomodoro - Focus time!', `Work session started: ${this.workMinutes()} min.`);
      playSound(this.workSound());
    }
    this.saveState();
  }
}
