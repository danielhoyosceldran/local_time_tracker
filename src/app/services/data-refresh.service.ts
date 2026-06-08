// src/app/services/data-refresh.service.ts
import { Injectable, inject } from '@angular/core';
import { TimeEntryService } from './time-entry';
import { SettingsService } from './settings.service';
import { PomodoroSettingsService } from './pomodoro-settings.service';
import { ReminderService } from './reminder.service';
import { HolidayService } from './holiday.service';
import { HolidayDatesService } from './holiday-dates.service';
import { CalendarSettingsService } from './calendar-settings.service';
import { SettingsDraftService } from './settings-draft.service';
import { TranslationService } from '../i18n';
import { ThemeService } from './theme.service';

/**
 * Reloads every service's in-memory state from localStorage. Used after an
 * import/reset (data-section) and after pulling data from the cloud gist, so
 * the UI updates live without a page reload. Single source of truth for the
 * "re-read everything" step.
 */
@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private time = inject(TimeEntryService);
  private settings = inject(SettingsService);
  private pomodoro = inject(PomodoroSettingsService);
  private reminder = inject(ReminderService);
  private holiday = inject(HolidayService);
  private holidayDates = inject(HolidayDatesService);
  private calendar = inject(CalendarSettingsService);
  private draft = inject(SettingsDraftService);
  private translation = inject(TranslationService);
  private theme = inject(ThemeService);

  async refreshAll(): Promise<void> {
    this.translation.reloadFromStorage();
    this.theme.reloadFromStorage();
    this.settings.reloadFromStorage();
    this.pomodoro.reloadFromStorage();
    this.reminder.reloadFromStorage();
    this.holiday.reloadFromStorage();
    this.holidayDates.reloadFromStorage();
    this.calendar.reloadFromStorage();
    this.time.reloadFromStorage();
    await this.draft.load();
  }
}
