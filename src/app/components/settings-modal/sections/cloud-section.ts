import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsSectionComponent } from '../shared/section';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translations/en';
import { ClockTimePipe } from '../../../pipes/clock-time.pipe';
import { CloudConfigService } from '../../../services/cloud/cloud-config.service';
import { CloudAuthError, CloudAuthService } from '../../../services/cloud/cloud-auth.service';
import { CloudOutboxService } from '../../../services/cloud/cloud-outbox.service';
import { CloudSyncService, CloudSyncState } from '../../../services/cloud/cloud-sync.service';
import { migrationSqlSince } from '../../../services/cloud/cloud-schema';

const STATE_KEYS: Record<CloudSyncState, TranslationKey> = {
  disabled: 'cloud.state.disabled',
  setup: 'cloud.state.setup',
  syncing: 'cloud.state.syncing',
  synced: 'cloud.state.synced',
  pending: 'cloud.state.pending',
  offline: 'cloud.state.offline',
  error: 'cloud.state.error',
  reauth: 'cloud.state.reauth',
};

const AUTH_ERROR_KEYS: Record<CloudAuthError, TranslationKey> = {
  invalidCredentials: 'cloud.err.invalidCredentials',
  network: 'cloud.err.network',
  weakPassword: 'cloud.err.weakPassword',
  unknown: 'cloud.err.unknown',
};

