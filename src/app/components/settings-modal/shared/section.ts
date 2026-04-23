import { Component, input } from '@angular/core';

@Component({
  selector: 'app-settings-section',
  standalone: true,
  template: `
    <section>
      <div class="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="inline-flex w-6 h-6 items-center justify-center rounded-md" [class]="iconBg()">
            <ng-content select="[icon]"></ng-content>
          </span>
          <h4 class="text-sm font-semibold text-slate-800">{{ title() }}</h4>
        </div>
        <ng-content select="[header-extra]"></ng-content>
      </div>
      <div class="mt-0 divide-y divide-slate-50">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class SettingsSectionComponent {
  title = input.required<string>();
  iconBg = input<string>('bg-slate-100 text-slate-600');
}
