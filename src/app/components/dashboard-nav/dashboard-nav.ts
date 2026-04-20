import { Component, inject, OnInit, signal } from '@angular/core';
import { ReleaseNotesService } from '../../services/release-notes';
import { ReleaseNotesPanelComponent } from '../release-notes-panel/release-notes-panel';

@Component({
  selector: 'app-dashboard-nav',
  standalone: true,
  imports: [ReleaseNotesPanelComponent],
  template: `
    <div class="h-full grid grid-cols-5 gap-4">
      <!-- Left section: col-1, aligned with holiday calendar -->
      <div class="col-span-1 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white"></div>

      <!-- Right section: cols 2-5 -->
      <div class="col-span-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white flex items-center justify-end px-4 gap-3">

        <a
          href="https://github.com/danielhoyosceldran/local_time_tracker"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          danielhoyosceldran/local_time_tracker
        </a>

        <!-- What's new button -->
        <button
          (click)="togglePanel()"
          class="relative flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          @if (svc.hasUnread()) {
            <span class="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
          }
        </button>

      </div>
    </div>

    @if (panelOpen()) {
      <app-release-notes-panel [releases]="svc.releases()" (close)="closePanel()" />
    }
  `,
})
export class DashboardNavComponent implements OnInit {
  svc = inject(ReleaseNotesService);
  panelOpen = signal(false);

  ngOnInit(): void {
    this.svc.load();
  }

  togglePanel(): void {
    this.panelOpen.update(v => !v);
    if (this.panelOpen()) this.svc.markAllRead();
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }
}
