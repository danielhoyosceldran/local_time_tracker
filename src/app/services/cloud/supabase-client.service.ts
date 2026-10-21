// src/app/services/cloud/supabase-client.service.ts
import { Injectable, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CloudConfig, CloudConfigService } from './cloud-config.service';

/** localStorage key where supabase-js keeps the auth session (device-local). */
export const CLOUD_SESSION_KEY = 'tt.cloud.session';

/**
 * Lazily creates the Supabase client. supabase-js is loaded with a dynamic
 * import so users who never enable the cloud don't pay for it in the bundle.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private configService = inject(CloudConfigService);
  private cached: { config: CloudConfig; client: Promise<SupabaseClient> } | null = null;

  /** The client for the current config, or null when the cloud is not configured. */
  async get(): Promise<SupabaseClient | null> {
    const config = this.configService.config();
    if (!config) return null;
    if (this.cached && sameConfig(this.cached.config, config)) return this.cached.client;
    this.cached = { config, client: this.create(config) };
    return this.cached.client;
  }

  /** Forget the client (after changing or clearing the config). */
  reset(): void {
    this.cached = null;
  }

  private async create(config: CloudConfig): Promise<SupabaseClient> {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(config.url, config.key, {
      auth: {
        storageKey: CLOUD_SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
}

function sameConfig(a: CloudConfig, b: CloudConfig): boolean {
  return a.url === b.url && a.key === b.key;
}
