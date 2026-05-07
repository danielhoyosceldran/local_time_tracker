// src/app/app.component.ts
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeEntryService } from './services/time-entry';
import { formatDuration } from './utils/format';
import { SoundPickerHostComponent } from './shared/sound-picker-host';
import { TranslationService } from './i18n';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SoundPickerHostComponent],
  template: `
    <router-outlet />
    <app-sound-picker-host />
  `,
})
export class AppComponent implements OnInit {
  private titleService = inject(Title);
  private timeEntryService = inject(TimeEntryService);
  private destroyRef = inject(DestroyRef);
  private translation = inject(TranslationService);

  ngOnInit(): void {
    this.timeEntryService.liveTodaySummary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(summary => {
        const duration = summary ? formatDuration(summary.totalDurationMs) : '00:00:00';
        this.titleService.setTitle(`${duration} — ${this.translation.t('app.title')}`);
      });
  }
}
