import { Component, HostListener, OnInit, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsDraftService } from '../../services/settings-draft.service';
import { WorkdaySectionComponent } from './sections/workday-section';
import { AutoroundSectionComponent } from './sections/autoround-section';
import { LunchSectionComponent } from './sections/lunch-section';
import { PomodoroSectionComponent } from './sections/pomodoro-section';
import { DataSectionComponent } from './sections/data-section';
import { GeneralSectionComponent } from './sections/general-section';
import { TranslationService } from '../../i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';

type TabId = 'general' | 'schedule' | 'tracking' | 'focus' | 'data';

interface Tab {
  id: TabId;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [
    CommonModule,
    WorkdaySectionComponent,
    AutoroundSectionComponent,
    LunchSectionComponent,
    PomodoroSectionComponent,
    DataSectionComponent,
    GeneralSectionComponent,
    TranslatePipe,
  ],
  template: `
    <div
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      (click)="onCancel()"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(60vw,900px)] min-w-[50vw] h-[min(80vh,700px)] flex flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/60 backdrop-blur-xl">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span class="text-sm font-semibold text-slate-700">{{ 'settings.title' | t }}</span>
          </div>
          <button
            (click)="onCancel()"
            class="text-slate-400 hover:text-slate-600 transition-colors"
            [attr.aria-label]="'common.close' | t"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Body: sidebar + panel -->
        <div class="flex flex-1 min-h-0">

          <!-- Sidebar -->
          <nav class="w-56 shrink-0 border-r border-slate-100 bg-slate-50/60 p-3 overflow-y-auto">
            <ul class="space-y-1">
              @for (tab of tabs; track tab.id) {
                <li>
                  <button
                    type="button"
                    (click)="active.set(tab.id)"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2.5"
                    [ngClass]="active() === tab.id
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:bg-white/60'"
                  >
                    <span
                      class="mt-0.5 w-6 h-6 rounded-md inline-flex items-center justify-center shrink-0"
                      [ngClass]="active() === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-500'"
                      [innerHTML]="tab.icon"
                    ></span>
                    <span class="flex flex-col">
                      <span class="text-sm font-medium">{{ tab.labelKey | t }}</span>
                      <span class="text-[11px] text-slate-400 leading-tight">{{ tab.descriptionKey | t }}</span>
                    </span>
                  </button>
                </li>
              }
            </ul>
          </nav>

          <!-- Active tab panel -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            @switch (active()) {
              @case ('general') {
                <div class="space-y-10">
                  <app-general-section class="block" />
                </div>
              }
              @case ('schedule') {
                <div class="space-y-10">
                  <app-workday-section class="block" />
                </div>
              }
              @case ('tracking') {
                <div class="space-y-10">
                  <app-autoround-section class="block" />
                  <app-lunch-section class="block" />
                </div>
              }
              @case ('focus') {
                <div class="space-y-10">
                  <app-pomodoro-section class="block" />
                </div>
              }
              @case ('data') {
                <div class="space-y-10">
                  <app-data-section class="block" />
                </div>
              }
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-white/60 backdrop-blur-xl">
          <button
            type="button"
            (click)="onCancel()"
            class="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >{{ 'common.cancel' | t }}</button>
          <button
            type="button"
            (click)="onSave()"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all"
          >{{ 'common.save' | t }}</button>
        </div>
      </div>
    </div>
  `,
})
export class SettingsModalComponent implements OnInit {
  close = output<void>();
  draft = inject(SettingsDraftService);
  private translation = inject(TranslationService);

  active = signal<TabId>('general');

  async ngOnInit(): Promise<void> {
    await this.draft.load();
  }

  onSave(): void {
    this.draft.apply();
    this.close.emit();
  }

  onCancel(): void {
    this.close.emit();
  }

  readonly tabs: Tab[] = [
    {
      id: 'general',
      labelKey: 'settings.tab.general',
      descriptionKey: 'settings.tab.generalDesc',
      icon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5h18M3 12h12M3 19h18"/></svg>`,
    },
    {
      id: 'schedule',
      labelKey: 'settings.tab.schedule',
      descriptionKey: 'settings.tab.scheduleDesc',
      icon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
    },
    {
      id: 'tracking',
      labelKey: 'settings.tab.tracking',
      descriptionKey: 'settings.tab.trackingDesc',
      icon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    },
    {
      id: 'focus',
      labelKey: 'settings.tab.focus',
      descriptionKey: 'settings.tab.focusDesc',
      icon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
    },
    {
      id: 'data',
      labelKey: 'settings.tab.data',
      descriptionKey: 'settings.tab.dataDesc',
      icon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7l3-3h10l3 3M4 7h16M9 12h6"/></svg>`,
    },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onCancel();
  }
}
