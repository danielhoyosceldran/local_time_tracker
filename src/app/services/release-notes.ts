import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ReleaseNote {
  version: string;
  date: string;
  notes: string[];
}

const LS_KEY_LAST_READ = 'release-notes-last-seen';
const LS_KEY_LATEST = 'release-notes-latest-available';

@Injectable({ providedIn: 'root' })
export class ReleaseNotesService {
  private http = inject(HttpClient);

  releases = signal<ReleaseNote[]>([]);
  unreadReleases = signal<ReleaseNote[]>([]);
  hasUnread = signal(false);

  load(): void {
    this.http.get<ReleaseNote[]>('release-notes.json').subscribe(data => {
      this.releases.set(data);

      const latest = data[0]?.version ?? '';
      if (latest) {
        localStorage.setItem(LS_KEY_LATEST, latest);
      }

      const lastRead = localStorage.getItem(LS_KEY_LAST_READ);
      const lastReadIndex = lastRead ? data.findIndex(r => r.version === lastRead) : -1;
      const unread = lastReadIndex === -1 ? data : data.slice(0, lastReadIndex);

      this.unreadReleases.set(unread);
      this.hasUnread.set(unread.length > 0);
    });
  }

  markAllRead(): void {
    const latest = this.releases()[0]?.version;
    if (latest) {
      localStorage.setItem(LS_KEY_LAST_READ, latest);
      this.unreadReleases.set([]);
      this.hasUnread.set(false);
    }
  }
}
