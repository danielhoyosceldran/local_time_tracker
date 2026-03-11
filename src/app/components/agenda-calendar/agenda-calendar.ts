// src/app/components/agenda-calendar/agenda-calendar.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CalendarSettingsService } from '../../services/calendar-settings.service';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-agenda-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white border-r border-slate-200 h-full flex flex-col relative overflow-hidden">
      <div class="flex-1 flex flex-col p-4 overflow-hidden">
        <h3 class="text-slate-900 font-semibold mb-4">Google Calendar</h3>

        @if (calendarUrl$ | async; as url) {
          <iframe
            [src]="url"
            class="flex-1 w-full border-0 rounded-lg"
            title="Google Calendar"
          ></iframe>
        } @else {
          <div class="flex-1 flex items-center justify-center text-slate-500 text-center px-4">
            <p class="text-sm">No calendar URL configured. Click settings below to add one.</p>
          </div>
        }

        <!-- Settings Button -->
        <button
          (click)="openSettings()"
          class="mt-4 py-2 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Settings
        </button>
      </div>

      <!-- Settings Modal -->
      @if (showSettings()) {
        <div class="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-20">
          <div class="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-bold mb-4 text-slate-900">Calendar Settings</h3>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              Google Calendar Embed URL
            </label>
            <input
              type="text"
              [(ngModel)]="editingUrl"
              placeholder="https://calendar.google.com/..."
              class="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div class="flex gap-2 justify-end">
              <button
                (click)="showSettings.set(false)"
                class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                (click)="saveSettings()"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AgendaCalendarComponent {
  private calendarSettings = inject(CalendarSettingsService);
  private sanitizer = inject(DomSanitizer);

  isCollapsed = signal(false);
  showSettings = signal(false);
  editingUrl = signal('');

  calendarUrl$: Observable<SafeResourceUrl | null> = this.calendarSettings.calendarUrl$.pipe(
    map(url => url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null)
  );

  toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
  }

  openSettings(): void {
    this.calendarSettings.calendarUrl$.subscribe(url => {
      this.editingUrl.set(url);
      this.showSettings.set(true);
    }).unsubscribe();
  }

  saveSettings(): void {
    this.calendarSettings.save(this.editingUrl());
    this.showSettings.set(false);
  }
}
