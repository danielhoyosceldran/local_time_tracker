// src/app/components/cloud-sync-indicator/cloud-sync-indicator.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations/en';
import { CloudSyncService } from '../../services/cloud/cloud-sync.service';

/** Small cloud icon with the sync state. Renders nothing while the app is local-only. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-cloud-sync-indicator',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (view(); as v) {
      <span class="inline-flex items-center" role="img" [attr.aria-label]="v.label | t" [title]="v.label | t" [class]="v.color">
        <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          [class.animate-pulse]="v.pulse">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 8 4.5 4.5 0 0117 17H7z"/>
          @if (v.slash) {
            <path stroke-linecap="round" d="M4 4l16 16"/>
          }
        </svg>
      </span>
    }
  `,
})
export class CloudSyncIndicatorComponent {
  private sync = inject(CloudSyncService);

  view = computed<{ label: TranslationKey; color: string; pulse: boolean; slash: boolean } | null>(() => {
    switch (this.sync.state()) {
      case 'disabled': return null;
      case 'synced': return { label: 'cloud.state.synced', color: 'text-emerald-600', pulse: false, slash: false };
      case 'syncing': return { label: 'cloud.state.syncing', color: 'text-indigo-500', pulse: true, slash: false };
      case 'pending': return { label: 'cloud.state.pending', color: 'text-indigo-500', pulse: false, slash: false };
      case 'offline': return { label: 'cloud.state.offline', color: 'text-slate-400', pulse: false, slash: true };
      case 'setup': return { label: 'cloud.state.setup', color: 'text-amber-500', pulse: false, slash: false };
      case 'error': return { label: 'cloud.state.error', color: 'text-red-500', pulse: false, slash: true };
    }
  });
}
