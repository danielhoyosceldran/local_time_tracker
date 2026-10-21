// src/app/services/cloud/cloud-config.service.ts
import { Injectable, signal } from '@angular/core';

/** Supabase project this device connects to. Device-local, never exported. */
export interface CloudConfig {
  /** Project URL, e.g. https://abcd.supabase.co */
  url: string;
  /** Publishable (anon) key. Public by design; RLS protects the data. */
  key: string;
}

const CONFIG_KEY = 'tt.cloud.config';
const CODE_PREFIX = 'tt1:';

/**
 * Holds the Supabase connection config. Like the device id, this key is NOT in
 * KNOWN_STORAGE_KEYS: it describes where this device syncs to, not a user
 * preference, so it never travels in backups or to the cloud itself.
 */
@Injectable({ providedIn: 'root' })
export class CloudConfigService {
  private _config = signal<CloudConfig | null>(this.load());
  readonly config = this._config.asReadonly();

  private load(): CloudConfig | null {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /** Persist a config. Returns false if the URL/key are not plausible. */
  save(config: CloudConfig): boolean {
    const normalized = normalizeConfig(config);
    if (!normalized) return false;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    this._config.set(normalized);
    return true;
  }

  clear(): void {
    localStorage.removeItem(CONFIG_KEY);
    this._config.set(null);
  }

  /** Shareable code with the URL and public key (never credentials). */
  encodeConnectionCode(): string | null {
    const c = this._config();
    if (!c) return null;
    return CODE_PREFIX + btoa(JSON.stringify({ u: c.url, k: c.key }));
  }

  /** Parse a connection code; null if it is not valid. */
  decodeConnectionCode(code: string): CloudConfig | null {
    const trimmed = code.trim();
    if (!trimmed.startsWith(CODE_PREFIX)) return null;
    try {
      const parsed = JSON.parse(atob(trimmed.slice(CODE_PREFIX.length)));
      return normalizeConfig({ url: parsed?.u, key: parsed?.k });
    } catch {
      return null;
    }
  }
}

function normalizeConfig(value: unknown): CloudConfig | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<CloudConfig>;
  const url = typeof v.url === 'string' ? v.url.trim().replace(/\/+$/, '') : '';
  const key = typeof v.key === 'string' ? v.key.trim() : '';
  if (!/^https?:\/\/[^\s/]+/i.test(url) || key.length < 20) return null;
  return { url, key };
}