/**
 * Supabase connection: project config, sign-in (no sign-up: accounts are
 * created by the project admin), sync status and sign-out. Actions apply
 * immediately, like the Data section; nothing goes through the settings draft.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-cloud-section',
  standalone: true,
  imports: [SettingsSectionComponent, TranslatePipe, FormsModule, ClockTimePipe],
  template: `
    <app-settings-section [title]="'cloud.title' | t" iconBg="bg-indigo-100 text-indigo-700">
      <svg aria-hidden="true" icon class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 18a4 4 0 01-.88-7.9A5 5 0 1115.9 8 4.5 4.5 0 0117 17H7z"/>
      </svg>

      <div class="py-3 space-y-4">
        @switch (auth.status()) {
          @case ('unconfigured') {
            <p class="text-xs text-slate-500">{{ 'cloud.intro' | t }}</p>

            <div>
              <label for="cloud-code" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.codeLabel' | t }}</label>
              <div class="flex gap-2">
                <input
                  id="cloud-code"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  [ngModel]="code()"
                  (ngModelChange)="code.set($event)"
                  placeholder="tt1:…"
                  class="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <button type="button" (click)="useCode()" [class]="primaryBtn">{{ 'cloud.useCodeBtn' | t }}</button>
              </div>
              <p class="text-xs text-slate-500 mt-1">{{ 'cloud.codeHint' | t }}</p>
            </div>

            <details class="text-xs">
              <summary class="cursor-pointer text-slate-600 font-medium">{{ 'cloud.manualTitle' | t }}</summary>
              <div class="mt-2 space-y-2.5">
                <div>
                  <label for="cloud-url" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.urlLabel' | t }}</label>
                  <input id="cloud-url" type="url" autocomplete="off" [ngModel]="url()" (ngModelChange)="url.set($event)"
                    placeholder="https://xxxx.supabase.co" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label for="cloud-key" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.keyLabel' | t }}</label>
                  <input id="cloud-key" type="text" autocomplete="off" spellcheck="false" [ngModel]="key()" (ngModelChange)="key.set($event)"
                    placeholder="sb_publishable_…" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono" />
                  <p class="text-xs text-slate-500 mt-1">{{ 'cloud.keyHint' | t }}</p>
                </div>
                <button type="button" (click)="saveManual()" [class]="secondaryBtn">{{ 'cloud.saveConfigBtn' | t }}</button>
              </div>
            </details>

            <div class="pt-3 border-t border-slate-100">
              <p class="text-xs text-slate-500 mb-2">{{ 'cloud.adminHint' | t }}</p>
              <button type="button" (click)="copySql(0)" [class]="secondaryBtn">{{ 'cloud.copySqlBtn' | t }}</button>
            </div>
          }

          @case ('signedOut') {
            <p class="text-xs text-slate-500">{{ 'cloud.project' | t: { host: projectHost() } }}</p>
            @if (sync.state() === 'reauth') {
              <p class="rounded-lg bg-amber-100 p-3 text-xs text-amber-700" role="status">
                {{ 'cloud.reauthHint' | t }}
                @if (outbox.size() > 0) {
                  <span class="block mt-1 font-medium">{{ 'cloud.pendingCount' | t: { n: outbox.size() } }}</span>
                }
              </p>
            }
            <form class="space-y-2.5" (ngSubmit)="signIn()">
              <div>
                <label for="cloud-email" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.emailLabel' | t }}</label>
                <input id="cloud-email" name="email" type="email" autocomplete="username" [ngModel]="email()" (ngModelChange)="email.set($event)"
                  class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
              </div>
              <div>
                <label for="cloud-password" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.passwordLabel' | t }}</label>
                <input id="cloud-password" name="password" type="password" autocomplete="current-password" [ngModel]="password()" (ngModelChange)="password.set($event)"
                  class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button type="submit" [disabled]="busy() || !email() || !password()" [class]="primaryBtn">{{ 'cloud.signInBtn' | t }}</button>
                <button type="button" (click)="forgetConfig()" [disabled]="busy()" [class]="ghostBtn">{{ 'cloud.forgetBtn' | t }}</button>
              </div>
              <p class="text-xs text-slate-500">{{ 'cloud.noSignUpHint' | t }}</p>
            </form>
          }

          @case ('signedIn') {
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm text-slate-700 truncate">{{ auth.email() }}</div>
                <div class="text-xs text-slate-500">{{ 'cloud.project' | t: { host: projectHost() } }}</div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs font-medium" [class]="stateClass()">{{ stateKey() | t }}</div>
                @if (sync.lastSyncAt(); as at) {
                  <div class="text-xs text-slate-500">{{ 'cloud.lastSync' | t: { time: (at | clockTime) } }}</div>
                }
                @if (outbox.size() > 0) {
                  <div class="text-xs text-slate-500">{{ 'cloud.pendingCount' | t: { n: outbox.size() } }}</div>
                }
                @if (outbox.rejectedCount() > 0) {
                  <div class="text-xs text-amber-700">
                    {{ 'cloud.rejectedCount' | t: { n: outbox.rejectedCount() } }}
                    <button type="button" (click)="outbox.clearRejected()" class="underline hover:no-underline">{{ 'cloud.rejectedDismiss' | t }}</button>
                  </div>
                }
              </div>
            </div>

            @if (sync.schema(); as schema) {
              @if (schema.kind === 'missing' || schema.kind === 'outdated') {
                <div class="rounded-lg bg-amber-100 p-3 text-xs text-amber-700 space-y-2">
                  <p>{{ (schema.kind === 'missing' ? 'cloud.schemaMissing' : 'cloud.schemaOutdated') | t }}</p>
                  <div class="flex gap-2">
                    <button type="button" (click)="copySql(schema.kind === 'outdated' ? schema.version : 0)" [class]="secondaryBtn">{{ 'cloud.copySqlBtn' | t }}</button>
                    <button type="button" (click)="sync.syncNow()" [class]="ghostBtn">{{ 'cloud.retryBtn' | t }}</button>
                  </div>
                </div>
              } @else if (schema.kind === 'newer') {
                <p class="rounded-lg bg-amber-100 p-3 text-xs text-amber-700">{{ 'cloud.schemaNewer' | t }}</p>
              }
            }

            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="sync.syncNow()" [class]="primaryBtn">{{ 'cloud.syncNowBtn' | t }}</button>
              <button type="button" (click)="copyCode()" [class]="secondaryBtn">{{ 'cloud.copyCodeBtn' | t }}</button>
              <button type="button" (click)="showPassword.set(!showPassword())" [class]="secondaryBtn">{{ 'cloud.changePasswordBtn' | t }}</button>
              <button type="button" (click)="confirmSignOut.set(true)" [class]="dangerBtn">{{ 'cloud.signOutBtn' | t }}</button>
            </div>
            <p class="text-xs text-slate-500">{{ 'cloud.codeShareHint' | t }}</p>

            @if (showPassword()) {
              <form class="space-y-2.5 pt-3 border-t border-slate-100" (ngSubmit)="changePassword()">
                <div>
                  <label for="cloud-new-password" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.newPasswordLabel' | t }}</label>
                  <input id="cloud-new-password" name="newPassword" type="password" autocomplete="new-password" [ngModel]="newPassword()" (ngModelChange)="newPassword.set($event)"
                    class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label for="cloud-new-password2" class="block text-xs font-medium text-slate-600 mb-1">{{ 'cloud.repeatPasswordLabel' | t }}</label>
                  <input id="cloud-new-password2" name="newPassword2" type="password" autocomplete="new-password" [ngModel]="newPassword2()" (ngModelChange)="newPassword2.set($event)"
                    class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
                </div>
                <button type="submit" [disabled]="busy() || newPassword().length < 8 || newPassword() !== newPassword2()" [class]="primaryBtn">{{ 'cloud.savePasswordBtn' | t }}</button>
                <p class="text-xs text-slate-500">{{ 'cloud.passwordRule' | t }}</p>
              </form>
            }
          }
        }

        @if (message()) {
          <p class="text-xs" role="status" [class.text-red-600]="isError()" [class.text-slate-500]="!isError()">{{ message() }}</p>
        }
      </div>

      @if (confirmSignOut()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" (click)="confirmSignOut.set(false)"></div>
          <div role="dialog" aria-modal="true" aria-labelledby="cloud-signout-title"
            class="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(90vw,400px)] p-6">
            <h2 id="cloud-signout-title" class="text-base font-bold text-slate-800">{{ 'cloud.signOutTitle' | t }}</h2>
            @if (outbox.size() > 0) {
              <p class="mt-2 text-xs text-amber-700">{{ 'cloud.signOutPending' | t: { n: outbox.size() } }}</p>
            }
            <label class="mt-4 flex items-start gap-2 text-xs text-slate-700">
              <input type="checkbox" class="mt-0.5" [ngModel]="wipeOnSignOut()" (ngModelChange)="wipeOnSignOut.set($event)" />
              <span>{{ 'cloud.signOutWipe' | t }}</span>
            </label>
            <p class="mt-1 text-xs text-slate-500">{{ (wipeOnSignOut() ? 'cloud.signOutWipeHint' : 'cloud.signOutKeepHint') | t }}</p>
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" (click)="confirmSignOut.set(false)" [class]="secondaryBtn">{{ 'common.cancel' | t }}</button>
              <button type="button" (click)="signOut()" [disabled]="busy()" [class]="dangerSolidBtn">{{ 'cloud.signOutBtn' | t }}</button>
            </div>
          </div>
        </div>
      }
    </app-settings-section>
  `,
})
export class CloudSectionComponent {
  protected auth = inject(CloudAuthService);
  protected sync = inject(CloudSyncService);
  protected outbox = inject(CloudOutboxService);
  private config = inject(CloudConfigService);
  private translation = inject(TranslationService);

  readonly primaryBtn = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition disabled:opacity-50';
  readonly secondaryBtn = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition disabled:opacity-50';
  readonly ghostBtn = 'px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50';
  readonly dangerBtn = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition disabled:opacity-50';
  readonly dangerSolidBtn = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 active:scale-95 transition disabled:opacity-50';

  code = signal('');
  url = signal(this.config.config()?.url ?? '');
  key = signal(this.config.config()?.key ?? '');
  email = signal('');
  password = signal('');
  newPassword = signal('');
  newPassword2 = signal('');

  busy = signal(false);
  showPassword = signal(false);
  confirmSignOut = signal(false);
  wipeOnSignOut = signal(false);
  message = signal('');
  isError = signal(false);

  projectHost = computed(() => {
    const url = this.config.config()?.url;
    try {
      return url ? new URL(url).host : '';
    } catch {
      return url ?? '';
    }
  });

  stateKey = computed(() => STATE_KEYS[this.sync.state()]);
  stateClass = computed(() => {
    switch (this.sync.state()) {
      case 'synced': return 'text-emerald-600';
      case 'error': return 'text-red-600';
      case 'offline':
      case 'setup':
      case 'reauth': return 'text-amber-600';
      default: return 'text-slate-500';
    }
  });

  async useCode(): Promise<void> {
    const cfg = this.config.decodeConnectionCode(this.code());
    if (!cfg) return this.say('cloud.err.invalidCode', true);
    await this.applyConfig(cfg.url, cfg.key);
  }

  async saveManual(): Promise<void> {
    await this.applyConfig(this.url(), this.key());
  }

  private async applyConfig(url: string, key: string): Promise<void> {
    if (!this.config.save({ url, key })) return this.say('cloud.err.invalidConfig', true);
    this.code.set('');
    await this.sync.reconnect();
    this.say('cloud.configSaved', false);
  }

  async forgetConfig(): Promise<void> {
    this.config.clear();
    await this.sync.reconnect();
    this.message.set('');
  }

  async signIn(): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    const error = await this.auth.signIn(this.email(), this.password());
    this.busy.set(false);
    if (error) return this.say(AUTH_ERROR_KEYS[error], true);
    this.password.set('');
  }

  async signOut(): Promise<void> {
    this.busy.set(true);
    await this.sync.signOut({ wipeLocal: this.wipeOnSignOut() });
    this.busy.set(false);
    this.confirmSignOut.set(false);
    this.say('cloud.signedOut', false);
  }

  async changePassword(): Promise<void> {
    this.busy.set(true);
    const error = await this.auth.changePassword(this.newPassword());
    this.busy.set(false);
    if (error) return this.say(AUTH_ERROR_KEYS[error], true);
    this.newPassword.set('');
    this.newPassword2.set('');
    this.showPassword.set(false);
    this.say('cloud.passwordChanged', false);
  }

  async copyCode(): Promise<void> {
    const code = this.config.encodeConnectionCode();
    if (code) await this.copy(code, 'cloud.codeCopied');
  }

  async copySql(fromVersion: number): Promise<void> {
    await this.copy(migrationSqlSince(fromVersion), 'cloud.sqlCopied');
  }

  private async copy(text: string, okKey: TranslationKey): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.say(okKey, false);
    } catch {
      this.say('cloud.err.clipboard', true);
    }
  }

  private say(key: TranslationKey, isError: boolean): void {
    this.message.set(this.translation.t(key));
    this.isError.set(isError);
  }
}
