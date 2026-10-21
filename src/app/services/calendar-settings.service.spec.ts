import { isSafeCalendarUrl } from './calendar-settings.service';

describe('isSafeCalendarUrl', () => {
  it('accepts https URLs', () => {
    expect(isSafeCalendarUrl('https://calendar.google.com/calendar/embed?src=x')).toBeTrue();
  });

  it('rejects script-capable or non-https schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://calendar.google.com/',
      'about:blank',
      'not a url',
      '',
    ]) {
      expect(isSafeCalendarUrl(url)).withContext(url).toBeFalse();
    }
  });
});
