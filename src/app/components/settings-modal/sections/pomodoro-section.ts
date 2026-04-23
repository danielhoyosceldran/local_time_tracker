import { Component, inject, signal } from '@angular/core';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SOUNDS, SoundId } from '../../../shared/sounds';
import { SoundPickerModalComponent } from '../../../shared/sound-picker-modal';
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
    SoundPickerModalComponent,
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
          (click)="soundModalFor.set('work')"
          class="text-xs text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
        >{{ label(draft.pomoWorkSound()) }}</button>
      </app-setting-row>

      <app-setting-row label="Break sound">
        <button
          type="button"
          (click)="soundModalFor.set('break')"
          class="text-xs text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
        >{{ label(draft.pomoBreakSound()) }}</button>
      </app-setting-row>
    </app-settings-section>

    @if (soundModalFor() === 'work') {
      <app-sound-picker-modal
        title="Work sound"
        [current]="draft.pomoWorkSound()"
        (soundSelected)="draft.pomoWorkSound.set($event); soundModalFor.set(null)"
        (closed)="soundModalFor.set(null)"
      />
    }
    @if (soundModalFor() === 'break') {
      <app-sound-picker-modal
        title="Break sound"
        [current]="draft.pomoBreakSound()"
        (soundSelected)="draft.pomoBreakSound.set($event); soundModalFor.set(null)"
        (closed)="soundModalFor.set(null)"
      />
    }
  `,
})
export class PomodoroSectionComponent {
  draft = inject(SettingsDraftService);
  soundModalFor = signal<'work' | 'break' | null>(null);
  label(id: SoundId): string {
    return SOUNDS.find(s => s.id === id)?.label ?? '';
  }
}
