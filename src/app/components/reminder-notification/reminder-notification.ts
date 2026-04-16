import { AfterViewInit, Component, inject, OnDestroy, signal, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KENDO_TIMEPICKER, TimePickerComponent } from '@progress/kendo-angular-dateinputs';
import { NotificationService } from '../../services/notification.service';
import { SOUNDS, SoundId, playSound } from '../../shared/sounds';
import { SoundPickerModalComponent } from '../../shared/sound-picker-modal';

const STORAGE_KEY_ENABLED  = 'timeTrackerReminderEnabled';
const STORAGE_KEY_TIME     = 'timeTrackerReminderTime';
const STORAGE_KEY_MESSAGE  = 'timeTrackerReminderMessage';
const STORAGE_KEY_SOUND    = 'timeTrackerReminderSound';

function timeStringToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function nowTimeString(): string {
  return dateToTimeString(new Date());
}

@Component({
  selector: 'app-reminder-notification',
  standalone: true,
  imports: [FormsModule, KENDO_TIMEPICKER, SoundPickerModalComponent],
  styles: [`
    .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; border-radius: 20px; transition: .2s; }
    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s; }
    input:checked + .slider { background-color: #7c3aed; }
    input:checked + .slider:before { transform: translateX(16px); }
  `],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-3 h-full flex flex-col overflow-y-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9">
            </path>
          </svg>
          <h3 class="font-bold text-slate-800 text-sm">Reminder</h3>
        </div>
        <label class="switch">
          <input type="checkbox" [checked]="enabled()" (change)="toggleEnabled($event)" />
          <span class="slider"></span>
        </label>
      </div>

      <!-- Description -->
      <p class="text-[11px] text-slate-500 mb-2 leading-tight">
        Sends a browser notification at the configured time every day.
      </p>

      <!-- Inputs -->
      <div class="mt-auto flex flex-col gap-2" [class.opacity-40]="!enabled()" [class.pointer-events-none]="!enabled()">

        <!-- Time -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Time</label>
          <kendo-timepicker
            #timePicker
            [value]="reminderTimeDate()"
            (valueChange)="setTime($event)"
            [format]="'HH:mm'"
            [steps]="{ hour: 1, minute: 1 }"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-timepicker>
        </div>

        <!-- Message -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Message</label>
          <input
            type="text"
            [ngModel]="message()"
            (ngModelChange)="setMessage($event)"
            placeholder="Reminder!"
            maxlength="80"
            class="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <!-- Sound -->
        <button
          type="button"
          (click)="soundModalOpen.set(true)"
          class="w-full flex items-center justify-between px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <span class="text-xs font-medium text-slate-600">Sound</span>
          </div>
          <span class="text-xs text-slate-400">{{ selectedSoundLabel() }}</span>
        </button>

        @if (soundModalOpen()) {
          <app-sound-picker-modal
            title="Reminder sound"
            [current]="selectedSound()"
            (soundSelected)="setSound($event)"
            (closed)="soundModalOpen.set(false)"
          />
        }

      </div>
    </div>
  `,
})
export class ReminderNotificationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('timePicker') timePicker!: TimePickerComponent;

  private notificationService = inject(NotificationService);

  enabled           = signal<boolean>(this.loadBool(STORAGE_KEY_ENABLED, false));
  reminderTimeDate  = signal<Date>(timeStringToDate(this.loadStr(STORAGE_KEY_TIME, '09:00')));
  message           = signal<string>(this.loadStr(STORAGE_KEY_MESSAGE, 'Reminder!'));
  selectedSound     = signal<SoundId>(this.loadStr(STORAGE_KEY_SOUND, 'beep') as SoundId);
  soundModalOpen    = signal<boolean>(false);

  selectedSoundLabel() {
    return SOUNDS.find(s => s.id === this.selectedSound())?.label ?? '';
  }

  private lastFiredDate = '';
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private cdr: ChangeDetectorRef) {
    this.startInterval();
  }

  ngAfterViewInit() {
    this.forceInitialRender();
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private forceInitialRender() {
    if (this.timePicker) {
      this.timePicker.toggle(true);
      this.cdr.detectChanges();
      setTimeout(() => {
        this.timePicker.toggle(false);
        this.cdr.detectChanges();
      }, 0);
    }
  }

  private startInterval() {
    this.intervalId = setInterval(() => this.checkAndNotify(), 15_000);
  }

  private checkAndNotify() {
    if (!this.enabled()) return;
    const configuredTime = dateToTimeString(this.reminderTimeDate());
    const now   = nowTimeString();
    const today = new Date().toDateString();
    if (now === configuredTime && this.lastFiredDate !== today) {
      this.lastFiredDate = today;
      this.notificationService.requestPermission().then(granted => {
        if (granted) {
          this.notificationService.notify('Reminder', this.message() || 'Reminder!');
        }
      });
      playSound(this.selectedSound());
    }
  }

  async toggleEnabled(event: Event) {
    const input   = event.target as HTMLInputElement;
    const checked = input.checked;

    this.enabled.set(checked);
    localStorage.setItem(STORAGE_KEY_ENABLED, String(checked));
    this.cdr.detectChanges();

    if (checked) {
      const granted = await this.notificationService.requestPermission();
      if (!granted) {
        this.enabled.set(false);
        localStorage.setItem(STORAGE_KEY_ENABLED, 'false');
        input.checked = false;
        this.cdr.detectChanges();
      }
    }
  }

  setTime(date: Date | null) {
    if (date) {
      this.reminderTimeDate.set(date);
      localStorage.setItem(STORAGE_KEY_TIME, dateToTimeString(date));
      this.lastFiredDate = '';
    }
  }

  setMessage(value: string) {
    this.message.set(value);
    localStorage.setItem(STORAGE_KEY_MESSAGE, value);
  }

  setSound(id: SoundId) {
    this.selectedSound.set(id);
    localStorage.setItem(STORAGE_KEY_SOUND, id);
  }

  previewSound(id: SoundId) {
    playSound(id);
  }

  private loadBool(key: string, def: boolean): boolean {
    const v = localStorage.getItem(key);
    return v !== null ? v === 'true' : def;
  }

  private loadStr(key: string, def: string): string {
    return localStorage.getItem(key) ?? def;
  }
}
