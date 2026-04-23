import { Component, input } from '@angular/core';

@Component({
  selector: 'app-setting-row',
  standalone: true,
  template: `
    <div class="flex items-center justify-between gap-4 py-2">
      <div class="min-w-0">
        <div class="text-sm text-slate-700">{{ label() }}</div>
        @if (hint()) {
          <div class="text-[11px] text-slate-400 leading-tight mt-0.5">{{ hint() }}</div>
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
}
