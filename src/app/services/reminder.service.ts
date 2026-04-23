import { Injectable, effect, inject, signal } from '@angular/core';
import { NotificationService } from './notification.service';
import { SoundId, playSound } from '../shared/sounds';

const KEYS = {
  enabled: 'timeTrackerReminderEnabled',
  time: 'timeTrackerReminderTime',
  message: 'timeTrackerReminderMessage',
  sound: 'timeTrackerReminderSound',
} as const;

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private notifications = inject(NotificationService);

  readonly enabled = signal<boolean>(localStorage.getItem(KEYS.enabled) === 'true');
  readonly time = signal<string>(localStorage.getItem(KEYS.time) ?? '09:00');
  readonly message = signal<string>(localStorage.getItem(KEYS.message) ?? 'Reminder!');
  readonly sound = signal<SoundId>((localStorage.getItem(KEYS.sound) ?? 'beep') as SoundId);

  private lastFiredDate = '';
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startInterval();
    effect(() => {
      // Reset last fired marker when the target time changes so a same-day retime can fire.
      this.time();
      this.lastFiredDate = '';
    });
  }

  async setEnabled(value: boolean): Promise<boolean> {
    if (value) {
      const granted = await this.notifications.requestPermission();
      if (!granted) {
        this.enabled.set(false);
        localStorage.setItem(KEYS.enabled, 'false');
        return false;
      }
    }
    this.enabled.set(value);
    localStorage.setItem(KEYS.enabled, String(value));
    return true;
  }

  setTime(time: string): void {
    this.time.set(time);
    localStorage.setItem(KEYS.time, time);
  }

  setMessage(msg: string): void {
    this.message.set(msg);
    localStorage.setItem(KEYS.message, msg);
  }

  setSound(sound: SoundId): void {
    this.sound.set(sound);
    localStorage.setItem(KEYS.sound, sound);
  }

  reloadFromStorage(): void {
    this.enabled.set(localStorage.getItem(KEYS.enabled) === 'true');
    this.time.set(localStorage.getItem(KEYS.time) ?? '09:00');
    this.message.set(localStorage.getItem(KEYS.message) ?? 'Reminder!');
    this.sound.set((localStorage.getItem(KEYS.sound) ?? 'beep') as SoundId);
    this.lastFiredDate = '';
  }

  private startInterval(): void {
    this.intervalId = setInterval(() => this.checkAndNotify(), 15_000);
  }

  private checkAndNotify(): void {
    if (!this.enabled()) return;
    const now = nowTimeString();
    const today = new Date().toDateString();
    if (now === this.time() && this.lastFiredDate !== today) {
      this.lastFiredDate = today;
      this.notifications.requestPermission().then(granted => {
        if (granted) this.notifications.notify('Reminder', this.message() || 'Reminder!');
      });
      playSound(this.sound());
    }
  }
}
