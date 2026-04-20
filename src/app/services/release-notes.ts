import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ReleaseNote {
  version: string;
  date: string;
  notes: string[];
}

const LS_KEY = 'release-notes-last-seen';

@Injectable({ providedIn: 'root' })
export class ReleaseNotesService {
  private http = inject(HttpClient);

  releases = signal<ReleaseNote[]>([]);
  hasUnread = signal(false);

  load(): void {
    this.http.get<ReleaseNote[]>('assets/release-notes.json').subscribe(data => {
      this.releases.set(data);
      const lastSeen = localStorage.getItem(LS_KEY);
      this.hasUnread.set(lastSeen !== data[0]?.version);
    });
  }

  markAllRead(): void {
    const latest = this.releases()[0]?.version;
    if (latest) {
      localStorage.setItem(LS_KEY, latest);
      this.hasUnread.set(false);
    }
  }
}
