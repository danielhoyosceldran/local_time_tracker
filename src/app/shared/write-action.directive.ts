import { Directive, ElementRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { WriteAccessService } from '../services/write-access.service';

/**
 * Marks a control (or an area of controls) that changes data. While this
 * instance is read-only (another one holds the edit lock) it looks disabled
 * and its clicks never reach the component: they are swallowed and reported
 * to WriteAccessService instead, which brings the read-only banner back.
 *
 *   <button appWriteAction (click)="save()">…</button>
 *   <div appWriteAction>…cells that toggle on click…</div>
 *
 * Not the native `disabled` attribute on purpose: a disabled button eats the
 * click silently, and the point is to tell the user why nothing happened.
 */
@Directive({
  selector: '[appWriteAction]',
  standalone: true,
})
export class WriteActionDirective implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private access = inject(WriteAccessService);

  constructor() {
    effect(() => {
      const readOnly = !this.access.canWrite();
      const node = this.el.nativeElement;
      node.classList.toggle('tt-readonly', readOnly);
      if (readOnly) node.setAttribute('aria-disabled', 'true');
      else node.removeAttribute('aria-disabled');
    });
  }

  // Capture phase on the element itself: runs before Angular's own (click)
  // listener on the same node, and before any listener on a descendant.
  private onClick = (event: Event) => {
    if (this.access.canWrite()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.access.guard();
  };

  // A <select> opens on mousedown and changes with the keyboard: block both.
  private onPress = (event: Event) => {
    if (this.access.canWrite()) return;
    if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === 'Escape')) return;
    event.preventDefault();
    if (event instanceof KeyboardEvent) this.access.guard();
  };

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.addEventListener('click', this.onClick, true);
    if (node instanceof HTMLSelectElement) {
      node.addEventListener('mousedown', this.onPress, true);
      node.addEventListener('keydown', this.onPress, true);
    }
  }

  ngOnDestroy(): void {
    const node = this.el.nativeElement;
    node.removeEventListener('click', this.onClick, true);
    node.removeEventListener('mousedown', this.onPress, true);
    node.removeEventListener('keydown', this.onPress, true);
  }
}
