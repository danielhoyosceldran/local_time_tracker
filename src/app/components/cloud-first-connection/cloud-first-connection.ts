// src/app/components/cloud-first-connection/cloud-first-connection.ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TimeEntryService } from '../../services/time-entry';
import { CloudSyncService, FirstConnectionChoice } from '../../services/cloud/cloud-sync.service';
import { downloadBackup } from '../../utils/download';

/**
 * Shown when a device with local data signs in to an account its copy is not
 * bound to. The cloud becomes the source of truth, so the two copies are
 * never mixed: the user picks which one replaces the other. If another
 * instance holds the edit lock, this one can only read, so the only option is
 * to load the cloud. Offers a JSON backup first. Mounted once at the app root.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-cloud-first-connection',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (sync.firstConnection(); as fc) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true"></div>
        <div role="dialog" aria-modal="true" aria-labelledby="cloud-first-title"
          class="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(92vw,480px)] p-6">
          @switch (fc.kind) {
            @case ('choose') {
              <h2 id="cloud-first-title" class="text-base font-bold text-slate-800">{{ 'cloud.first.chooseTitle' | t }}</h2>
              <p class="mt-2 text-xs text-slate-500">{{ 'cloud.first.chooseBody' | t: { local: fc.localCount, remote: fc.remoteCount } }}</p>
              @if (fc.foreign) {
                <p class="mt-2 text-xs font-medium text-amber-700">{{ 'cloud.first.foreignWarning' | t }}</p>
              }
              <div class="mt-4 space-y-2">
                <button type="button" (click)="choose({ kind: 'toLocal' })" [disabled]="busy()" [class]="optionBtn">
                  <span class="block text-sm font-semibold text-slate-800">{{ 'cloud.first.toLocalBtn' | t }}</span>
                  <span class="block mt-0.5 text-xs text-slate-500">{{ 'cloud.first.toLocalHint' | t }}</span>
                </button>
                <button type="button" (click)="choose({ kind: 'toCloud' })" [disabled]="busy()" [class]="optionBtn">
                  <span class="block text-sm font-semibold text-slate-800">{{ 'cloud.first.toCloudBtn' | t }}</span>
                  <span class="block mt-0.5 text-xs text-slate-500">
                    {{ (fc.remoteCount === 0 ? 'cloud.first.toCloudEmptyHint' : 'cloud.first.toCloudHint') | t }}
                  </span>
                </button>
              </div>
            }
            @case ('reader') {
              <h2 id="cloud-first-title" class="text-base font-bold text-slate-800">{{ 'cloud.first.readerTitle' | t }}</h2>
              <p class="mt-2 text-xs text-slate-500">
                {{ 'cloud.first.readerBody' | t: { device: fc.holder?.deviceName ?? '?', n: fc.localCount } }}
              </p>
            }
          }

          <button type="button" (click)="exportBackup()"
            class="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
            {{ 'cloud.first.backupBtn' | t }}
          </button>

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" (click)="choose({ kind: 'cancel' })" [disabled]="busy()"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50">
              {{ 'cloud.first.cancelBtn' | t }}
            </button>
            @if (fc.kind === 'reader') {
              <button type="button" (click)="choose({ kind: 'toLocal' })" [disabled]="busy()"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                {{ 'cloud.first.readerBtn' | t }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CloudFirstConnectionComponent {
  protected sync = inject(CloudSyncService);
  private time = inject(TimeEntryService);

  readonly optionBtn = 'w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 active:scale-[0.99] transition-all disabled:opacity-50';

  busy = signal(false);

  async choose(choice: FirstConnectionChoice): Promise<void> {
    this.busy.set(true);
    try {
      await this.sync.resolveFirstConnection(choice);
    } finally {
      this.busy.set(false);
    }
  }

  exportBackup(): void {
    downloadBackup(this.time.exportAll());
  }
}
