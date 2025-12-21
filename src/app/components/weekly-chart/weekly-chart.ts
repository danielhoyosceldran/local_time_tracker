// src/app/components/weekly-chart/weekly-chart.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TimeEntryService } from '../../services/time-entry';
import { formatHoursToTime } from '../../utils/format';

@Component({
  selector: 'app-weekly-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <h3 class="text-slate-900 font-semibold mb-3">Weekly Hours</h3>
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
export class WeeklyChartComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);

  chartData: ChartConfiguration['data'] = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Hours Worked',
        data: [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        order: 2
      },
      {
        label: '8h Target',
        data: [8, 8, 8, 8, 8, 8, 8],
        borderColor: '#6a67aaff',
        borderWidth: 1,
        borderDash: [5, 5],
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
      const weekData = this.calculateWeekData(entries);
      this.chartData = {
        ...this.chartData,
        datasets: [
          {
            ...this.chartData.datasets![0],
            data: weekData
          },
          this.chartData.datasets![1]
        ]
      };
    });
  }

  private calculateWeekData(entries: any[]): number[] {
    // Get current week boundaries
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Initialize 7 days with 0 hours
    const hoursPerDay = [0, 0, 0, 0, 0, 0, 0];

    // Filter entries in current week
    const weekEntries = entries.filter(e =>
      e.startTime >= monday.getTime() && e.startTime <= sunday.getTime()
    );

    // Sum hours per day
    weekEntries.forEach(entry => {
      const entryDate = new Date(entry.startTime);
      const dayOfWeek = entryDate.getDay();
      // Convert Sunday (0) to index 6, Monday (1) to index 0, etc.
      const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      hoursPerDay[index] += entry.duration / (1000 * 60 * 60);
    });

    return hoursPerDay;
  }
}
