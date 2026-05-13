// src/app/components/monthly-chart/monthly-chart.ts
import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Plugin } from 'chart.js';
import { TimeEntryService } from '../../services/time-entry';
import { SettingsService } from '../../services/settings.service';
import { HolidayDatesService } from '../../services/holiday-dates.service';
import { ThemeService } from '../../services/theme.service';
import { formatHoursToTime } from '../../utils/format';
import { TranslationService } from '../../i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';

type Period = 'week' | 'month' | 'year';

interface PeriodResult {
  labels: string[];
  data: (number | null)[];
  expectedPerBucket: number[];
  worked: number;
  expected: number;
  firstEntryBucketIndex: number | null;
}

@Component({
  selector: 'app-monthly-chart',
  standalone: true,
  imports: [BaseChartDirective, CommonModule, TranslatePipe],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-4 h-full flex flex-col overflow-y-auto">
      <div class="flex items-start justify-between mb-2 gap-2">
        <div class="flex items-center gap-1.5">
          <h3 class="text-slate-800 font-bold">{{ titleFor(period()) }}</h3>
          <div class="relative group">
            <svg class="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="absolute left-0 top-full mt-1 z-10 hidden group-hover:block w-56 bg-slate-800 text-white text-[11px] leading-snug rounded-lg shadow-lg p-2.5 pointer-events-none">
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-block w-3 h-1.5 rounded-sm bg-indigo-600"></span>
                <span>{{ 'monthly.workedArea' | t }}</span>
              </div>
              @if (settings.showExpectedLine()) {
                <div class="flex items-center gap-2">
                  <span class="inline-block w-3 h-0.5 rounded-sm bg-indigo-300"></span>
                  <span>{{ 'monthly.expectedHours' | t }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="inline-block w-px h-3 bg-slate-300"></span>
                  <span>{{ 'monthly.firstEntry' | t }}</span>
                </div>
              }
            </div>
          </div>
        </div>
        <div class="flex gap-2 text-[10px] font-medium">
          @for (p of periods; track p) {
            <button
              type="button"
              (click)="setPeriod(p)"
              class="transition-colors"
              [class.text-indigo-600]="period() === p"
              [class.font-semibold]="period() === p"
              [class.text-slate-400]="period() !== p"
              [class.hover:text-slate-600]="period() !== p"
            >{{ labelFor(p) }}</button>
          }
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <canvas
          baseChart
          [data]="chartData"
          [options]="chartOptions"
          [plugins]="chartPlugins"
          [type]="'line'"
        ></canvas>
      </div>
    </div>
  `,
})
export class MonthlyChartComponent implements OnInit, OnDestroy {
  private timeEntryService = inject(TimeEntryService);
  protected settings = inject(SettingsService);
  private holidays = inject(HolidayDatesService);
  private translation = inject(TranslationService);
  private theme = inject(ThemeService);

  formatHoursToTime = formatHoursToTime;

  readonly periods: Period[] = ['week', 'month', 'year'];
  private static readonly PERIOD_STORAGE_KEY = 'monthlyChart.period';
  period = signal<Period>(this.loadPeriod());
  worked = signal(0);
  expected = signal(0);

  balance = () => this.worked() - this.expected();
  absBalance = () => Math.abs(this.balance());

  private latestEntries: any[] = [];
  private firstEntryBucketIndex: number | null = null;
  private runningEntry: { startTime: number } | null = null;
  private liveTickSub: Subscription | null = null;
  private runningSub: Subscription | null = null;

  chartPlugins: Plugin<'line'>[] = [{
    id: 'firstEntryMarker',
    afterDatasetsDraw: (chart) => {
      if (!this.settings.showExpectedLine()) return;
      const idx = this.firstEntryBucketIndex;
      if (idx == null) return;
      const xScale = chart.scales['x'];
      const { top, bottom } = chart.chartArea;
      if (!xScale) return;
      const x = xScale.getPixelForValue(idx);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = this.theme.isDark() ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.restore();
    }
  }];

  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Hours Worked',
        data: [],
        borderColor: '#4f46e5',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(79,70,229,0.1)';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(79,70,229,0.25)');
          gradient.addColorStop(1, 'rgba(79,70,229,0)');
          return gradient;
        },
        borderWidth: 1.5,
        tension: 0.2,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBackgroundColor: '#4f46e5',
        order: 2
      },
      {
        label: 'Target',
        data: [],
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 1
      },
      {
        label: 'Expected',
        data: [],
        borderColor: 'rgba(79,70,229,0.35)',
        backgroundColor: 'rgba(79,70,229,0)',
        borderWidth: 1,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgba(79,70,229,0.5)',
        fill: false,
        order: 0
      }
    ]
  };

  chartOptions: ChartConfiguration['options'] = this.buildChartOptions();

  private buildChartOptions(): ChartConfiguration['options'] {
    const dark = this.theme.isDark();
    const tickColor = dark ? '#94a3b8' : '#64748b';
    const gridColor = dark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.25)';
    const tooltipBg = dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    const tooltipText = dark ? '#e2e8f0' : '#f8fafc';
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: tickColor,
            callback: (value) => formatHoursToTime(Number(value))
          },
          grid: { color: gridColor }
        },
        x: {
          ticks: { color: tickColor },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          callbacks: {
            label: (context) => formatHoursToTime(context.parsed.y ?? 0)
          }
        }
      }
    };
  }

  constructor() {
    effect(() => {
      // re-run when the settings change
      this.settings.showExpectedLine();
      this.settings.truncateWorkedAtToday();
      this.refresh();
    });

    effect(() => {
      // re-style chart when the theme flips
      this.theme.isDark();
      this.chartOptions = this.buildChartOptions();
      this.refresh();
    });
  }

  ngOnInit(): void {
    this.timeEntryService.entries$.subscribe(entries => {
      this.latestEntries = entries;
      this.refresh();
    });
    this.runningSub = this.timeEntryService.runningEntry$.subscribe(entry => {
      this.runningEntry = entry ? { startTime: entry.startTime } : null;
      this.updateLiveTick();
      this.refresh();
    });
  }

  ngOnDestroy(): void {
    this.liveTickSub?.unsubscribe();
    this.runningSub?.unsubscribe();
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    try {
      localStorage.setItem(MonthlyChartComponent.PERIOD_STORAGE_KEY, p);
    } catch {}
    this.updateLiveTick();
    this.refresh();
  }

  private updateLiveTick(): void {
    const shouldRun = this.runningEntry !== null && this.period() !== 'year';
    if (shouldRun && !this.liveTickSub) {
      this.liveTickSub = interval(5 * 60 * 1000).subscribe(() => this.refresh());
    } else if (!shouldRun && this.liveTickSub) {
      this.liveTickSub.unsubscribe();
      this.liveTickSub = null;
    }
  }

  private loadPeriod(): Period {
    try {
      const stored = localStorage.getItem(MonthlyChartComponent.PERIOD_STORAGE_KEY);
      if (stored === 'week' || stored === 'month' || stored === 'year') return stored;
    } catch {}
    return 'month';
  }

  labelFor(p: Period): string {
    return p === 'week' ? this.translation.t('monthly.week')
      : p === 'month' ? this.translation.t('monthly.month')
      : this.translation.t('monthly.year');
  }

  titleFor(p: Period): string {
    return p === 'week' ? this.translation.t('monthly.weeklyHours')
      : p === 'month' ? this.translation.t('monthly.monthlyHours')
      : this.translation.t('monthly.yearlyHours');
  }

  private refresh(): void {
    const result = this.computeForPeriod(this.period(), this.latestEntries);
    const target = this.targetPerUnit(this.period());

    this.worked.set(result.worked);
    this.expected.set(result.expected);
    this.firstEntryBucketIndex = result.firstEntryBucketIndex;

    this.chartData = {
      ...this.chartData,
      labels: result.labels,
      datasets: [
        { ...this.chartData.datasets![0], data: result.data },
        { ...this.chartData.datasets![1], data: result.labels.map(() => target) },
        {
          ...this.chartData.datasets![2],
          data: result.expectedPerBucket,
          hidden: !this.settings.showExpectedLine()
        }
      ]
    };
  }

  private targetPerUnit(p: Period): number {
    const workdayHours = this.settings.workdayHours();
    const weekly = this.settings.weeklyTargetHours();
    if (p === 'week' || p === 'month') return workdayHours;
    return weekly;
  }

  private pad(n: number): string { return String(n).padStart(2, '0'); }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private expectedHoursInRange(start: Date, end: Date): number {
    const isWorkday = this.settings.isWorkday();
    const holidaySet = new Set(this.holidays.getHolidayDates());
    const workdayHours = this.settings.workdayHours();
    let count = 0;
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (d <= last) {
      if (isWorkday(d.getDay()) && !holidaySet.has(this.toDateStr(d))) count++;
      d.setDate(d.getDate() + 1);
    }
    return count * workdayHours;
  }

  private computeForPeriod(period: Period, entries: any[]): PeriodResult {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const truncate = this.settings.truncateWorkedAtToday();

    const isWorkday = this.settings.isWorkday();
    const holidaySet = new Set(this.holidays.getHolidayDates());
    const workdayHours = this.settings.workdayHours();

    const firstEntryTime = entries.length
      ? entries.reduce((m, e) => Math.min(m, e.startTime), Infinity)
      : null;

    const runningHoursToday = this.runningEntry
      ? (Date.now() - this.runningEntry.startTime) / 3600000
      : 0;
    const todayStartMs = today.getTime();
    const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000 - 1;
    const runningStartedToday = !!this.runningEntry
      && this.runningEntry.startTime >= todayStartMs
      && this.runningEntry.startTime <= todayEndMs;

    if (period === 'week') {
      const { start: weekStart, end: weekEnd } = this.settings.getWeekBoundaries(now);
      const labels: string[] = [];
      const data: (number | null)[] = [];
      const expectedPerBucket: number[] = [];
      const dayNames = [0, 1, 2, 3, 4, 5, 6].map(d => this.translation.t(('day.abbr.' + d) as any));
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        labels.push(dayNames[d.getDay()]);
        const dStart = d.getTime();
        const dEnd = dStart + 24 * 60 * 60 * 1000 - 1;
        const isFuture = truncate && d.getTime() > today.getTime();
        if (isFuture) {
          data.push(null);
        } else {
          const hours = entries
            .filter(e => e.startTime >= dStart && e.startTime <= dEnd)
            .reduce((s, e) => s + e.duration / 3600000, 0);
          data.push(hours);
        }
        const exp = isWorkday(d.getDay()) && !holidaySet.has(this.toDateStr(d)) ? workdayHours : 0;
        expectedPerBucket.push(exp);
      }
      if (runningStartedToday) {
        const dayMs = 24 * 60 * 60 * 1000;
        const todayIdx = Math.floor((today.getTime() - weekStart.getTime()) / dayMs);
        if (todayIdx >= 0 && todayIdx < 7 && data[todayIdx] !== null) {
          data[todayIdx] = (data[todayIdx] as number) + runningHoursToday;
        }
      }
      const worked = data.reduce((s: number, v) => s + (v ?? 0), 0);
      const expectedEnd = today < weekEnd ? today : weekEnd;
      const expected = this.expectedHoursInRange(weekStart, expectedEnd);
      let firstEntryBucketIndex: number | null = null;
      if (firstEntryTime != null && firstEntryTime >= weekStart.getTime() && firstEntryTime <= weekEnd.getTime()) {
        const fd = new Date(firstEntryTime);
        const dayMs = 24 * 60 * 60 * 1000;
        firstEntryBucketIndex = Math.floor((new Date(fd.getFullYear(), fd.getMonth(), fd.getDate()).getTime() - weekStart.getTime()) / dayMs);
      }
      return { labels, data, expectedPerBucket, worked, expected, firstEntryBucketIndex };
    }

    if (period === 'month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const data: (number | null)[] = Array(daysInMonth).fill(0);
      if (truncate) {
        const todayDay = now.getDate();
        for (let i = todayDay; i < daysInMonth; i++) data[i] = null;
      }
      const monthStart = new Date(year, month, 1).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      entries
        .filter(e => e.startTime >= monthStart && e.startTime <= monthEnd)
        .forEach(e => {
          const day = new Date(e.startTime).getDate() - 1;
          if (data[day] !== null) data[day] = (data[day] as number) + e.duration / 3600000;
        });
      const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const expectedPerBucket: number[] = [];
      for (let i = 0; i < daysInMonth; i++) {
        const d = new Date(year, month, i + 1);
        const exp = isWorkday(d.getDay()) && !holidaySet.has(this.toDateStr(d)) ? workdayHours : 0;
        expectedPerBucket.push(exp);
      }
      if (runningStartedToday) {
        const dayIdx = now.getDate() - 1;
        if (data[dayIdx] !== null) {
          data[dayIdx] = (data[dayIdx] as number) + runningHoursToday;
        }
      }
      const worked = data.reduce((s: number, v) => s + (v ?? 0), 0);
      const lastDay = new Date(year, month, Math.min(now.getDate(), daysInMonth));
      const expected = this.expectedHoursInRange(new Date(year, month, 1), lastDay);
      let firstEntryBucketIndex: number | null = null;
      if (firstEntryTime != null && firstEntryTime >= monthStart && firstEntryTime <= monthEnd) {
        firstEntryBucketIndex = new Date(firstEntryTime).getDate() - 1;
      }
      return { labels, data, expectedPerBucket, worked, expected, firstEntryBucketIndex };
    }

    // year — weeks from Jan 1 to Dec 31 of current year
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    // Align to configured first day of week, but keep the bucket clipped to the year.
    const { start: firstWeekStart } = this.settings.getWeekBoundaries(yearStart);
    const weeks: { start: Date; end: Date }[] = [];
    let ws = new Date(firstWeekStart);
    while (ws <= yearEnd) {
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      const bucketStart = ws < yearStart ? yearStart : ws;
      const bucketEnd = we > yearEnd ? yearEnd : we;
      weeks.push({ start: bucketStart, end: bucketEnd });
      ws = new Date(ws);
      ws.setDate(ws.getDate() + 7);
    }
    const data: (number | null)[] = weeks.map(({ start, end }) => {
      if (truncate && start.getTime() > today.getTime()) return null;
      return entries
        .filter(e => e.startTime >= start.getTime() && e.startTime <= end.getTime())
        .reduce((s, e) => s + e.duration / 3600000, 0);
    });
    const expectedPerBucket = weeks.map(({ start, end }) => this.expectedHoursInRange(start, end));
    const labels = weeks.map(({ start }) => `${this.pad(start.getMonth() + 1)}/${this.pad(start.getDate())}`);
    const worked = data.reduce((s: number, v) => s + (v ?? 0), 0);
    const rangeEnd = today < yearEnd ? today : yearEnd;
    const expected = this.expectedHoursInRange(yearStart, rangeEnd);
    let firstEntryBucketIndex: number | null = null;
    if (firstEntryTime != null && firstEntryTime >= yearStart.getTime() && firstEntryTime <= yearEnd.getTime()) {
      firstEntryBucketIndex = weeks.findIndex(({ start, end }) => firstEntryTime >= start.getTime() && firstEntryTime <= end.getTime());
      if (firstEntryBucketIndex === -1) firstEntryBucketIndex = null;
    }
    return { labels, data, expectedPerBucket, worked, expected, firstEntryBucketIndex };
  }
}
