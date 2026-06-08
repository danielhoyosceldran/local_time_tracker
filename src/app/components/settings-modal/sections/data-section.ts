import { Component, inject, signal } from '@angular/core';
import { TimeEntryService } from '../../../services/time-entry';
import { DataRefreshService } from '../../../services/data-refresh.service';
import { SettingsSectionComponent } from '../shared/section';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n';

@Component({
  selector: 'app-data-section',
  standalone: true,
  imports: [SettingsSectionComponent, TranslatePipe],
  template: `
    <app-settings-section [title]="'data.title' | t" iconBg="bg-slate-100 text-slate-700">
      <svg icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7l3-3h10l3 3M4 7h16M9 12h6"/>
      </svg>

      <div class="py-3 flex flex-wrap gap-2">
        <button
          type="button"
          (click)="onExport()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 transition-all"
        >{{ 'data.exportBtn' | t }}</button>

        <label class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors">
          {{ 'data.importBtn' | t }}
          <input type="file" accept="application/json" class="hidden" (change)="onImport($event)" />
        </label>

        <button
          type="button"
          (click)="onReset()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all"
        >{{ 'data.resetBtn' | t }}</button>
      </div>

      @if (status()) {
        <p class="text-[11px] text-slate-500 pb-2">{{ status() }}</p>
      }
    </app-settings-section>
  `,
})
export class DataSectionComponent {
  private time = inject(TimeEntryService);
  private dataRefresh = inject(DataRefreshService);
  private translation = inject(TranslationService);

  status = signal<string>('');

  onExport(): void {
    const json = this.time.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.status.set(this.translation.t('data.exported'));
  }

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!confirm(this.translation.t('data.importConfirm'))) {
      input.value = '';
      return;
    }
    file.text().then(async txt => {
      try {
        this.time.importAll(txt);
        await this.refreshAll();
        this.status.set(this.translation.t('data.imported'));
      } catch {
        this.status.set(this.translation.t('data.importFailed'));
      }
      input.value = '';
    });
  }

  onReset(): void {
    if (!confirm(this.translation.t('data.resetAllConfirm'))) return;
    this.time.resetAll();
    this.refreshAll();
    this.status.set(this.translation.t('data.resetDone'));
  }

  private async refreshAll(): Promise<void> {
    await this.dataRefresh.refreshAll();
  }
}
