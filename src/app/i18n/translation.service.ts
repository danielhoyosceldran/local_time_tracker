import { Injectable, computed, signal } from '@angular/core';
import { en, TranslationKey } from './translations/en';
import { es } from './translations/es';
import { ca } from './translations/ca';

export type Language = 'en' | 'es' | 'ca';
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'es', 'ca'];
export const DEFAULT_LANGUAGE: Language = 'en';

const STORAGE_KEY = 'tt.language';

const DICTS: Record<Language, Record<TranslationKey, string>> = {
  en,
  es,
  ca,
};

function loadLanguage(): Language {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && (SUPPORTED_LANGUAGES as string[]).includes(v)) return v as Language;
  return DEFAULT_LANGUAGE;
}

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly language = signal<Language>(loadLanguage());
  private dict = computed(() => DICTS[this.language()]);

  setLanguage(lang: Language): void {
    if (!(SUPPORTED_LANGUAGES as string[]).includes(lang)) return;
    this.language.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let str = this.dict()[key] ?? en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  }
}
