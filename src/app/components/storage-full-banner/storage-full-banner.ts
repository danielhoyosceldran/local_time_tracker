// src/app/components/storage-full-banner/storage-full-banner.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { StorageHealthService } from '../../services/storage-health.service';

/**
 * Warns that the browser refused to save a change (localStorage quota).
 * Mounted once at the app root; stays until dismissed.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-storage-full-banner',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (storage.full()) {
      <div role="alert"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,480px)] flex items-start gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-red-200 p-4">
        <div class="flex-1">
          <p class="text-sm font-semibold text-red-700">{{ 'storage.fullTitle' | t }}</p>
          <p class="mt-1 text-xs text-slate-600">{{ 'storage.fullBody' | t }}</p>
        </div>
        <button type="button" (click)="storage.dismiss()"
          class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">
          {{ 'storage.dismiss' | t }}
        </button>
      </div>
    }
  `,
})
export class StorageFullBannerComponent {
  protected storage = inject(StorageHealthService);
}
