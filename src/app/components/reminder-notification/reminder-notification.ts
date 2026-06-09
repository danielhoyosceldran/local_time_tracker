import { AfterViewInit, Component, ChangeDetectorRef, ViewChild, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KENDO_TIMEPICKER, TimePickerComponent } from '@progress/kendo-angular-dateinputs';
import { ReminderService } from '../../services/reminder.service';
import { SettingsService } from '../../services/settings.service';
import { kendoTimeFormat } from '../../utils/format';
import { SOUNDS, SoundId } from '../../shared/sounds';
import { SoundPickerService } from '../../shared/sound-picker.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n';

function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-reminder-notification',
  standalone: true,
  imports: [FormsModule, KENDO_TIMEPICKER, TranslatePipe],
  styles: [`
    .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--tt-surface-strong, #cbd5e1); border-radius: 20px; transition: .2s; }
    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #f8fafc; border-radius: 50%; transition: .2s; }
    input:checked + .slider { background-color: #7c3aed; }
    input:checked + .slider:before { transform: translateX(16px); }
  `],
  template: `
    <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm shadow-slate-200/50 border border-white p-3 h-full flex flex-col overflow-y-auto">

      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9">
            </path>
          </svg>
          <h3 class="font-bold text-slate-800 text-sm">{{ 'reminder.title' | t }}</h3>
        </div>
        <label class="switch">
          <input type="checkbox" [checked]="svc.enabled()" (change)="toggleEnabled($event)" />
          <span class="slider"></span>
        </label>
      </div>

      <p class="text-[11px] text-slate-500 mb-2 leading-tight">
        {{ 'reminder.subtitle' | t }}
      </p>

      <div class="mt-auto flex flex-col gap-2" [class.opacity-40]="!svc.enabled()" [class.pointer-events-none]="!svc.enabled()">

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">{{ 'reminder.time' | t }}</label>
          <kendo-timepicker
            #timePicker
            [value]="timeDate()"
            (valueChange)="setTime($event)"
            [format]="timeFormat()"
            [steps]="{ hour: 1, minute: 1 }"
            [fillMode]="'outline'"
            [size]="'small'"
          ></kendo-timepicker>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">{{ 'reminder.messageLabel' | t }}</label>
          <input
            type="text"
            [ngModel]="svc.message()"
            (ngModelChange)="svc.setMessage($event)"
            [placeholder]="'reminder.placeholder' | t"
            maxlength="80"
            class="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <button
          type="button"
          (click)="openSoundPicker()"
          class="w-full flex items-center justify-between px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <span class="text-xs font-medium text-slate-600">{{ 'reminder.sound' | t }}</span>
          </div>
          <span class="text-xs text-slate-400">{{ soundLabel() }}</span>
        </button>

      </div>
    </div>
  `,
})
export class ReminderNotificationComponent implements AfterViewInit {
  @ViewChild('timePicker') timePicker!: TimePickerComponent;
  svc = inject(ReminderService);
  private cdr = inject(ChangeDetectorRef);
  private soundPicker = inject(SoundPickerService);
  private translation = inject(TranslationService);
  private settings = inject(SettingsService);

  readonly timeFormat = computed(() => kendoTimeFormat(this.settings.timeFormat()));

  timeDate(): Date { return timeStringToDate(this.svc.time()); }
  soundLabel(): string { return SOUNDS.find(s => s.id === this.svc.sound())?.label ?? ''; }

  openSoundPicker(): void {
    this.soundPicker.open({
      title: this.translation.t('sound.reminderTitle'),
      current: this.svc.sound,
      onSelect: (id) => this.svc.setSound(id),
    });
  }

  async toggleEnabled(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const ok = await this.svc.setEnabled(input.checked);
    if (!ok) input.checked = false;
    this.cdr.detectChanges();
  }

  setTime(d: Date | null): void {
    if (d) this.svc.setTime(dateToTimeString(d));
  }

  previewSound(id: SoundId): void {
    // kept for compatibility if the sound-picker preview button is used
    void id;
  }

  ngAfterViewInit(): void {
    if (this.timePicker) {
      this.timePicker.toggle(true);
      this.cdr.detectChanges();
      setTimeout(() => {
        this.timePicker.toggle(false);
        this.cdr.detectChanges();
      }, 0);
    }
  }
}
