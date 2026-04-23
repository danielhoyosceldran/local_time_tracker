import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input
      type="number"
      [ngModel]="value()"
      (ngModelChange)="changed.emit($event)"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      class="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
    />
  `,
})
export class NumberInputComponent {
  value = input.required<number>();
  min = input<number | null>(null);
  max = input<number | null>(null);
  step = input<number>(1);
  changed = output<number>();
}
