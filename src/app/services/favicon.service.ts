import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FaviconService {
  private link: HTMLLinkElement;

  constructor() {
    this.link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
    if (!this.link) {
      this.link = document.createElement('link');
      this.link.rel = 'icon';
      this.link.type = 'image/x-icon';
      document.head.appendChild(this.link);
    }
  }

  setWork(): void {
    this.link.href = 'favicon-work.ico';
  }

  setBreak(): void {
    this.link.href = 'favicon-break.ico';
  }
}
