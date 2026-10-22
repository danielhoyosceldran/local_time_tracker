import { Directive, ElementRef, OnInit, inject, input } from '@angular/core';

/**
 * Entrance motion for content that replaces other content (a state swap, a
 * section change, a revealed row). Unlike a CSS keyframe it does not run on
 * the first render of the page, and it does not run when an ancestor is
 * already entering, so nested swaps never stack their fades.
 *
 *   <div appEnter>…</div>            swap (default)
 *   <div appEnter="fade">…</div>
 *
 * Runs with the Web Animations API from ngOnInit: control flow has already
 * inserted the element by then, so the first frame is the "from" state.
 */
export type EnterPreset = 'swap' | 'fade' | 'reveal' | 'pop';

/** Mirrors --ease-out in styles.css (WAAPI can't read CSS variables). */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const ENTERING_ATTR = 'data-tt-entering';

interface Preset {
  frames: Keyframe[];
  /** Opacity-only version for prefers-reduced-motion. */
  reduced: Keyframe[];
  duration: number;
}

const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

const PRESETS: Record<EnterPreset, Preset> = {
  // Content that takes the place of other content in the same spot.
  swap: {
    frames: [
      { opacity: 0, transform: 'translateY(4px)', filter: 'blur(2px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ],
    reduced: FADE,
    duration: 180,
  },
  fade: { frames: FADE, reduced: FADE, duration: 120 },
  // Content unfolding below the control that revealed it.
  reveal: {
    frames: [
      { opacity: 0, transform: 'translateY(-4px)' },
      { opacity: 1, transform: 'none' },
    ],
    reduced: FADE,
    duration: 150,
  },
  // A small status that just became true.
  pop: {
    frames: [
      { opacity: 0, transform: 'scale(0.95)' },
      { opacity: 1, transform: 'none' },
    ],
    reduced: FADE,
    duration: 250,
  },
};

let motionReady = false;

/** Called once by the root component after the first frame is on screen. */
export function markMotionReady(): void {
  motionReady = true;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

@Directive({
  selector: '[appEnter]',
  standalone: true,
})
export class EnterMotionDirective implements OnInit {
  /** Preset name; a bare `appEnter` attribute means "swap". */
  readonly appEnter = input<EnterPreset | ''>('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  ngOnInit(): void {
    if (!motionReady || typeof this.el.animate !== 'function') return;
    if (this.el.parentElement?.closest(`[${ENTERING_ATTR}]`)) return;

    const preset = PRESETS[this.appEnter() || 'swap'];
    this.el.setAttribute(ENTERING_ATTR, '');
    const animation = this.el.animate(prefersReducedMotion() ? preset.reduced : preset.frames, {
      duration: preset.duration,
      easing: EASE_OUT,
    });
    const done = () => this.el.removeAttribute(ENTERING_ATTR);
    animation.onfinish = done;
    animation.oncancel = done;
  }
}
