// src/app/components/monthly-chart/monthly-chart.ts
import { Component, inject, OnInit } from '@angular/core';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TimeEntryService } from '../../services/time-entry';
import { formatHoursToTime } from '../../utils/format';

@Component({
  selector: 'app-monthly-chart',
  standalone: true,
  imports: [BaseChartDirective],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-4 h-full flex flex-col overflow-y-auto">
      <h3 class="text-slate-800 font-bold mb-3">Monthly Hours</h3>
      <div class="flex-1 min-h-0">
        <canvas
          baseChart
          [data]="chartData"
          [options]="chartOptions"
          [type]="'line'"
        ></canvas>
      </div>
    </div>
  `,
})
export class MonthlyChartComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);

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
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBackgroundColor: '#4f46e5',
        order: 2
      },
      {
        label: '8h Target',
        data: [],
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 1
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
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => formatHoursToTime(context.parsed.y ?? 0)
        }
      }
    }
  };

  ngOnInit(): void {
    this.timeEntryService.entries$.subscribe(entries => {
      const { labels, data } = this.calculateMonthData(entries);
      this.chartData = {
        ...this.chartData,
        labels,
        datasets: [
          { ...this.chartData.datasets![0], data },
          { ...this.chartData.datasets![1], data: labels.map(() => 8) }
        ]
      };
    });
  }

  private calculateMonthData(entries: any[]): { labels: string[]; data: number[] } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const hoursPerDay = Array(daysInMonth).fill(0);

    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    entries
      .filter(e => e.startTime >= monthStart && e.startTime <= monthEnd)
      .forEach(entry => {
        const day = new Date(entry.startTime).getDate() - 1;
        hoursPerDay[day] += entry.duration / (1000 * 60 * 60);
      });

    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    return { labels, data: hoursPerDay };
  }
}
