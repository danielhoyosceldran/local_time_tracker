// src/app/components/compact-holiday-calendar/compact-holiday-calendar.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HolidayDatesService } from '../../services/holiday-dates.service';
import { HolidayService, HolidayData } from '../../services/holiday.service';
import { Observable } from 'rxjs';

interface DayCell {
  date: string | null; // 'YYYY-MM-DD' or null for padding
  day: number | null;
  isWeekend: boolean;
}

interface MonthData {
  name: string;
  weeks: DayCell[][];
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAY_HEADERS = ['M','T','W','T','F','S','S'];

function buildMonthData(year: number, month: number): MonthData {
  const firstDay = new Date(year, month, 1);
  // Monday=0 ... Sunday=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: null, day: null, isWeekend: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dow = dateObj.getDay(); // 0=Sun
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ date: dateStr, day: d, isWeekend: dow === 0 || dow === 6 });
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, isWeekend: false });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { name: MONTH_NAMES[month], weeks };
}

@Component({
  selector: 'app-compact-holiday-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .month-cell {
      flex: 1 1 250px;
      min-width: 130px;
      max-width: 250px;
    }
  `],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 h-full flex flex-col overflow-hidden">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-2 shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <h3 class="text-slate-900 font-semibold text-sm">Holiday Calendar {{ currentYear }}</h3>
        </div>
        <span class="text-xs text-slate-400">{{ holidayCount() }} public</span>
      </div>

      <!-- Vacation Days bar -->
      @if (holidays$ | async; as h) {
        <div class="flex items-center gap-2 mb-2 px-2 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 shrink-0 text-xs">
          <!-- Remaining badge -->
          <div class="flex items-center gap-1 mr-1">
            <span class="text-xl font-bold text-indigo-600 leading-none">{{ h.total - holidayCount() }}</span>
            <span class="text-indigo-400 leading-none">left</span>
          </div>
          <div class="w-px h-5 bg-indigo-200"></div>
          <!-- Total -->
          <span class="text-slate-500">Total</span>
          @if (editMode()) {
            <input
              type="number"
              [(ngModel)]="editTotal"
              (keyup.enter)="saveEdit()"
              (keyup.escape)="cancelEdit()"
              class="w-10 px-1 py-0.5 border border-indigo-300 rounded text-slate-900 font-semibold text-center focus:ring-1 focus:ring-indigo-500"
              autofocus
            />
            <button (click)="saveEdit()" class="text-green-600 hover:text-green-700" title="Save">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button (click)="cancelEdit()" class="text-red-500 hover:text-red-600" title="Cancel">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          } @else {
            <span class="font-semibold text-slate-700">{{ h.total }}</span>
            <button (click)="startEdit(h.total)" class="text-slate-400 hover:text-indigo-500" title="Edit total">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          }
          <div class="w-px h-5 bg-indigo-200"></div>
          <!-- Used (auto-counted from marked days) -->
          <span class="text-slate-500">Used</span>
          <span class="font-semibold text-orange-600 min-w-[1.25rem] text-center">{{ holidayCount() }}</span>
        </div>
      }

      <!-- Year grid -->
      <div class="flex-1 overflow-y-auto">
        <div class="flex flex-wrap gap-2 justify-center">
          @for (month of months; track month.name) {
            <div class="month-cell">
              <!-- Month name -->
              <div class="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 text-center">
                {{ month.name }}
              </div>
              <!-- Day headers -->
              <div class="grid grid-cols-7 mb-0.5">
                @for (d of dayHeaders; track d + $index) {
                  <div class="text-[8px] text-slate-400 text-center font-medium">{{ d }}</div>
                }
              </div>
              <!-- Weeks -->
              @for (week of month.weeks; track $index) {
                <div class="grid grid-cols-7">
                  @for (cell of week; track $index) {
                    <div
                      class="aspect-square flex items-center justify-center text-[9px] rounded-sm select-none transition-colors"
                      [ngClass]="{
                        'cursor-default pointer-events-none text-transparent': !cell.date,
                        'bg-teal-500 text-white font-semibold': cell.date && isHoliday(cell.date),
                        'text-slate-400': cell.date && !isHoliday(cell.date) && cell.isWeekend,
                        'text-slate-600 cursor-pointer hover:bg-teal-100': cell.date && !isHoliday(cell.date) && !cell.isWeekend,
                        'cursor-pointer hover:bg-teal-200': cell.date && isHoliday(cell.date),
                        'ring-1 ring-slate-400': cell.date === today
                      }"
                      (click)="toggleHoliday(cell.date)"
                    >{{ cell.day }}</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CompactHolidayCalendarComponent implements OnInit {
  private holidayDatesService = inject(HolidayDatesService);
  private holidayService = inject(HolidayService);

  currentYear = new Date().getFullYear();
  today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  dayHeaders = DAY_HEADERS;
  months: MonthData[] = [];

  private holidaySet = signal<Set<string>>(new Set());
  holidayCount = computed(() => this.holidaySet().size);

  holidays$: Observable<HolidayData> = this.holidayService.holidays$;
  editMode = signal(false);
  editTotal = signal(22);

  ngOnInit(): void {
    this.months = Array.from({ length: 12 }, (_, i) => buildMonthData(this.currentYear, i));
    this.holidayDatesService.holidayDates$.subscribe(dates => {
      this.holidaySet.set(new Set(dates));
    });
  }

  isHoliday(date: string | null): boolean {
    return !!date && this.holidaySet().has(date);
  }

  toggleHoliday(date: string | null): void {
    if (!date) return;
    if (this.holidaySet().has(date)) {
      this.holidayDatesService.removeHolidayDate(date);
    } else {
      this.holidayDatesService.addHolidayDate(date);
    }
  }

  startEdit(current: number): void {
    this.editTotal.set(current);
    this.editMode.set(true);
  }

  saveEdit(): void {
    this.holidayService.updateTotal(this.editTotal());
    this.editMode.set(false);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

}
