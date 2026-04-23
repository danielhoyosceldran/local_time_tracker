import { Component, inject, signal } from '@angular/core';
import { TimeEntryService } from '../../../services/time-entry';
import { SettingsService } from '../../../services/settings.service';
import { PomodoroSettingsService } from '../../../services/pomodoro-settings.service';
import { ReminderService } from '../../../services/reminder.service';
import { HolidayService } from '../../../services/holiday.service';
import { HolidayDatesService } from '../../../services/holiday-dates.service';
import { CalendarSettingsService } from '../../../services/calendar-settings.service';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';

@Component({
  selector: 'app-data-section',
  standalone: true,
  imports: [SettingsSectionComponent],
  template: `
    <app-settings-section title="Data" iconBg="bg-slate-100 text-slate-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7l3-3h10l3 3M4 7h16M9 12h6"/>
      </svg>

      <div class="py-3 flex flex-wrap gap-2">
        <button
          type="button"
          (click)="onExport()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 transition-all"
        >Export</button>

        <label class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors">
          Import
          <input type="file" accept="application/json" class="hidden" (change)="onImport($event)" />
        </label>

        <button
          type="button"
          (click)="onReset()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all"
        >Reset</button>
      </div>

      @if (status()) {
        <p class="text-[11px] text-slate-500 pb-2">{{ status() }}</p>
      }
    </app-settings-section>
  `,
})
export class DataSectionComponent {
  private time = inject(TimeEntryService);
  private settings = inject(SettingsService);
  private pomodoro = inject(PomodoroSettingsService);
  private reminder = inject(ReminderService);
  private holiday = inject(HolidayService);
  private holidayDates = inject(HolidayDatesService);
  private calendar = inject(CalendarSettingsService);
  private draft = inject(SettingsDraftService);

  status = signal<string>('');

  onExport(): void {
    const json = this.time.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.status.set('Exported.');
  }

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!confirm('Import will overwrite current data. Continue?')) {
      input.value = '';
      return;
    }
    file.text().then(async txt => {
      try {
        this.time.importAll(txt);
        await this.refreshAll();
        this.status.set('Imported.');
      } catch {
        this.status.set('Import failed: invalid file.');
      }
      input.value = '';
    });
  }

  onReset(): void {
    if (!confirm('This will delete ALL data (entries, settings, holidays). Continue?')) return;
    this.time.resetAll();
    this.refreshAll();
    this.status.set('Reset done.');
  }

  private async refreshAll(): Promise<void> {
    this.settings.reloadFromStorage();
    this.pomodoro.reloadFromStorage();
    this.reminder.reloadFromStorage();
    this.holiday.reloadFromStorage();
    this.holidayDates.reloadFromStorage();
    this.calendar.reloadFromStorage();
    this.time.reloadFromStorage();
    // Re-sync the modal draft so current edits don't clobber the fresh state.
    await this.draft.load();
  }
}
