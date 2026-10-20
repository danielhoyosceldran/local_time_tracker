import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextRowId = 0;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-setting-row',
  standalone: true,
  template: `
    <div class="flex items-center justify-between gap-4 py-2">
      <div class="min-w-0">
        <div [id]="labelId" class="text-sm text-slate-700">{{ label() }}</div>
        @if (hint()) {
          <div [id]="hintId" class="text-[11px] text-slate-500 leading-tight mt-0.5">{{ hint() }}</div>
        }
      </div>
      <div class="shrink-0">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class SettingRowComponent {
  label = input.required<string>();
  hint = input<string>('');

  /** Ids the projected control (toggle, number input, segmented) points at. */
  readonly labelId = `setting-row-label-${nextRowId}`;
  readonly hintId = `setting-row-hint-${nextRowId++}`;
}
