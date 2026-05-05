import { Injectable, signal } from '@angular/core';

export type LeftPanelTab = 'calendar' | 'intervals';

@Injectable({ providedIn: 'root' })
export class ViewStateService {
  readonly activeTab = signal<LeftPanelTab>('calendar');

  setTab(tab: LeftPanelTab): void {
    this.activeTab.set(tab);
  }
}
