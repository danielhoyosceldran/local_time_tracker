import { AfterViewInit, Component, ChangeDetectorRef, ViewChild, inject } from '@angular/core';
import { KENDO_TIMEPICKER, TimePickerComponent } from '@progress/kendo-angular-dateinputs';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { ToggleComponent } from '../shared/toggle';
import { NumberInputComponent } from '../shared/number-input';
import { TranslatePipe } from '../../../i18n/translate.pipe';

function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-lunch-section',
  standalone: true,
  imports: [
    KENDO_TIMEPICKER,
    SettingsSectionComponent,
    SettingRowComponent,
    ToggleComponent,
    NumberInputComponent,
    TranslatePipe,
  ],
  template: `
    <app-settings-section [title]="'lunch.sectionTitle' | t" iconBg="bg-orange-100 text-orange-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div header-extra>
        <app-toggle
          [checked]="draft.lunchEnabled()"
          activeClass="bg-orange-500"
          (changed)="draft.lunchEnabled.set($event)"
        />
      </div>

      <app-setting-row [label]="'lunch.hourLabel' | t" [hint]="'lunch.hourHint' | t">
        <kendo-timepicker
          #tp
          [value]="hourDate()"
          (valueChange)="onHourChange($event)"
          [format]="'HH:mm'"
          [steps]="{ hour: 1, minute: 15 }"
          [fillMode]="'outline'"
          [size]="'small'"
        ></kendo-timepicker>
      </app-setting-row>

      <app-setting-row [label]="'lunch.durationLabel' | t">
        <app-number-input
          [value]="draft.lunchDurationMin()"
          [min]="0" [max]="180"
          (changed)="draft.lunchDurationMin.set($event)"
        />
      </app-setting-row>
    </app-settings-section>
  `,
})
export class LunchSectionComponent implements AfterViewInit {
  @ViewChild('tp') tp!: TimePickerComponent;
  draft = inject(SettingsDraftService);
  private cdr = inject(ChangeDetectorRef);

  hourDate(): Date { return timeStringToDate(this.draft.lunchHour()); }

  onHourChange(d: Date | null): void {
    if (d) this.draft.lunchHour.set(dateToTimeString(d));
  }

  ngAfterViewInit(): void {
    if (this.tp) {
      this.tp.toggle(true);
      this.cdr.detectChanges();
      setTimeout(() => { this.tp.toggle(false); this.cdr.detectChanges(); }, 0);
    }
  }
}
