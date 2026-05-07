// src/app/components/monthly-chart/monthly-chart.ts
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Plugin } from 'chart.js';
import { TimeEntryService } from '../../services/time-entry';
import { SettingsService } from '../../services/settings.service';
import { HolidayDatesService } from '../../services/holiday-dates.service';
import { formatHoursToTime } from '../../utils/format';

type Period = 'week' | 'month' | 'year';

interface PeriodResult {
  labels: string[];
  data: number[];
  expectedPerBucket: number[];
  worked: number;
  expected: number;
  firstEntryBucketIndex: number | null;
}

@Component({
  selector: 'app-monthly-chart',
  standalone: true,
  imports: [BaseChartDirective, CommonModule],
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
                <span>Horas trabajadas (área)</span>
              </div>
              @if (settings.showExpectedLine()) {
                <div class="flex items-center gap-2">
                  <span class="inline-block w-3 h-0.5 rounded-sm bg-indigo-300"></span>
                  <span>Horas esperadas</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="inline-block w-px h-3 bg-slate-300"></span>
                  <span>Primer registro</span>
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
export class MonthlyChartComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);
  protected settings = inject(SettingsService);
  private holidays = inject(HolidayDatesService);

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
      ctx.strokeStyle = 'rgba(148,163,184,0.6)';
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

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatHoursToTime(Number(value))
        }
      },
      x: {
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => formatHoursToTime(context.parsed.y ?? 0)
        }
      }
    }
  };

  constructor() {
    effect(() => {
      // re-run when the setting changes
      this.settings.showExpectedLine();
      this.refresh();
    });
  }

  ngOnInit(): void {
    this.timeEntryService.entries$.subscribe(entries => {
      this.latestEntries = entries;
      this.refresh();
    });
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    try {
      localStorage.setItem(MonthlyChartComponent.PERIOD_STORAGE_KEY, p);
    } catch {}
    this.refresh();
  }

  private loadPeriod(): Period {
    try {
      const stored = localStorage.getItem(MonthlyChartComponent.PERIOD_STORAGE_KEY);
      if (stored === 'week' || stored === 'month' || stored === 'year') return stored;
    } catch {}
    return 'month';
  }

  labelFor(p: Period): string {
    return p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year';
  }

  titleFor(p: Period): string {
    return p === 'week' ? 'Weekly Hours'
      : p === 'month' ? 'Monthly Hours'
      : 'Yearly Hours';
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

    const isWorkday = this.settings.isWorkday();
    const holidaySet = new Set(this.holidays.getHolidayDates());
    const workdayHours = this.settings.workdayHours();

    const firstEntryTime = entries.length
      ? entries.reduce((m, e) => Math.min(m, e.startTime), Infinity)
      : null;

    if (period === 'week') {
      const { start: weekStart, end: weekEnd } = this.settings.getWeekBoundaries(now);
      const labels: string[] = [];
      const data: number[] = [];
      const expectedPerBucket: number[] = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        labels.push(dayNames[d.getDay()]);
        const dStart = d.getTime();
        const dEnd = dStart + 24 * 60 * 60 * 1000 - 1;
        const hours = entries
          .filter(e => e.startTime >= dStart && e.startTime <= dEnd)
          .reduce((s, e) => s + e.duration / 3600000, 0);
        data.push(hours);
        const exp = isWorkday(d.getDay()) && !holidaySet.has(this.toDateStr(d)) ? workdayHours : 0;
        expectedPerBucket.push(exp);
      }
      const worked = data.reduce((s, v) => s + v, 0);
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
      const data = Array(daysInMonth).fill(0);
      const monthStart = new Date(year, month, 1).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      entries
        .filter(e => e.startTime >= monthStart && e.startTime <= monthEnd)
        .forEach(e => {
          const day = new Date(e.startTime).getDate() - 1;
          data[day] += e.duration / 3600000;
        });
      const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const expectedPerBucket: number[] = [];
      for (let i = 0; i < daysInMonth; i++) {
        const d = new Date(year, month, i + 1);
        const exp = isWorkday(d.getDay()) && !holidaySet.has(this.toDateStr(d)) ? workdayHours : 0;
        expectedPerBucket.push(exp);
      }
      const worked = data.reduce((s, v) => s + v, 0);
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
    const data = weeks.map(({ start, end }) =>
      entries
        .filter(e => e.startTime >= start.getTime() && e.startTime <= end.getTime())
        .reduce((s, e) => s + e.duration / 3600000, 0)
    );
    const expectedPerBucket = weeks.map(({ start, end }) => this.expectedHoursInRange(start, end));
    const labels = weeks.map(({ start }) => `${this.pad(start.getMonth() + 1)}/${this.pad(start.getDate())}`);
    const worked = data.reduce((s, v) => s + v, 0);
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
