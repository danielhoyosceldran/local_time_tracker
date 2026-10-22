import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { MOBILE_VIEWS, MobileView, ViewStateService } from '../../services/view-state.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-mobile-nav-menu',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="backdrop" aria-hidden="true" (click)="close.emit()"></div>
    <nav class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head">
        <span class="drawer-title">{{ 'mobile.views' | t }}</span>
        <button type="button" class="icon-btn" [attr.aria-label]="'common.close' | t" (click)="close.emit()">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <ul class="drawer-list">
        @for (v of views; track v.id) {
          <li>
            <button
              type="button"
              class="drawer-item"
              [class.active]="viewState.mobileView() === v.id"
              (click)="select(v.id)"
            >
              {{ v.labelKey | t }}
            </button>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      animation: fade 0.2s var(--ease-out);
    }
    .drawer {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(80vw, 18rem);
      display: flex;
      flex-direction: column;
      background: var(--tt-surface);
      border-right: 1px solid var(--tt-border);
      box-shadow: 0 10px 40px var(--tt-shadow-drawer);
      animation: slide 0.24s var(--ease-drawer);
    }
    .drawer-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--tt-border-soft);
    }
    .drawer-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--tt-text);
    }
    .icon-btn {
      display: inline-flex;
      color: var(--tt-text-muted);
      transition: color 0.15s;
    }
    .icon-btn:hover { color: var(--tt-text); }
    .icon-btn svg { width: 1.25rem; height: 1.25rem; }
    .drawer-list {
      list-style: none;
      margin: 0;
      padding: 0.5rem;
      overflow-y: auto;
    }
    .drawer-item {
      width: 100%;
      text-align: left;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--tt-text-soft);
      transition: background 0.15s, color 0.15s;
    }
    .drawer-item:hover { background: var(--tt-surface-soft); color: var(--tt-text); }
    .drawer-item.active {
      background: rgba(99, 102, 241, 0.12);
      color: #6366f1;
      font-weight: 600;
    }
    /* Closing: the parent removes the host with animate.leave="leaving".
       Angular waits for the host's own animation, so it runs a no-op
       "hold" as long as the children's exit. Exit is quicker than entry. */
    :host(.leaving) { animation: hold 0.18s; pointer-events: none; }
    :host(.leaving) .backdrop { animation: fade-out 0.18s var(--ease-out) forwards; }
    :host(.leaving) .drawer { animation: slide-out 0.18s var(--ease-drawer) forwards; }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(0); } }
    @keyframes slide-out { to { transform: translateX(-100%); } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fade-out { to { opacity: 0; } }
    @keyframes hold { from, to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .backdrop, .drawer { animation: fade 0.15s ease-out !important; }
      :host(.leaving) { animation-duration: 0.15s !important; }
      :host(.leaving) .backdrop, :host(.leaving) .drawer { animation: fade-out 0.15s ease-out forwards !important; }
    }
  `],
})
export class MobileNavMenuComponent {
  readonly viewState = inject(ViewStateService);
  readonly views = MOBILE_VIEWS;
  readonly close = output<void>();

  select(view: MobileView): void {
    this.viewState.setMobileView(view);
    this.close.emit();
  }
}
