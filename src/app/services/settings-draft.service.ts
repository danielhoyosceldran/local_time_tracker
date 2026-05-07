import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';
import { SettingsService, DayOfWeek, TimeFormat } from './settings.service';
import { TimeEntryService } from './time-entry';
import { PomodoroSettingsService } from './pomodoro-settings.service';
import { SoundId } from '../shared/sounds';

/**
 * Staging layer for the settings modal. Sections write to this draft; nothing
 * is persisted until apply() is called. Cancel simply throws the draft away.
 */
@Injectable({ providedIn: 'root' })
export class SettingsDraftService {
  private settings = inject(SettingsService);
  private timeEntry = inject(TimeEntryService);
  private pomodoro = inject(PomodoroSettingsService);

  // Workday
  readonly workdayHours = signal(0);
  readonly weeklyTargetHours = signal(0);
  readonly workdays = signal<DayOfWeek[]>([]);
  readonly firstDayOfWeek = signal<DayOfWeek>(1);
  readonly timeFormat = signal<TimeFormat>('24h');
  readonly showExpectedLine = signal<boolean>(true);

  // Auto-round
  readonly marginEnabled = signal(false);
  readonly marginMinutes = signal(10);

  // Lunch
  readonly lunchEnabled = signal(true);
  readonly lunchHour = signal('14:00');
  readonly lunchDurationMin = signal(60);

  // Pomodoro
  readonly pomoWork = signal(25);
  readonly pomoBreak = signal(5);
  readonly pomoWorkSound = signal<SoundId>('beep');
  readonly pomoBreakSound = signal<SoundId>('beep');

  async load(): Promise<void> {
    this.workdayHours.set(this.settings.workdayHours());
    this.weeklyTargetHours.set(this.settings.weeklyTargetHours());
    this.workdays.set([...this.settings.workdays()]);
    this.firstDayOfWeek.set(this.settings.firstDayOfWeek());
    this.timeFormat.set(this.settings.timeFormat());
    this.showExpectedLine.set(this.settings.showExpectedLine());

    this.marginEnabled.set(await firstValueFrom(this.timeEntry.marginEnabled$.pipe(take(1))));
    this.marginMinutes.set(await firstValueFrom(this.timeEntry.marginMinutes$.pipe(take(1))));

    this.lunchEnabled.set(await firstValueFrom(this.timeEntry.lunchEnabled$.pipe(take(1))));
    this.lunchHour.set(await firstValueFrom(this.timeEntry.lunchHour$.pipe(take(1))));
    this.lunchDurationMin.set(await firstValueFrom(this.timeEntry.lunchDurationMin$.pipe(take(1))));

    this.pomoWork.set(this.pomodoro.workMinutes());
    this.pomoBreak.set(this.pomodoro.breakMinutes());
    this.pomoWorkSound.set(this.pomodoro.workSound());
    this.pomoBreakSound.set(this.pomodoro.breakSound());
  }

  apply(): void {
    this.settings.setWorkdayHours(this.workdayHours());
    this.settings.setWeeklyTargetHours(this.weeklyTargetHours());
    this.settings.setWorkdays(this.workdays());
    this.settings.setFirstDayOfWeek(this.firstDayOfWeek());
    this.settings.setTimeFormat(this.timeFormat());
    this.settings.setShowExpectedLine(this.showExpectedLine());

    this.timeEntry.setMarginEnabled(this.marginEnabled());
    this.timeEntry.setMarginMinutes(this.marginMinutes());

    this.timeEntry.setLunchEnabled(this.lunchEnabled());
    this.timeEntry.setLunchHour(this.lunchHour());
    this.timeEntry.setLunchDurationMin(this.lunchDurationMin());

    this.pomodoro.setWorkMinutes(this.pomoWork());
    this.pomodoro.setBreakMinutes(this.pomoBreak());
    this.pomodoro.setWorkSound(this.pomoWorkSound());
    this.pomodoro.setBreakSound(this.pomoBreakSound());

    // Trigger recompute of derived summaries that depend on settings.
    this.timeEntry.recomputeAll();
  }

  toggleWorkday(day: DayOfWeek): void {
    const current = this.workdays();
    this.workdays.set(
      current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort((a, b) => a - b) as DayOfWeek[]
    );
  }
}
