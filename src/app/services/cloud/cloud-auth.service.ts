// src/app/services/cloud/cloud-auth.service.ts
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { CloudConfigService } from './cloud-config.service';
import { CLOUD_SESSION_KEY, SupabaseClientService } from './supabase-client.service';
import { CLOUD_SCHEMA_VERSION } from './cloud-schema';

export type CloudAuthStatus = 'unconfigured' | 'signedOut' | 'signedIn';

export type CloudAuthError =
  | 'invalidCredentials' // wrong email/password
  | 'network'            // offline, wrong URL, or the project is paused
  | 'weakPassword'       // rejected by the password policy
  | 'unknown';

export type SchemaCheck =
  | { kind: 'ok' }
  | { kind: 'missing' }                    // migrations never run
  | { kind: 'outdated'; version: number }  // older than this build expects
  | { kind: 'newer'; version: number }     // database is ahead of this build
  | { kind: 'network' };

/**
 * Email + password sign-in against the configured Supabase project. There is
 * deliberately no sign-up: accounts are created by the project admin.
 */
@Injectable({ providedIn: 'root' })
export class CloudAuthService {
  private configService = inject(CloudConfigService);
  private clients = inject(SupabaseClientService);

  private _session = signal<Session | null>(null);
  private unsubscribeAuth: (() => void) | null = null;

  readonly userId = computed(() => this._session()?.user.id ?? null);
  readonly email = computed(() => this._session()?.user.email ?? null);
  readonly status = computed<CloudAuthStatus>(() => {
    if (!this.configService.config()) return 'unconfigured';
    return this._session() ? 'signedIn' : 'signedOut';
  });

  /** Restore a persisted session (call once at startup or after a config change). */
  async init(): Promise<void> {
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    const client = await this.clients.get();
    if (!client) {
      this._session.set(null);
      return;
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
    this.unsubscribeAuth = () => data.subscription.unsubscribe();
    try {
      const { data: current } = await client.auth.getSession();
      this._session.set(current.session);
    } catch {
      this._session.set(null);
    }
  }

  async signIn(email: string, password: string): Promise<CloudAuthError | null> {
    const client = await this.clients.get();
    if (!client) return 'unknown';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return mapAuthError(error);
      this._session.set(data.session);
      return null;
    } catch {
      return 'network';
    }
  }

  async signOut(): Promise<void> {
    const client = await this.clients.get();
    try {
      // 'local' only ends this device's session; other devices stay signed in.
      await client?.auth.signOut({ scope: 'local' });
    } catch {
      // Offline: drop the stored session anyway.
      localStorage.removeItem(CLOUD_SESSION_KEY);
    }
    this._session.set(null);
  }

  async changePassword(newPassword: string): Promise<CloudAuthError | null> {
    const client = await this.clients.get();
    if (!client) return 'unknown';
    try {
      const { error } = await client.auth.updateUser({ password: newPassword });
      return error ? mapAuthError(error) : null;
    } catch {
      return 'network';
    }
  }

  /** Compare the database schema version with what this build expects. */
  async checkSchema(): Promise<SchemaCheck> {
    const client = await this.clients.get();
    if (!client) return { kind: 'network' };
    try {
      const { data, error } = await client.rpc('schema_version');
      if (error) {
        // PGRST202: function not found → the install SQL was never run.
        return error.code === 'PGRST202' || error.code === '42883'
          ? { kind: 'missing' }
          : { kind: 'network' };
      }
      const version = Number(data);
      if (version < CLOUD_SCHEMA_VERSION) return { kind: 'outdated', version };
      if (version > CLOUD_SCHEMA_VERSION) return { kind: 'newer', version };
      return { kind: 'ok' };
    } catch {
      return { kind: 'network' };
    }
  }
}

function mapAuthError(error: { status?: number; code?: string; name?: string }): CloudAuthError {
  if (error.code === 'weak_password' || error.code === 'same_password') return 'weakPassword';
  if (error.code === 'invalid_credentials' || error.status === 400) return 'invalidCredentials';
  if (!error.status || error.name === 'AuthRetryableFetchError') return 'network';
  return 'unknown';
}
