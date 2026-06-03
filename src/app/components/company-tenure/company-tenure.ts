// src/app/components/company-tenure/company-tenure.ts
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  TenureCelebrationService,
  TenureMilestone,
} from '../../services/tenure-celebration.service';
import { TenureCelebrationModalComponent } from '../tenure-celebration-modal/tenure-celebration-modal';

interface Tenure {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  future: boolean;
}

@Component({
  selector: 'app-company-tenure',
  standalone: true,
  imports: [CommonModule, TranslatePipe, TenureCelebrationModalComponent],
  template: `
    <div class="bg-white/80 backdrop-blur-xl border border-white rounded-2xl shadow-sm shadow-slate-200/50 p-4 h-full flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20 7H4a1 1 0 00-1 1v11a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
        <h3 class="text-slate-800 font-bold text-sm">{{ 'tenure.title' | t }}</h3>

        @if (startDate() && !editing()) {
          <button
            (click)="startEdit()"
            class="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            [title]="'common.edit' | t"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        }
      </div>

      @if (startDate() && !editing()) {
        <!-- Tenure display -->
        @if (tenure(); as t) {
          @if (t.future) {
            <div class="flex-1 flex items-center justify-center text-center text-amber-600 text-sm font-medium px-2">
              {{ 'tenure.future' | t }}
            </div>
          } @else {
            <div class="flex-1 flex flex-col justify-center">
              <!-- Breakdown -->
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-3xl font-extrabold font-mono text-violet-600 leading-none">{{ t.years }}</div>
                  <div class="text-[10px] uppercase tracking-wide text-slate-500 mt-1">
                    {{ (t.years === 1 ? 'tenure.yearOne' : 'tenure.years') | t }}
                  </div>
                </div>
                <div>
                  <div class="text-3xl font-extrabold font-mono text-violet-500 leading-none">{{ t.months }}</div>
                  <div class="text-[10px] uppercase tracking-wide text-slate-500 mt-1">
                    {{ (t.months === 1 ? 'tenure.monthOne' : 'tenure.months') | t }}
                  </div>
                </div>
                <div>
                  <div class="text-3xl font-extrabold font-mono text-violet-400 leading-none">{{ t.days }}</div>
                  <div class="text-[10px] uppercase tracking-wide text-slate-500 mt-1">
                    {{ (t.days === 1 ? 'tenure.dayOne' : 'tenure.days') | t }}
                  </div>
                </div>
              </div>

              <!-- Total days + start date -->
              <div class="text-xs text-slate-500 text-center mt-4">
                <span class="font-mono font-medium text-slate-700">{{ t.totalDays | number }}</span>
                {{ 'tenure.totalDays' | t }}
              </div>
              <div class="text-[11px] text-slate-400 text-center mt-1">
                {{ 'tenure.since' | t }} <span class="font-mono">{{ formattedStart() }}</span>
              </div>
            </div>
          }
        }
      } @else {
        <!-- Configure start date -->
        <div class="flex-1 flex flex-col justify-center gap-2">
          @if (!startDate()) {
            <p class="text-xs text-slate-500 text-center">{{ 'tenure.prompt' | t }}</p>
          }
          <label class="text-[11px] font-medium text-slate-500">{{ 'tenure.startDate' | t }}</label>
          <input
            #dateInput
            type="date"
            [value]="draft()"
            [max]="todayStr"
            (input)="draft.set(dateInput.value)"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
          />
          <div class="flex gap-2 mt-1">
            <button
              (click)="save()"
              [disabled]="!draft()"
              class="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {{ 'common.save' | t }}
            </button>
            @if (startDate()) {
              <button
                (click)="cancelEdit()"
                class="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                {{ 'common.cancel' | t }}
              </button>
            }
          </div>
        </div>
      }
    </div>

    @if (celebration(); as m) {
      <app-tenure-celebration-modal [milestone]="m" (close)="celebration.set(null)" />
    }
  `,
})
export class CompanyTenureComponent implements OnInit, OnDestroy {
  private settings = inject(SettingsService);
  private celebrations = inject(TenureCelebrationService);

  readonly startDate = this.settings.companyStartDate;
  readonly editing = signal(false);
  readonly draft = signal(this.settings.companyStartDate());
  readonly celebration = signal<TenureMilestone | null>(null);

  /** Ticks once per minute so the counter rolls over without a heavy interval. */
  private readonly now = signal(this.startOfMinute());
  private timer = setInterval(() => this.now.set(this.startOfMinute()), 60_000);

  readonly todayStr = this.toDateInputValue(new Date());

  readonly tenure = computed<Tenure | null>(() => {
    const raw = this.startDate();
    if (!raw) return null;
    const start = this.parseDate(raw);
    if (!start) return null;

    const now = new Date(this.now());
    if (start.getTime() > now.getTime()) {
      return { years: 0, months: 0, days: 0, totalDays: 0, future: true };
    }

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) {
      months--;
      // Number of days in the month preceding `now`.
      const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += daysInPrevMonth;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalDays = Math.floor((nowMidnight.getTime() - startMidnight.getTime()) / 86_400_000);

    return { years, months, days, totalDays, future: false };
  });

  readonly formattedStart = computed(() => {
    const start = this.parseDate(this.startDate());
    return start ? start.toLocaleDateString() : '';
  });

  startEdit(): void {
    this.draft.set(this.startDate());
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    if (!this.draft()) return;
    this.settings.setCompanyStartDate(this.draft());
    this.editing.set(false);
    this.checkCelebration();
  }

  ngOnInit(): void {
    this.checkCelebration();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private checkCelebration(): void {
    const pending = this.celebrations.checkPending(this.startDate());
    if (pending) this.celebration.set(pending);
  }

  private parseDate(raw: string): Date | null {
    if (!raw) return null;
    const [y, m, d] = raw.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private startOfMinute(): number {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.getTime();
  }
}
