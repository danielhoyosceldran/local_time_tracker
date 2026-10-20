import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingRowComponent } from './setting-row';

@Component({
  selector: 'app-number-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input
      type="number"
      inputmode="decimal"
      [ngModel]="value()"
      (ngModelChange)="changed.emit($event)"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [attr.aria-label]="label() || null"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="describedBy()"
      class="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center"
    />
  `,
})
export class NumberInputComponent {
  value = input.required<number>();
  min = input<number | null>(null);
  max = input<number | null>(null);
  step = input<number>(1);
  /** Explicit accessible name; falls back to the enclosing setting row's label. */
  label = input<string>('');
  changed = output<number>();

  private row = inject(SettingRowComponent, { optional: true });
  protected labelledBy = computed(() => (this.label() ? null : (this.row?.labelId ?? null)));
  protected describedBy = computed(() => (this.row?.hint() ? this.row.hintId : null));
}
