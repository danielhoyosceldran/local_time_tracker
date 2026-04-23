import { Injectable, signal } from '@angular/core';
import { SoundId } from '../shared/sounds';

const KEYS = {
  work: 'timeTrackerPomodoroWork',
  break: 'timeTrackerPomodoroBreak',
  workSound: 'timeTrackerPomodoroSoundWork',
  breakSound: 'timeTrackerPomodoroSoundBreak',
} as const;

@Injectable({ providedIn: 'root' })
export class PomodoroSettingsService {
  readonly workMinutes = signal(parseInt(localStorage.getItem(KEYS.work) ?? '25', 10));
  readonly breakMinutes = signal(parseInt(localStorage.getItem(KEYS.break) ?? '5', 10));
  readonly workSound = signal<SoundId>((localStorage.getItem(KEYS.workSound) ?? 'beep') as SoundId);
  readonly breakSound = signal<SoundId>((localStorage.getItem(KEYS.breakSound) ?? 'beep') as SoundId);

  setWorkMinutes(value: number): void {
    const clamped = Math.max(0, value);
    this.workMinutes.set(clamped);
    localStorage.setItem(KEYS.work, String(clamped));
  }

  setBreakMinutes(value: number): void {
    const clamped = Math.max(0, value);
    this.breakMinutes.set(clamped);
    localStorage.setItem(KEYS.break, String(clamped));
  }

  setWorkSound(id: SoundId): void {
    this.workSound.set(id);
    localStorage.setItem(KEYS.workSound, id);
  }

  setBreakSound(id: SoundId): void {
    this.breakSound.set(id);
    localStorage.setItem(KEYS.breakSound, id);
  }

  reloadFromStorage(): void {
    this.workMinutes.set(parseInt(localStorage.getItem(KEYS.work) ?? '25', 10));
    this.breakMinutes.set(parseInt(localStorage.getItem(KEYS.break) ?? '5', 10));
    this.workSound.set((localStorage.getItem(KEYS.workSound) ?? 'beep') as SoundId);
    this.breakSound.set((localStorage.getItem(KEYS.breakSound) ?? 'beep') as SoundId);
  }
}
