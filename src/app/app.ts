// src/app/app.component.ts
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeEntryService } from './services/time-entry';
import { formatDuration } from './utils/format';
import { SoundPickerHostComponent } from './shared/sound-picker-host';
import { TranslationService } from './i18n';
import { ThemeService } from './services/theme.service';
import { CloudSyncService } from './services/cloud/cloud-sync.service';
import { CloudFirstConnectionComponent } from './components/cloud-first-connection/cloud-first-connection';
import { StorageFullBannerComponent } from './components/storage-full-banner/storage-full-banner';
import { EditLockBannerComponent } from './components/edit-lock-banner/edit-lock-banner';
import { markMotionReady } from './shared/enter-motion.directive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SoundPickerHostComponent, CloudFirstConnectionComponent, StorageFullBannerComponent, EditLockBannerComponent],
  template: `
    <router-outlet />
    <app-sound-picker-host />
    <app-cloud-first-connection />
    <app-storage-full-banner />
    <app-edit-lock-banner />
  `,
})
export class AppComponent implements OnInit {
  private titleService = inject(Title);
  private timeEntryService = inject(TimeEntryService);
  private destroyRef = inject(DestroyRef);
  private translation = inject(TranslationService);
  private theme = inject(ThemeService);
  private cloudSync = inject(CloudSyncService);

  constructor() {
    // Entrance motion is for state changes, not for the page appearing.
    afterNextRender(() => setTimeout(markMotionReady));
  }

  ngOnInit(): void {
    // The GitHub Gist sync was replaced by Supabase; drop its stale config (and token).
    localStorage.removeItem('gistConfig');
    // Restores a Supabase session if there is one; without it the app stays 100% local.
    void this.cloudSync.start();

    this.timeEntryService.liveTodaySummary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(summary => {
        const duration = summary ? formatDuration(summary.totalDurationMs) : '00:00:00';
        this.titleService.setTitle(`${duration} — ${this.translation.t('app.title')}`);
      });
  }
}
