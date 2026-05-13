import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tt.themeMode';
const DEFAULT: ThemeMode = 'system';

function loadMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(loadMode());

  private readonly systemDark = signal<boolean>(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );

  readonly isDark = computed(() =>
    this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark())
  );

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
      mq.addEventListener?.('change', handler);
    }

    effect(() => {
      const dark = this.isDark();
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }
}
