import { Component, inject } from '@angular/core';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { ToggleComponent } from '../shared/toggle';
import { NumberInputComponent } from '../shared/number-input';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-autoround-section',
  standalone: true,
  imports: [SettingsSectionComponent, SettingRowComponent, ToggleComponent, NumberInputComponent, TranslatePipe],
  template: `
    <app-settings-section [title]="'autoround.title' | t" iconBg="bg-amber-100 text-amber-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7"/>
      </svg>
      <div header-extra>
        <app-toggle
          [checked]="draft.marginEnabled()"
          activeClass="bg-amber-500"
          (changed)="draft.marginEnabled.set($event)"
        />
      </div>

      <app-setting-row
        [label]="'autoround.margin' | t"
        [hint]="'autoround.marginHintLong' | t"
      >
        <app-number-input
          [value]="draft.marginMinutes()"
          [min]="1" [max]="60"
          (changed)="draft.marginMinutes.set($event)"
        />
      </app-setting-row>
    </app-settings-section>
  `,
})
export class AutoroundSectionComponent {
  draft = inject(SettingsDraftService);
}
