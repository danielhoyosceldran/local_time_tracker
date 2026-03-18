import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (this.permission === 'granted') return true;

    this.permission = await Notification.requestPermission();
    return this.permission === 'granted';
  }

  notify(title: string, body: string, icon?: string): void {
    if (!('Notification' in window) || this.permission !== 'granted') return;

    new Notification(title, { body, icon, silent: false, requireInteraction: true });
  }
}
