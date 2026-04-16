import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SOUNDS, SoundId, playSound } from './sounds';

@Component({
  selector: 'app-sound-picker-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      (click)="onBackdrop($event)"
    >
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>

      <!-- Card -->
      <div
        class="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-64 overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <span class="text-sm font-semibold text-slate-800">{{ title() }}</span>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Sound list -->
        <div class="divide-y divide-slate-100">
          @for (s of sounds; track s.id) {
            <div
              class="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors"
              [class.bg-slate-50]="current() === s.id"
              (click)="select(s.id)"
            >
              <div class="flex items-center gap-3">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  [class.border-slate-300]="current() !== s.id"
                  [class.border-slate-800]="current() === s.id"
                >
                  @if (current() === s.id) {
                    <div class="w-2 h-2 rounded-full bg-slate-800"></div>
                  }
                </div>
                <span
                  class="text-sm transition-colors"
                  [class.font-semibold]="current() === s.id"
                  [class.text-slate-800]="current() === s.id"
                  [class.text-slate-600]="current() !== s.id"
                >{{ s.label }}</span>
              </div>

              @if (s.id !== 'none') {
                <button
                  type="button"
                  (click)="preview($event, s.id)"
                  class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
                  title="Preview"
                >
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-slate-100">
          <button
            type="button"
            (click)="closed.emit()"
            class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SoundPickerModalComponent {
  title  = input<string>('Select sound');
  current = input.required<SoundId>();

  soundSelected = output<SoundId>();
  closed        = output<void>();

  readonly sounds = SOUNDS;

  select(id: SoundId): void {
    this.soundSelected.emit(id);
  }

  preview(event: MouseEvent, id: SoundId): void {
    event.stopPropagation();
    playSound(id);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
