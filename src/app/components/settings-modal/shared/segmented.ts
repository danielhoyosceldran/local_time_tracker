import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingRowComponent } from './setting-row';

export interface SegmentedOption<T = string | number> {
  value: T;
  label: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-segmented',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="inline-flex rounded-lg bg-slate-100 p-0.5"
      role="group"
      [attr.aria-label]="label() || null"
      [attr.aria-labelledby]="labelledBy()"
    >
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          [attr.aria-pressed]="opt.value === value()"
          (click)="changed.emit(opt.value)"
          class="px-3 py-1 text-xs font-medium rounded-md transition"
          [ngClass]="opt.value === value()
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'"
        >{{ opt.label }}</button>
      }
    </div>
  `,
})
export class SegmentedComponent<T = string | number> {
  options = input.required<SegmentedOption<T>[]>();
  value = input.required<T>();
  /** Explicit accessible name; falls back to the enclosing setting row's label. */
  label = input<string>('');
  changed = output<T>();

  private row = inject(SettingRowComponent, { optional: true });
  protected labelledBy = computed(() => (this.label() ? null : (this.row?.labelId ?? null)));
}
