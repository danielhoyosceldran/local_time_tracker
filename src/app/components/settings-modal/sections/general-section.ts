import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { SegmentedComponent, SegmentedOption } from '../shared/segmented';
import { Language } from '../../../i18n';
import { TranslatePipe } from '../../../i18n/translate.pipe';

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
    </app-settings-section>
  `,
})
export class GeneralSectionComponent {
  draft = inject(SettingsDraftService);

  readonly languageOptions: SegmentedOption<Language>[] = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'ca', label: 'Català' },
  ];
}
