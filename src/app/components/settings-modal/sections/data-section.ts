import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TimeEntryService } from '../../../services/time-entry';
import { DataRefreshService } from '../../../services/data-refresh.service';
import { GistSyncService, GistSyncError } from '../../../services/gist-sync.service';
import { SettingsSectionComponent } from '../shared/section';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translations/en';

@Component({
  selector: 'app-data-section',
  standalone: true,
  imports: [SettingsSectionComponent, TranslatePipe, FormsModule],
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

      <!-- Cloud sync (optional, via private GitHub Gist) -->
      <div class="mt-4 pt-4 border-t border-slate-100">
        <h4 class="text-xs font-semibold text-slate-700">{{ 'gistSync.sectionTitle' | t }}</h4>
        <p class="text-[11px] text-slate-400 mt-0.5 mb-3">{{ 'gistSync.sectionHint' | t }}</p>

        <div class="space-y-2.5">
          <div>
            <label class="block text-[11px] font-medium text-slate-600 mb-1">{{ 'gistSync.tokenLabel' | t }}</label>
            <input
              type="password"
              autocomplete="off"
              [ngModel]="token()"
              (ngModelChange)="token.set($event)"
              placeholder="ghp_…"
              class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            <p class="text-[10px] text-slate-400 mt-1">{{ 'gistSync.tokenHint' | t }}</p>
          </div>

          <div>
            <label class="block text-[11px] font-medium text-slate-600 mb-1">{{ 'gistSync.gistLabel' | t }}</label>
            <input
              type="text"
              autocomplete="off"
              [ngModel]="gistInput()"
              (ngModelChange)="gistInput.set($event)"
              placeholder="https://gist.github.com/…"
              class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-[11px] font-medium text-slate-600 mb-1">{{ 'gistSync.fileLabel' | t }}</label>
            <input
              type="text"
              autocomplete="off"
              [ngModel]="fileName()"
              (ngModelChange)="fileName.set($event)"
              placeholder="data.json"
              class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            (click)="onSaveConfig()"
            [disabled]="syncBusy()"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
          >{{ 'gistSync.saveConfigBtn' | t }}</button>

          <button
            type="button"
            (click)="onPush()"
            [disabled]="syncBusy()"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
          >{{ 'gistSync.pushBtn' | t }}</button>

          <button
            type="button"
            (click)="onPull()"
            [disabled]="syncBusy()"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
          >{{ 'gistSync.pullBtn' | t }}</button>
        </div>

        @if (syncStatus()) {
          <p class="text-[11px] mt-2" [class.text-red-500]="syncError()" [class.text-slate-500]="!syncError()">
            {{ syncStatus() }}
          </p>
        }
      </div>
    </app-settings-section>
  `,
})
export class DataSectionComponent {
  private time = inject(TimeEntryService);
  private dataRefresh = inject(DataRefreshService);
  private translation = inject(TranslationService);
  private gist = inject(GistSyncService);

  status = signal<string>('');

  // Cloud sync form state, seeded from the saved config.
  private cfg = this.gist.getConfig();
  token = signal<string>(this.cfg?.token ?? '');
  gistInput = signal<string>(this.cfg?.gistId ?? '');
  fileName = signal<string>(this.cfg?.fileName ?? 'data.json');

  syncStatus = signal<string>('');
  syncError = signal<boolean>(false);
  syncBusy = signal<boolean>(false);

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

  // --- Cloud sync handlers ---

  onSaveConfig(): void {
    this.gist.saveConfig({
      token: this.token(),
      gistId: this.gistInput(),
      fileName: this.fileName(),
    });
    // Reflect normalized values back (id extracted from URL, default file name).
    const saved = this.gist.getConfig();
    if (saved) {
      this.token.set(saved.token);
      this.gistInput.set(saved.gistId);
      this.fileName.set(saved.fileName);
    }
    this.setSyncStatus('gistSync.configSaved', false);
  }

  async onPush(): Promise<void> {
    if (!this.gist.hasConfig()) {
      this.setSyncStatus('gistSync.errNoConfig', true);
      return;
    }
    this.syncBusy.set(true);
    this.setSyncStatus('gistSync.busy', false);
    try {
      await firstValueFrom(this.gist.push(this.time.exportAll()));
      this.setSyncStatus('gistSync.pushed', false);
    } catch (err) {
      this.setSyncStatus(errorKey(err), true);
    } finally {
      this.syncBusy.set(false);
    }
  }

  async onPull(): Promise<void> {
    if (!this.gist.hasConfig()) {
      this.setSyncStatus('gistSync.errNoConfig', true);
      return;
    }
    if (!confirm(this.translation.t('gistSync.pullConfirm'))) return;
    this.syncBusy.set(true);
    this.setSyncStatus('gistSync.busy', false);
    try {
      const payload = await firstValueFrom(this.gist.pull());
      if (!payload) {
        this.setSyncStatus('gistSync.pulledEmpty', true);
        return;
      }
      // Reuse the existing import path; importAll only reads `.data`.
      this.time.importAll(JSON.stringify(payload));
      await this.refreshAll();
      this.gist.dismissPending(); // we are now in sync; drop any startup prompt
      this.setSyncStatus('gistSync.pulled', false);
    } catch (err) {
      this.setSyncStatus(errorKey(err), true);
    } finally {
      this.syncBusy.set(false);
    }
  }

  private setSyncStatus(key: TranslationKey, isError: boolean): void {
    this.syncStatus.set(this.translation.t(key));
    this.syncError.set(isError);
  }

  private async refreshAll(): Promise<void> {
    await this.dataRefresh.refreshAll();
  }
}

/** Map a typed sync error to its i18n key. Falls back to the network message. */
function errorKey(err: unknown): TranslationKey {
  const kind = (err as GistSyncError | undefined)?.kind;
  switch (kind) {
    case 'no-config': return 'gistSync.errNoConfig';
    case 'unauthorized': return 'gistSync.errUnauthorized';
    case 'not-found': return 'gistSync.errNotFound';
    case 'validation': return 'gistSync.errValidation';
    case 'parse': return 'gistSync.errParse';
    default: return 'gistSync.errNetwork';
  }
}
