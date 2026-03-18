// src/app/app.component.ts
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeEntryService } from './services/time-entry';
import { formatDuration } from './utils/format';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private titleService = inject(Title);
  private timeEntryService = inject(TimeEntryService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.timeEntryService.liveTodaySummary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(summary => {
        const duration = summary ? formatDuration(summary.totalDurationMs) : '00:00:00';
        this.titleService.setTitle(`${duration} — Time Tracker`);
      });
  }
}
