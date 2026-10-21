// src/app/components/cloud-first-connection/cloud-first-connection.ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TimeEntryService } from '../../services/time-entry';
import { CloudSyncService, FirstConnectionChoice } from '../../services/cloud/cloud-sync.service';

/**
 * Shown the first time a device with local data signs in to an account:
 * upload it, merge it with the cloud, or (if the data belongs to another
 * account) wipe it. Offers a JSON backup first. Mounted once at the app root.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-cloud-first-connection',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  template: `
    @if (sync.firstConnection(); as fc) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true"></div>
        <div role="dialog" aria-modal="true" aria-labelledby="cloud-first-title"
          class="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(92vw,440px)] p-6">
          @switch (fc.kind) {
            @case ('upload') {
              <h2 id="cloud-first-title" class="text-base font-bold text-slate-800">{{ 'cloud.first.uploadTitle' | t }}</h2>
              <p class="mt-2 text-xs text-slate-500">{{ 'cloud.first.uploadBody' | t: { n: fc.localCount } }}</p>
            }
            @case ('merge') {
              <h2 id="cloud-first-title" class="text-base font-bold text-slate-800">{{ 'cloud.first.mergeTitle' | t }}</h2>
              <p class="mt-2 text-xs text-slate-500">{{ 'cloud.first.mergeBody' | t: { local: fc.localCount, remote: fc.remoteCount } }}</p>
              <fieldset class="mt-4 space-y-1.5 text-xs text-slate-700">
                <legend class="font-medium mb-1">{{ 'cloud.first.settingsQuestion' | t }}</legend>
                <label class="flex items-center gap-2">
                  <input type="radio" name="settingsFrom" value="cloud" [ngModel]="settingsFrom()" (ngModelChange)="settingsFrom.set($event)" />
                  {{ 'cloud.first.settingsCloud' | t }}
                </label>
                <label class="flex items-center gap-2">
                  <input type="radio" name="settingsFrom" value="local" [ngModel]="settingsFrom()" (ngModelChange)="settingsFrom.set($event)" />
                  {{ 'cloud.first.settingsLocal' | t }}
                </label>
              </fieldset>
            }
            @case ('foreign') {
              <h2 id="cloud-first-title" class="text-base font-bold text-slate-800">{{ 'cloud.first.foreignTitle' | t }}</h2>
              <p class="mt-2 text-xs text-slate-500">{{ 'cloud.first.foreignBody' | t }}</p>
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
            @switch (fc.kind) {
              @case ('upload') {
                <button type="button" (click)="choose({ kind: 'upload' })" [disabled]="busy()" [class]="primaryBtn">{{ 'cloud.first.uploadBtn' | t }}</button>
              }
              @case ('merge') {
                <button type="button" (click)="choose({ kind: 'merge', settingsFrom: settingsFrom() })" [disabled]="busy()" [class]="primaryBtn">{{ 'cloud.first.mergeBtn' | t }}</button>
              }
              @case ('foreign') {
                <button type="button" (click)="choose({ kind: 'wipeLocal' })" [disabled]="busy()"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
                  {{ 'cloud.first.wipeBtn' | t }}
                </button>
              }
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

  readonly primaryBtn = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50';

  settingsFrom = signal<'cloud' | 'local'>('cloud');
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
    const blob = new Blob([this.time.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
