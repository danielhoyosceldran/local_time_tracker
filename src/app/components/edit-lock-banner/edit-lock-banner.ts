// src/app/components/edit-lock-banner/edit-lock-banner.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';
import { CloudSyncService } from '../../services/cloud/cloud-sync.service';
import { DeviceIdentityService } from '../../services/device-identity.service';
import { WriteAccessService } from '../../services/write-access.service';

/**
 * Says that this instance is read-only because another one holds the edit
 * lock (with a "take control" button), and that local changes were
 * discarded after losing it (with their backup). Mounted once at the app root.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-edit-lock-banner',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (reader(); as r) {
      <div role="status"
        class="fixed top-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,560px)] flex items-start gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 px-4 py-3 transition-shadow"
        [class.ring-2]="flash()" [class.ring-amber-500]="flash()">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-amber-700">{{ 'lock.readOnlyTitle' | t }}</p>
          <p class="mt-0.5 text-xs text-slate-600">{{ r }}</p>
        </div>
        <button type="button" (click)="takeControl()" [disabled]="busy()"
          class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition disabled:opacity-50">
          {{ 'lock.takeControl' | t }}
        </button>
      </div>
    }
    @if (sync.discardedAt(); as at) {
      <div role="alert"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,480px)] flex items-start gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-red-200 p-4">
        <div class="flex-1">
          <p class="text-sm font-semibold text-red-700">{{ 'lock.discardedTitle' | t }}</p>
          <p class="mt-1 text-xs text-slate-600">{{ 'lock.discardedBody' | t: { date: formatDate(at) } }}</p>
          <div class="mt-2 flex gap-2">
            <button type="button" (click)="sync.downloadDiscarded()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
              {{ 'lock.discardedDownload' | t }}
            </button>
            <button type="button" (click)="sync.dismissDiscarded()"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">
              {{ 'lock.discardedDismiss' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EditLockBannerComponent {
  protected sync = inject(CloudSyncService);
  private access = inject(WriteAccessService);
  private device = inject(DeviceIdentityService);
  private translation = inject(TranslationService);

  busy = signal(false);
  /** Briefly highlights the banner when a change was refused. */
  flash = signal(false);

  /** The banner text, or null when this instance can write. */
  reader = computed(() => {
    const state = this.access.state();
    if (state.kind !== 'reader') return null;
    const holder = state.holder;
    if (!holder) return this.translation.t('lock.readOnlyUnknown');
    if (holder.deviceId === this.device.deviceId) return this.translation.t('lock.readOnlySameDevice');
    return this.translation.t('lock.readOnlyBody', { device: holder.deviceName, browser: holder.browser });
  });

  constructor() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      if (!this.access.refused()) return;
      this.flash.set(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => this.flash.set(false), 1200);
    });
  }

  async takeControl(): Promise<void> {
    if (!confirm(this.translation.t('lock.takeControlConfirm'))) return;
    this.busy.set(true);
    try {
      await this.sync.takeControl();
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(at: number): string {
    return new Date(at).toLocaleString(this.translation.language());
  }
}
