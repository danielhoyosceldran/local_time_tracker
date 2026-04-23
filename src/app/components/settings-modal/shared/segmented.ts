import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SegmentedOption<T = string | number> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-segmented',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex rounded-lg bg-slate-100 p-0.5">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          (click)="changed.emit(opt.value)"
          class="px-3 py-1 text-xs font-medium rounded-md transition-all"
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
  changed = output<T>();
}
