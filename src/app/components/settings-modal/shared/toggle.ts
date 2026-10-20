import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingRowComponent } from './setting-row';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label() || null"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="describedBy()"
      (click)="changed.emit(!checked())"
      class="relative w-10 h-5 rounded-full transition-colors duration-200 active:scale-95"
      [style.background-color]="checked() ? onColor() : 'var(--tt-toggle-off)'"
    >
      <span
        aria-hidden="true"
        class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200"
        style="background-color: var(--tt-toggle-knob)"
        [ngClass]="checked() ? 'translate-x-5' : 'translate-x-0'"
      ></span>
    </button>
  `,
})
export class ToggleComponent {
  checked = input.required<boolean>();
  tone = input<'default' | 'amber' | 'orange'>('default');
  /** Explicit accessible name; falls back to the enclosing setting row's label. */
  label = input<string>('');
  changed = output<boolean>();

  protected onColor = computed(() => {
    const t = this.tone();
    return t === 'default' ? 'var(--tt-toggle-on)' : `var(--tt-toggle-on-${t})`;
  });

  private row = inject(SettingRowComponent, { optional: true });
  protected labelledBy = computed(() => (this.label() ? null : (this.row?.labelId ?? null)));
  protected describedBy = computed(() => (this.row?.hint() ? this.row.hintId : null));
}
