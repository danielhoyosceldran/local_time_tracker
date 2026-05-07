import { Component, inject } from '@angular/core';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SOUNDS, SoundId } from '../../../shared/sounds';
import { SoundPickerService } from '../../../shared/sound-picker.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { NumberInputComponent } from '../shared/number-input';

@Component({
  selector: 'app-pomodoro-section',
  standalone: true,
  imports: [
    SettingsSectionComponent,
    SettingRowComponent,
    NumberInputComponent,
  ],
  template: `
    <app-settings-section title="Pomodoro" iconBg="bg-emerald-100 text-emerald-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>

      <app-setting-row label="Work (min)">
        <app-number-input
          [value]="draft.pomoWork()"
          [min]="0"
          (changed)="draft.pomoWork.set($event)"
        />
      </app-setting-row>

      <app-setting-row label="Break (min)">
        <app-number-input
          [value]="draft.pomoBreak()"
          [min]="0"
          (changed)="draft.pomoBreak.set($event)"
        />
      </app-setting-row>

      <app-setting-row label="Work sound">
        <button
          type="button"
          (click)="openWork()"
          class="text-xs text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
        >{{ label(draft.pomoWorkSound()) }}</button>
      </app-setting-row>

      <app-setting-row label="Break sound">
        <button
          type="button"
          (click)="openBreak()"
          class="text-xs text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
        >{{ label(draft.pomoBreakSound()) }}</button>
      </app-setting-row>
    </app-settings-section>
  `,
})
export class PomodoroSectionComponent {
  draft = inject(SettingsDraftService);
  private soundPicker = inject(SoundPickerService);

  label(id: SoundId): string {
    return SOUNDS.find(s => s.id === id)?.label ?? '';
  }

  openWork(): void {
    this.soundPicker.open({
      title: 'Work sound',
      current: this.draft.pomoWorkSound,
      onSelect: (id) => this.draft.pomoWorkSound.set(id),
    });
  }

  openBreak(): void {
    this.soundPicker.open({
      title: 'Break sound',
      current: this.draft.pomoBreakSound,
      onSelect: (id) => this.draft.pomoBreakSound.set(id),
    });
  }
}
