import { Component, HostListener, input, output } from '@angular/core';
import { ReleaseNote } from '../../services/release-notes';

@Component({
  selector: 'app-release-notes-modal',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      (click)="close.emit()"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(60vw,640px)] min-w-[320px] max-h-[80vh] flex flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/60 backdrop-blur-xl">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="text-sm font-semibold text-slate-700">What's new</span>
          </div>
          <button
            (click)="close.emit()"
            class="text-slate-400 hover:text-slate-600 transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto divide-y divide-slate-100">
          @for (release of releases(); track release.version) {
            <div class="px-5 py-4">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-md px-1.5 py-0.5">v{{ release.version }}</span>
                <span class="text-xs text-slate-400">{{ release.date }}</span>
              </div>
              <ul class="space-y-1.5">
                @for (note of release.notes; track $index) {
                  <li class="text-sm text-slate-600 flex gap-2">
                    <span class="text-slate-300 mt-0.5">•</span>{{ note }}
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <div class="px-5 py-3 border-t border-slate-100 flex justify-end shrink-0 bg-white/60 backdrop-blur-xl">
          <button
            (click)="close.emit()"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReleaseNotesModalComponent {
  releases = input.required<ReleaseNote[]>();
  close = output<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close.emit();
  }
}
