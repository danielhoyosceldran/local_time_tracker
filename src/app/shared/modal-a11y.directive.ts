import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialog semantics + keyboard containment for modal cards. Put it on the card
 * element (not the backdrop): `<div appModal labelledBy="my-title-id">`.
 *
 * - role="dialog" aria-modal and aria-labelledby pointing at the title element
 * - on open, focus moves inside (first focusable, or the card itself)
 * - Tab / Shift+Tab wrap inside the card
 * - on close, focus returns to whatever opened the modal
 */
@Directive({
  selector: '[appModal]',
  standalone: true,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    '[attr.aria-labelledby]': 'labelledBy() || null',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalA11yDirective implements AfterViewInit, OnDestroy {
  /** id of the element that titles the dialog. */
  readonly labelledBy = input<string>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private opener: HTMLElement | null =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    // An element marked data-autofocus wins; otherwise the first focusable,
    // falling back to the card itself.
    const target =
      el.querySelector<HTMLElement>('[data-autofocus]') ??
      el.querySelector<HTMLElement>(FOCUSABLE) ??
      el;
    target.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    const opener = this.opener;
    if (opener && opener.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const el = this.host.nativeElement;
    const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      n => n.offsetParent !== null || n === document.activeElement,
    );
    if (items.length === 0) {
      event.preventDefault();
      el.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === el)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
