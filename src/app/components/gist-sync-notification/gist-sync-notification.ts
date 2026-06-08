// src/app/components/gist-sync-notification/gist-sync-notification.ts
import { Component, inject, signal } from '@angular/core';
import { GistSyncService } from '../../services/gist-sync.service';
import { TimeEntryService } from '../../services/time-entry';
import { DataRefreshService } from '../../services/data-refresh.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Global, non-destructive prompt shown on app open when the cloud gist holds
 * MORE entries than localStorage. Offers to bring the remote data in; otherwise
 * localStorage is left untouched. Mounted once at the app root.
 */
@Component({
  selector: 'app-gist-sync-notification',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (gist.pendingRemote(); as p) {
      <div class="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)]">
        <div class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 p-4">
          <div class="flex items-start gap-2.5">
            <span class="mt-0.5 w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 inline-flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6 4.5 4.5 0 0117 15h-1m-4-3v6m0-6l-2.5 2.5M12 9l2.5 2.5"/>
              </svg>
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800">{{ 'gistSync.notifTitle' | t }}</p>
              <p class="text-[12px] text-slate-500 leading-snug mt-0.5">
                {{ 'gistSync.notifBody' | t: { remote: p.remoteCount, local: p.localCount } }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              (click)="gist.dismissPending()"
              [disabled]="busy()"
              class="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >{{ 'gistSync.dismissBtn' | t }}</button>
            <button
              type="button"
              (click)="bring()"
              [disabled]="busy()"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >{{ 'gistSync.bringBtn' | t }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GistSyncNotificationComponent {
  protected gist = inject(GistSyncService);
  private time = inject(TimeEntryService);
  private dataRefresh = inject(DataRefreshService);

  busy = signal(false);

  /** Import the staged remote payload into localStorage and refresh the UI live. */
  async bring(): Promise<void> {
    const pending = this.gist.pendingRemote();
    if (!pending || this.busy()) return;
    this.busy.set(true);
    try {
      // Reuse the existing import path; importAll only reads `.data`.
      this.time.importAll(JSON.stringify(pending.payload));
      await this.dataRefresh.refreshAll();
      this.gist.dismissPending();
    } finally {
      this.busy.set(false);
    }
  }
}
