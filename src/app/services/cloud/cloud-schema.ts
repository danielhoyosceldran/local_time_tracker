// src/app/services/cloud/cloud-schema.ts
import migration0001 from '../../../../supabase/migrations/0001_init.sql';
import migration0002 from '../../../../supabase/migrations/0002_keep_closed_entries.sql';
import migration0003 from '../../../../supabase/migrations/0003_row_checks.sql';

/**
 * Schema version this build expects (`public.schema_version()`). Bump it with
 * every new file in supabase/migrations and register the file below.
 */
export const CLOUD_SCHEMA_VERSION = 3;

export const CLOUD_MIGRATIONS: ReadonlyArray<{ version: number; sql: string }> = [
  { version: 1, sql: migration0001 },
  { version: 2, sql: migration0002 },
  { version: 3, sql: migration0003 },
];

/** SQL needed to bring a database at `fromVersion` up to date (0 = fresh install). */
export function migrationSqlSince(fromVersion: number): string {
  return CLOUD_MIGRATIONS
    .filter(m => m.version > fromVersion)
    .map(m => m.sql)
    .join('\n\n');
}
