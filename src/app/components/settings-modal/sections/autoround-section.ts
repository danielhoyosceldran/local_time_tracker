import { AfterViewInit, Component, ChangeDetectorRef, QueryList, ViewChildren, inject } from '@angular/core';
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
  selector: 'app-autoround-section',
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

      <app-setting-row
        [label]="'autoround.window' | t"
        [hint]="'autoround.windowHint' | t"
      >
        <app-toggle
          [checked]="draft.marginWindowEnabled()"
          activeClass="bg-amber-500"
          (changed)="draft.marginWindowEnabled.set($event)"
        />
      </app-setting-row>

      @if (draft.marginWindowEnabled()) {
        <app-setting-row [label]="'autoround.windowStart' | t">
          <kendo-timepicker
            [value]="startDate()"
            (valueChange)="onStartChange($event)"
            [format]="'HH:mm'"
            [steps]="{ hour: 1, minute: 15 }"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-timepicker>
        </app-setting-row>

        <app-setting-row [label]="'autoround.windowEnd' | t">
          <kendo-timepicker
            [value]="endDate()"
            (valueChange)="onEndChange($event)"
            [format]="'HH:mm'"
            [steps]="{ hour: 1, minute: 15 }"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-timepicker>
        </app-setting-row>
      }
    </app-settings-section>
  `,
})
export class AutoroundSectionComponent implements AfterViewInit {
  @ViewChildren(TimePickerComponent) pickers!: QueryList<TimePickerComponent>;
  draft = inject(SettingsDraftService);
  private cdr = inject(ChangeDetectorRef);

  startDate(): Date { return timeStringToDate(this.draft.marginWindowStart()); }
  endDate(): Date { return timeStringToDate(this.draft.marginWindowEnd()); }

  onStartChange(d: Date | null): void {
    if (d) this.draft.marginWindowStart.set(dateToTimeString(d));
  }

  onEndChange(d: Date | null): void {
    if (d) this.draft.marginWindowEnd.set(dateToTimeString(d));
  }

  ngAfterViewInit(): void {
    this.pickers.forEach(tp => this.primePicker(tp));
    this.pickers.changes.subscribe((list: QueryList<TimePickerComponent>) =>
      list.forEach(tp => this.primePicker(tp))
    );
  }

  // Same first-render workaround used by the lunch section: open then close the
  // popup once so Kendo lays it out correctly on first interaction.
  private primePicker(tp: TimePickerComponent): void {
    if (!tp) return;
    tp.toggle(true);
    this.cdr.detectChanges();
    setTimeout(() => { tp.toggle(false); this.cdr.detectChanges(); }, 0);
  }
}
