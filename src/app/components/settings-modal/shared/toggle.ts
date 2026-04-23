import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="changed.emit(!checked())"
      class="relative w-10 h-5 rounded-full transition-colors duration-200 active:scale-95"
      [ngClass]="checked() ? activeClass() : 'bg-slate-300'"
    >
      <span
        class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        [ngClass]="checked() ? 'translate-x-5' : 'translate-x-0'"
      ></span>
    </button>
  `,
})
export class ToggleComponent {
  checked = input.required<boolean>();
  activeClass = input<string>('bg-slate-800');
  changed = output<boolean>();
}
