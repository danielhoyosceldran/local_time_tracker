import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayOfWeek, TimeFormat } from '../../../services/settings.service';
import { SettingsDraftService } from '../../../services/settings-draft.service';
import { SettingsSectionComponent } from '../shared/section';
import { SettingRowComponent } from '../shared/setting-row';
import { NumberInputComponent } from '../shared/number-input';
import { SegmentedComponent, SegmentedOption } from '../shared/segmented';
import { ToggleComponent } from '../shared/toggle';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

@Component({
  selector: 'app-workday-section',
  standalone: true,
  imports: [
    CommonModule,
    SettingsSectionComponent,
    SettingRowComponent,
    NumberInputComponent,
    SegmentedComponent,
    ToggleComponent,
  ],
  template: `
    <app-settings-section title="Workday" iconBg="bg-slate-900 text-white">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>

      <app-setting-row label="Target hours / day" hint="Used by auto-round and daily progress.">
        <app-number-input
          [value]="draft.workdayHours()"
          [min]="0.5" [max]="24" [step]="0.5"
          (changed)="draft.workdayHours.set($event)"
        />
      </app-setting-row>

      <app-setting-row label="Weekly target (h)" hint="Baseline for weekly summary.">
        <app-number-input
          [value]="draft.weeklyTargetHours()"
          [min]="0" [max]="168"
          (changed)="draft.weeklyTargetHours.set($event)"
        />
      </app-setting-row>

      <app-setting-row label="Workdays" hint="Days counted as working.">
        <div class="flex gap-1">
          @for (d of dayIndexes; track d) {
            <button
              type="button"
              (click)="draft.toggleWorkday(d)"
              class="w-7 h-7 rounded-full text-[11px] font-semibold transition-colors"
              [ngClass]="isSelected(d)
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
            >{{ label(d) }}</button>
          }
        </div>
      </app-setting-row>

      <app-setting-row label="First day of week">
        <app-segmented
          [options]="firstDayOptions"
          [value]="draft.firstDayOfWeek()"
          (changed)="draft.firstDayOfWeek.set($any($event))"
        />
      </app-setting-row>

      <app-setting-row label="Time format">
        <app-segmented
          [options]="timeFormatOptions"
          [value]="draft.timeFormat()"
          (changed)="draft.timeFormat.set($any($event))"
        />
      </app-setting-row>

      <app-setting-row label="Show expected hours line" hint="Overlay expected hours per period on the chart.">
        <app-toggle
          [checked]="draft.showExpectedLine()"
          (changed)="draft.showExpectedLine.set($event)"
        />
      </app-setting-row>

      <app-setting-row label="Truncate worked line at today" hint="Stop the worked-hours line on today instead of drawing future days.">
        <app-toggle
          [checked]="draft.truncateWorkedAtToday()"
          (changed)="draft.truncateWorkedAtToday.set($event)"
        />
      </app-setting-row>
    </app-settings-section>
  `,
})
export class WorkdaySectionComponent {
  draft = inject(SettingsDraftService);

  readonly dayIndexes: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
  readonly firstDayOptions: SegmentedOption<DayOfWeek>[] = [
    { value: 1, label: 'Mon' },
    { value: 0, label: 'Sun' },
  ];
  readonly timeFormatOptions: SegmentedOption<TimeFormat>[] = [
    { value: '24h', label: '24h' },
    { value: '12h', label: '12h' },
  ];

  label(d: DayOfWeek): string { return DAY_LABELS[d]; }
  isSelected(d: DayOfWeek): boolean { return this.draft.workdays().includes(d); }
}
