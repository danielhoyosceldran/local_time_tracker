import { Component, inject } from '@angular/core';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SOUNDS, SoundId } from '../../../shared/sounds';
import { SoundPickerService } from '../../../shared/sound-picker.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { NumberInputComponent } from '../shared/number-input';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n';

@Component({
  selector: 'app-pomodoro-section',
  standalone: true,
  imports: [
    SettingsSectionComponent,
    SettingRowComponent,
    NumberInputComponent,
    TranslatePipe,
  ],
  template: `
    <app-settings-section [title]="'pomoSection.title' | t" iconBg="bg-emerald-100 text-emerald-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>

      <app-setting-row [label]="'pomoSection.workMin' | t">
        <app-number-input
          [value]="draft.pomoWork()"
          [min]="0"
          (changed)="draft.pomoWork.set($event)"
        />
      </app-setting-row>

      <app-setting-row [label]="'pomoSection.breakMin' | t">
        <app-number-input
          [value]="draft.pomoBreak()"
          [min]="0"
          (changed)="draft.pomoBreak.set($event)"
        />
      </app-setting-row>

      <app-setting-row [label]="'pomoSection.workSoundLabel' | t">
        <button
          type="button"
          (click)="openWork()"
          class="text-xs text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
        >{{ label(draft.pomoWorkSound()) }}</button>
      </app-setting-row>

      <app-setting-row [label]="'pomoSection.breakSoundLabel' | t">
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
  private translation = inject(TranslationService);

  label(id: SoundId): string {
    return SOUNDS.find(s => s.id === id)?.label ?? '';
  }

  openWork(): void {
    this.soundPicker.open({
      title: this.translation.t('sound.workTitle'),
      current: this.draft.pomoWorkSound,
      onSelect: (id) => this.draft.pomoWorkSound.set(id),
    });
  }

  openBreak(): void {
    this.soundPicker.open({
      title: this.translation.t('sound.breakTitle'),
      current: this.draft.pomoBreakSound,
      onSelect: (id) => this.draft.pomoBreakSound.set(id),
    });
  }
}
