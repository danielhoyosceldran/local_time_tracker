// src/app/services/device-identity.service.ts
import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { EntryOrigin } from '../models/time-entry.model';

/**
 * Stable per-browser identity used to mark WHO started a (shared) running
 * timer. The id is generated once and stored device-locally.
 *
 * IMPORTANT: `tt.deviceId` is intentionally NOT registered in
 * KNOWN_STORAGE_KEYS — like `gistConfig`, it must never travel inside the gist
 * payload or the downloadable backup. If it did, every device that imported the
 * backup would share the same id and the "only the starter can pause/stop"
 * guard would let everyone control everyone's timer.
 */
const DEVICE_ID_KEY = 'tt.deviceId';

@Injectable({ providedIn: 'root' })
export class DeviceIdentityService {
  /** Resolved once per session; the id is stable across reloads. */
  private readonly identity: EntryOrigin = this.resolve();

  /** Identity stamped onto entries this device starts. */
  current(): EntryOrigin {
    return { ...this.identity };
  }

  /** This device's stable id (cheap accessor for ownership checks). */
  get deviceId(): string {
    return this.identity.deviceId;
  }

  private resolve(): EntryOrigin {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return {
      deviceId: id,
      deviceName: `Equipo-${id.slice(0, 4).toUpperCase()}`,
      browser: detectBrowser(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    };
  }
}

/** Best-effort browser family from the user agent. Order matters (Edge/Opera
 *  both embed "Chrome"; check the more specific markers first). */
function detectBrowser(ua: string): string {
  if (/\bEdg\//i.test(ua)) return 'Edge';
  if (/\bOPR\/|\bOpera\b/i.test(ua)) return 'Opera';
  if (/\bFirefox\//i.test(ua)) return 'Firefox';
  if (/\bChrome\//i.test(ua)) return 'Chrome';
  if (/\bSafari\//i.test(ua) && /\bVersion\//i.test(ua)) return 'Safari';
  return 'Navegador';
}
