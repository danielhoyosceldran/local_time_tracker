import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';
import { formatClockTime } from '../utils/format';

/**
 * Formats a wall-clock time (hour of day) respecting the user's 12h/24h
 * setting. Impure so it re-renders when the setting changes.
 *
 * Usage: {{ entry.startTime | clockTime }}
 * Use for any clock time shown to the user — NOT for durations/timers.
 */
@Pipe({
  name: 'clockTime',
  standalone: true,
  pure: false,
})
export class ClockTimePipe implements PipeTransform {
  private settings = inject(SettingsService);

  transform(value: Date | number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    return formatClockTime(value, this.settings.timeFormat());
  }
}
