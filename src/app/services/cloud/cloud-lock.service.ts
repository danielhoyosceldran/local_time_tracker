// src/app/services/cloud/cloud-lock.service.ts
import { Injectable, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { EntryOrigin } from '../../models/time-entry.model';
import { DeviceIdentityService } from '../device-identity.service';
import { CloudAuthService } from './cloud-auth.service';
import { CloudConfigService } from './cloud-config.service';
import { SupabaseClientService } from './supabase-client.service';

/** How often every instance calls claim_lock (holder: heartbeat; others: try to take it). */
export const LOCK_HEARTBEAT_MS = 60_000;

/** SQLSTATE raised by tt_require_lock(): the write came from an instance without the lock. */
export const LOCK_LOST_CODE = 'TT409';

export type ClaimResult =
  | { kind: 'acquired' }
  /** `instance`: the holder's instance id (see isOpenHere). */
  | { kind: 'held'; holder: EntryOrigin | null; instance: string | null }
  | { kind: 'network' };

/** Web Lock every instance holds while its page is open, so the other tabs can tell it is alive. */
const INSTANCE_LOCK_PREFIX = 'tt.instance.';

/**
 * Client side of the edit lock (supabase/migrations/0004_edit_lock.sql). The
 * lock belongs to an INSTANCE, not to a device: every tab gets its own random
 * id, so two tabs of one browser do not both believe they hold it. The server
 * decides everything (atomically, with its own clock); this class only talks
 * to it. CloudSyncService decides when to call it and what the answer means.
 */
@Injectable({ providedIn: 'root' })
export class CloudLockService {
  private clients = inject(SupabaseClientService);
  private config = inject(CloudConfigService);
  private auth = inject(CloudAuthService);
  private device = inject(DeviceIdentityService);

  /** This tab's id. New on every page load: a reload is a new instance. */
  readonly instanceId = uuidv4();

  constructor() {
    // Held until the page goes away (the browser drops it then, even on a crash).
    try {
      void navigator.locks?.request(INSTANCE_LOCK_PREFIX + this.instanceId, () => new Promise<void>(() => {}));
    } catch {
      // No Web Locks: isOpenHere() always answers false.
    }
  }

  /**
   * Whether `instance` is a tab of this same browser that is still open. Such a
   * tab shares this localStorage, outbox included: its queued changes are not
   * this instance's to throw away.
   */
  async isOpenHere(instance: string | null): Promise<boolean> {
    if (!instance || instance === this.instanceId || !navigator.locks) return false;
    try {
      const { held } = await navigator.locks.query();
      return !!held?.some(l => l.name === INSTANCE_LOCK_PREFIX + instance);
    } catch {
      return false;
    }
  }

  /** Take or refresh the lock. `force` takes it even from a live holder. */
  async claim(force = false): Promise<ClaimResult> {
    try {
      const client = await this.clients.get();
      if (!client) return { kind: 'network' };
      const { data, error } = await client.rpc('claim_lock', {
        p_instance: this.instanceId,
        p_device: this.device.current(),
        p_force: force,
      });
      if (error || !data) return { kind: 'network' };
      const answer = data as { acquired: boolean; holder?: string | null; device: EntryOrigin | null };
      return answer.acquired
        ? { kind: 'acquired' }
        : { kind: 'held', holder: answer.device ?? null, instance: answer.holder ?? null };
    } catch {
      return { kind: 'network' };
    }
  }

  /** Let go of the lock (sign-out). Best effort: if it fails the lock goes stale in 2 minutes. */
  async release(): Promise<void> {
    try {
      const client = await this.clients.get();
      await client?.rpc('release_lock', { p_instance: this.instanceId });
    } catch {
      // Offline: the lock expires on its own.
    }
  }

  /**
   * Release while the page is closing. supabase-js requests are cancelled
   * when the page goes away; a `keepalive` fetch is allowed to finish.
   */
  releaseOnClose(): void {
    const config = this.config.config();
    const token = this.auth.accessToken();
    if (!config || !token) return;
    void fetch(`${config.url}/rest/v1/rpc/release_lock`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_instance: this.instanceId }),
    }).catch(() => {
      // The lock expires on its own.
    });
  }
}
