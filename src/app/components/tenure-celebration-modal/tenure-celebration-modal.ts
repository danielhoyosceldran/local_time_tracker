// src/app/components/tenure-celebration-modal/tenure-celebration-modal.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';
import { TenureMilestone } from '../../services/tenure-celebration.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: 0 | 1;
  life: number;
}

const COLORS = ['#7c3aed', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

@Component({
  selector: 'app-tenure-celebration-modal',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="close.emit()"></div>

      <!-- Card -->
      <div
        class="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 w-[min(90vw,420px)] px-7 py-8 text-center"
      >
        <!-- Trophy badge -->
        <div
          class="mx-auto mb-4 w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center"
        >
          <svg class="w-8 h-8 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="6" />
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
          </svg>
        </div>

        <h2 class="text-2xl font-extrabold text-slate-800">{{ 'celebrate.title' | t }}</h2>

        <!-- Milestone figure -->
        <div class="mt-4 flex items-end justify-center gap-2">
          <span class="text-6xl font-extrabold font-mono text-violet-600 leading-none">{{ milestone().value }}</span>
          <span class="text-sm uppercase tracking-wide text-slate-500 mb-1.5">{{ unitKey() | t }}</span>
        </div>

        <p class="mt-3 text-sm font-medium text-slate-700">{{ subtitle() }}</p>
        <p class="mt-2 text-xs text-slate-500">{{ 'celebrate.message' | t }}</p>

        <button
          (click)="close.emit()"
          class="mt-6 w-full px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          {{ 'celebrate.button' | t }}
        </button>
      </div>

      <!-- Confetti overlay (drawn above the card, never intercepts clicks) -->
      <canvas #confetti class="pointer-events-none fixed inset-0 z-20"></canvas>
    </div>
  `,
})
export class TenureCelebrationModalComponent implements AfterViewInit, OnDestroy {
  private translation = inject(TranslationService);

  readonly milestone = input.required<TenureMilestone>();
  readonly close = output<void>();

  @ViewChild('confetti') private canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly unitKey = computed(() => {
    const m = this.milestone();
    if (m.kind === 'months') return m.value === 1 ? 'tenure.monthOne' : 'tenure.months';
    return m.value === 1 ? 'tenure.yearOne' : 'tenure.years';
  });

  readonly subtitle = computed(() => {
    this.translation.language(); // re-evaluate on language change
    const m = this.milestone();
    if (m.key === '6m') return this.translation.t('celebrate.sub.6m');
    if (m.key === '1y') return this.translation.t('celebrate.sub.1y');
    return this.translation.t('celebrate.sub.years', { years: m.value });
  });

  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private rafId = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private viewW = 0;
  private viewH = 0;

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close.emit();
  }

  ngAfterViewInit(): void {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduce) return;

    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    canvas.width = this.viewW * dpr;
    canvas.height = this.viewH * dpr;
    ctx.scale(dpr, dpr);
    this.ctx = ctx;

    // Two cannons firing inward from the bottom corners, with a couple of
    // follow-up bursts for a fuller effect.
    const fire = () => {
      this.spawnBurst(0, this.viewH, -Math.PI / 3, 80); // bottom-left → up-right
      this.spawnBurst(this.viewW, this.viewH, (-2 * Math.PI) / 3, 80); // bottom-right → up-left
    };
    fire();
    this.timers.push(setTimeout(fire, 250));
    this.timers.push(setTimeout(fire, 550));

    this.rafId = requestAnimationFrame(this.tick);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.timers.forEach(clearTimeout);
  }

  private spawnBurst(originX: number, originY: number, angle: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * (Math.PI / 2.2);
      const a = angle + spread;
      const speed = 9 + Math.random() * 9;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: 6 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() < 0.5 ? 0 : 1,
        life: 0,
      });
    }
  }

  private readonly tick = (): void => {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.viewW, this.viewH);

    for (const p of this.particles) {
      p.vy += 0.18; // gravity
      p.vx *= 0.99; // air drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life++;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size / 2, p.size / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.particles = this.particles.filter(p => p.y < this.viewH + 40 && p.life < 600);

    if (this.particles.length) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      ctx.clearRect(0, 0, this.viewW, this.viewH);
    }
  };
}
