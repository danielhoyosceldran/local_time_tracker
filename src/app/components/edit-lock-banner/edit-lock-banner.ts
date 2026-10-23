// src/app/components/edit-lock-banner/edit-lock-banner.ts
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';
import { CloudSyncService } from '../../services/cloud/cloud-sync.service';
import { DeviceIdentityService } from '../../services/device-identity.service';
import { WriteAccessService } from '../../services/write-access.service';
import { prefersReducedMotion } from '../../shared/enter-motion.directive';

/**
 * Says that this instance is read-only because another one holds the edit
 * lock (with a "take control" button), and that local changes were
 * discarded after losing it (with their backup). Mounted once at the app root.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-edit-lock-banner',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (reader(); as r) {
      @if (expanded()) {
        <div #lockBanner id="tt-lock-banner" role="status" animate.leave="tt-leave"
          (pointerenter)="holdOpen()" (pointerleave)="releaseOpen()" (focusin)="holdOpen()" (focusout)="releaseOpen()"
          class="tt-banner-top fixed top-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,560px)] flex items-start gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 pl-4 pr-2 py-3 transition-shadow"
          [class.ring-2]="flash()" [class.ring-amber-500]="flash()">
          <svg aria-hidden="true" class="w-4 h-4 mt-0.5 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
          <!-- Phones: the button goes under the text so the text keeps its width. -->
          <div class="flex-1 min-w-0 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-amber-700">{{ 'lock.readOnlyTitle' | t }}</p>
              <p class="mt-0.5 text-xs text-slate-600">{{ r }}</p>
            </div>
            <button type="button" (click)="takeControl()" [disabled]="busy()"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition disabled:opacity-50">
              {{ 'lock.takeControl' | t }}
            </button>
          </div>
          <button type="button" (click)="collapse()" [attr.aria-label]="'lock.hide' | t" [title]="'lock.hide' | t"
            class="hit-area shrink-0 self-start sm:self-center -mt-1 sm:mt-0 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition">
            <svg aria-hidden="true" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </button>
        </div>
      } @else {
        <!-- Collapsed: a lock chip in the nav row, where the banner folded from,
             keeps the state visible without covering the page. Tapping it, or
             any refused edit, brings the banner back. Centred with inset-x-0 +
             mx-auto (not a translate) so the scale-in keeps its position. -->
        <button type="button" animate.leave="tt-leave" (click)="expand(8000)"
          [attr.aria-label]="'lock.showDetails' | t" [title]="'lock.showDetails' | t"
          aria-controls="tt-lock-banner" aria-expanded="false"
          class="tt-popover origin-top fixed z-40 top-[18px] inset-x-0 mx-auto w-fit flex items-center gap-1.5 h-9 px-2.5 sm:pr-3.5 rounded-full bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-900/10 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 active:scale-95 transition">
          <svg aria-hidden="true" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
          <span class="hidden sm:inline">{{ 'lock.readOnlyTitle' | t }}</span>
        </button>
      }
    }
    @if (sync.discardedAt(); as at) {
      <div role="alert" animate.leave="tt-leave"
        class="tt-banner-bottom fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,480px)] flex items-start gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-red-200 p-4">
        <div class="flex-1">
          <p class="text-sm font-semibold text-red-700">{{ 'lock.discardedTitle' | t }}</p>
          <p class="mt-1 text-xs text-slate-600">{{ 'lock.discardedBody' | t: { date: formatDate(at) } }}</p>
          <div class="mt-2 flex gap-2">
            <button type="button" (click)="sync.downloadDiscarded()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
              {{ 'lock.discardedDownload' | t }}
            </button>
            <button type="button" (click)="sync.dismissDiscarded()"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">
              {{ 'lock.discardedDismiss' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EditLockBannerComponent {
  protected sync = inject(CloudSyncService);
  private access = inject(WriteAccessService);
  private device = inject(DeviceIdentityService);
  private translation = inject(TranslationService);

  busy = signal(false);
  /** Briefly highlights the banner when a change was refused. */
  flash = signal(false);
  /**
   * The full banner is shown for a few seconds (on becoming read-only, on a
   * refused edit, or when the chip is tapped) and then folds into the chip,
   * so it never sits on top of the page for good.
   */
  expanded = signal(true);
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;
  private held = false;
  private lockBanner = viewChild<ElementRef<HTMLElement>>('lockBanner');

  private isReader = computed(() => this.access.state().kind === 'reader');

  /** The banner text, or null when this instance can write. */
  reader = computed(() => {
    const state = this.access.state();
    if (state.kind !== 'reader') return null;
    const holder = state.holder;
    if (!holder) return this.translation.t('lock.readOnlyUnknown');
    if (holder.deviceId === this.device.deviceId) return this.translation.t('lock.readOnlySameDevice');
    return this.translation.t('lock.readOnlyBody', { device: holder.deviceName, browser: holder.browser });
  });

  constructor() {
    // Becoming read-only: show the explanation once, then fold it away.
    effect(() => {
      if (!this.isReader()) return;
      untracked(() => this.expand(6000));
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      if (!this.access.refused()) return;
      untracked(() => this.expand(4000));
      this.flash.set(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => this.flash.set(false), 1200);
      // A short sideways nudge on every refused edit: "not here". Uses the
      // `translate` property so it doesn't fight the -translate-x-1/2 centring.
      const el = untracked(this.lockBanner)?.nativeElement;
      if (el && !prefersReducedMotion()) {
        el.animate(
          [{ translate: '0' }, { translate: '-4px' }, { translate: '4px' }, { translate: '-2px' }, { translate: '0' }],
          { duration: 300, easing: 'ease-in-out' },
        );
      }
    });
  }

  /** Shows the full banner and folds it back after `ms` (unless the pointer or focus is on it). */
  expand(ms: number): void {
    this.expanded.set(true);
    this.scheduleCollapse(ms);
  }

  collapse(): void {
    this.clearCollapse();
    this.held = false;
    this.expanded.set(false);
  }

  holdOpen(): void {
    this.held = true;
    this.clearCollapse();
  }

  releaseOpen(): void {
    this.held = false;
    this.scheduleCollapse(2500);
  }

  private scheduleCollapse(ms: number): void {
    this.clearCollapse();
    if (this.held) return;
    this.collapseTimer = setTimeout(() => this.expanded.set(false), ms);
  }

  private clearCollapse(): void {
    if (this.collapseTimer) clearTimeout(this.collapseTimer);
    this.collapseTimer = null;
  }

  async takeControl(): Promise<void> {
    if (!confirm(this.translation.t('lock.takeControlConfirm'))) return;
    this.busy.set(true);
    try {
      await this.sync.takeControl();
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(at: number): string {
    return new Date(at).toLocaleString(this.translation.language());
  }
}
