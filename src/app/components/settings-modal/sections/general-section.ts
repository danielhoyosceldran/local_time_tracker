import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { SegmentedComponent, SegmentedOption } from '../shared/segmented';
import { Language, TranslationService } from '../../../i18n';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { ThemeMode } from '../../../services/theme.service';

@Component({
  selector: 'app-general-section',
  standalone: true,
  imports: [
    CommonModule,
    SettingsSectionComponent,
    SettingRowComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  template: `
    <app-settings-section [title]="'general.title' | t" iconBg="bg-slate-900 text-white">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h18M3 12h12M3 19h18"/>
      </svg>

      <app-setting-row [label]="'general.language' | t" [hint]="'general.languageHint' | t">
        <app-segmented
          [options]="languageOptions"
          [value]="draft.language()"
          (changed)="draft.language.set($any($event))"
        />
      </app-setting-row>

      <app-setting-row [label]="'general.theme' | t" [hint]="'general.themeHint' | t">
        <app-segmented
          [options]="themeOptions()"
          [value]="draft.theme()"
          (changed)="draft.theme.set($any($event))"
        />
      </app-setting-row>
    </app-settings-section>
  `,
})
export class GeneralSectionComponent {
  draft = inject(SettingsDraftService);
  private translation = inject(TranslationService);

  readonly languageOptions: SegmentedOption<Language>[] = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'ca', label: 'Català' },
  ];

  readonly themeOptions = (): SegmentedOption<ThemeMode>[] => [
    { value: 'light', label: this.translation.t('general.theme.light' as any) },
    { value: 'dark', label: this.translation.t('general.theme.dark' as any) },
    { value: 'system', label: this.translation.t('general.theme.system' as any) },
  ];
}
