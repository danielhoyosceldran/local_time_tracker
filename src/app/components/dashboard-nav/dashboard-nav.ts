import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ReleaseNote, ReleaseNotesService } from '../../services/release-notes';
import { ReleaseNotesPanelComponent } from '../release-notes-panel/release-notes-panel';
import { ReleaseNotesModalComponent } from '../release-notes-modal/release-notes-modal';
import { SettingsModalComponent } from '../settings-modal/settings-modal';
import { ViewStateService, LeftPanelTab } from '../../services/view-state.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-dashboard-nav',
  standalone: true,
  imports: [ReleaseNotesPanelComponent, ReleaseNotesModalComponent, SettingsModalComponent, TranslatePipe],
  template: `
    <div class="h-full grid grid-cols-5 gap-4">
      <!-- Left section: col-1, aligned with holiday calendar -->
      <div class="col-span-1 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white flex items-center px-2 gap-1">
        <button
          (click)="setTab('calendar')"
          [class]="tabClass('calendar')"
        >
          {{ 'nav.calendar' | t }}
        </button>
        <button
          (click)="setTab('intervals')"
          [class]="tabClass('intervals')"
        >
          {{ 'nav.intervals' | t }}
        </button>
      </div>

      <!-- Right section: cols 2-5 -->
      <div class="col-span-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white flex items-center px-4 gap-3">

        <!-- Settings button -->
        <button
          (click)="toggleSettings()"
          class="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
          [attr.title]="'nav.settings' | t"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <div class="ml-auto flex items-center gap-3">

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
          <span>{{ 'nav.whatsNew' | t }}</span>
          @if (svc.hasUnread()) {
            <span class="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
          }
        </button>

        </div>
      </div>
    </div>

    @if (panelOpen()) {
      <app-release-notes-panel [releases]="svc.releases()" (close)="closePanel()" />
    }
    @if (modalOpen()) {
      <app-release-notes-modal [releases]="modalReleases()" (close)="closeModal()" />
    }
    @if (settingsOpen()) {
      <app-settings-modal (close)="closeSettings()" />
    }
  `,
})
export class DashboardNavComponent implements OnInit {
  svc = inject(ReleaseNotesService);
  viewState = inject(ViewStateService);
  panelOpen = signal(false);
  settingsOpen = signal(false);
  modalOpen = signal(false);
  modalReleases = signal<ReleaseNote[]>([]);
  private modalShown = false;

  constructor() {
    effect(() => {
      const unread = this.svc.unreadReleases();
      if (!this.modalShown && unread.length > 0) {
        this.modalShown = true;
        this.modalReleases.set(unread);
        this.modalOpen.set(true);
      }
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.svc.markAllRead();
  }

  setTab(tab: LeftPanelTab): void {
    this.viewState.setTab(tab);
  }

  tabClass(tab: LeftPanelTab): string {
    const base = 'flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors';
    return this.viewState.activeTab() === tab
      ? `${base} bg-indigo-100 text-indigo-700`
      : `${base} text-slate-500 hover:text-slate-800 hover:bg-slate-100`;
  }

  toggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

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
