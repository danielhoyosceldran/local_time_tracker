import { Component, inject, output } from '@angular/core';
import { ReleaseNotesService } from '../../services/release-notes';

@Component({
  selector: 'app-release-notes-panel',
  standalone: true,
  template: `
    <div class="fixed top-12 right-4 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 z-50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span class="text-sm font-semibold text-slate-700">What's new</span>
        <button (click)="close.emit()" class="text-slate-400 hover:text-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-slate-100">
        @for (release of svc.releases(); track release.version) {
          <div class="px-4 py-3">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-md px-1.5 py-0.5">v{{ release.version }}</span>
              <span class="text-xs text-slate-400">{{ release.date }}</span>
            </div>
            <ul class="space-y-1">
              @for (note of release.notes; track note) {
                <li class="text-xs text-slate-600 flex gap-1.5">
                  <span class="text-slate-300 mt-0.5">•</span>{{ note }}
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
})
export class ReleaseNotesPanelComponent {
  svc = inject(ReleaseNotesService);
  close = output<void>();
}
