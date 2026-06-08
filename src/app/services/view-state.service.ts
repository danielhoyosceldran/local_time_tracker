import { Injectable, signal } from '@angular/core';
import type { TranslationKey } from '../i18n';

export type LeftPanelTab = 'calendar' | 'intervals';

/** Paneles seleccionables en la navegación móvil (uno a pantalla completa). */
export type MobileView =
  | 'timer'
  | 'daily'
  | 'weekly'
  | 'calendar'
  | 'intervals'
  | 'pomodoro'
  | 'chart'
  | 'reminder'
  | 'tenure';

/** Orden y etiquetas del menú lateral móvil. Fuente única de verdad. */
export const MOBILE_VIEWS: { id: MobileView; labelKey: TranslationKey }[] = [
  { id: 'timer', labelKey: 'view.timer' },
  { id: 'daily', labelKey: 'view.daily' },
  { id: 'weekly', labelKey: 'view.weekly' },
  { id: 'calendar', labelKey: 'view.calendar' },
  { id: 'intervals', labelKey: 'view.intervals' },
  { id: 'pomodoro', labelKey: 'view.pomodoro' },
  { id: 'chart', labelKey: 'view.chart' },
  { id: 'reminder', labelKey: 'view.reminder' },
  { id: 'tenure', labelKey: 'view.tenure' },
];

@Injectable({ providedIn: 'root' })
export class ViewStateService {
  readonly activeTab = signal<LeftPanelTab>('calendar');

  /** Panel visible a pantalla completa en móvil. */
  readonly mobileView = signal<MobileView>('timer');

  setTab(tab: LeftPanelTab): void {
    this.activeTab.set(tab);
  }

  setMobileView(view: MobileView): void {
    this.mobileView.set(view);
    // Mantén las pestañas calendario/intervalos coherentes con la vista móvil.
    if (view === 'calendar' || view === 'intervals') {
      this.activeTab.set(view);
    }
  }
}
