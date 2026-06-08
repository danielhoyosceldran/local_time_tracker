// src/app/services/gist-sync.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

/**
 * Optional cloud sync via a private GitHub Gist. This sits ON TOP of the
 * existing localStorage logic: localStorage is ALWAYS the source of truth.
 *
 * The payload we push/pull reuses the EXACT shape produced by
 * TimeEntryService.exportAll() (`{ version, exportedAt, data }`), plus an
 * `updatedAt` metadata field. We never invent a new data structure.
 */

/** User-pasted sync configuration. Stored device-locally under `gistConfig`. */
export interface GistConfig {
  /** GitHub Personal Access Token (classic) with the minimum `gist` scope. */
  token: string;
  /** The id of the (private) gist that holds the backup. */
  gistId: string;
  /** Name of the file inside the gist. Defaults to `data.json`. */
  fileName: string;
}

/**
 * The object stored inside the gist file. Reuses the export shape verbatim and
 * adds `updatedAt` as a sync metadata field.
 */
export interface GistPayload {
  version: number;
  exportedAt: string;
  /** ISO timestamp of the last push, added by this service. */
  updatedAt: string;
  /** localStorage key -> raw stored value (or null). Same as exportAll(). */
  data: Record<string, string | null>;
}

/** Discriminated set of failure modes, mapped to user-friendly messages by the UI. */
export type GistSyncErrorKind =
  | 'no-config'     // token/gistId missing
  | 'unauthorized'  // 401 - invalid/expired token or missing `gist` scope
  | 'not-found'     // 404 - gist id does not exist or token can't see it
  | 'validation'    // 422 - GitHub rejected the request body
  | 'parse'         // gist content was not valid JSON in the expected shape
  | 'network';      // offline / unexpected HTTP status

export interface GistSyncError {
  kind: GistSyncErrorKind;
  /** HTTP status when applicable. Never contains the token. */
  status?: number;
}

const CONFIG_KEY = 'gistConfig';
const DEFAULT_FILE_NAME = 'data.json';
const GIST_API_BASE = 'https://api.github.com/gists';

@Injectable({ providedIn: 'root' })
export class GistSyncService {
  private http = inject(HttpClient);

  // Exposed as a signal so the settings UI reflects the saved config reactively.
  private _config = signal<GistConfig | null>(this.load());
  readonly config = this._config.asReadonly();

  // --- Config persistence ---

  /** Read the saved config from localStorage (null if absent/corrupt). */
  private load(): GistConfig | null {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<GistConfig>;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        token: typeof parsed.token === 'string' ? parsed.token : '',
        gistId: typeof parsed.gistId === 'string' ? parsed.gistId : '',
        fileName: parsed.fileName?.trim() || DEFAULT_FILE_NAME,
      };
    } catch {
      return null;
    }
  }

  getConfig(): GistConfig | null {
    return this._config();
  }

  /**
   * Persist the config. The gist URL is accepted in place of a bare id and the
   * id is extracted from it. NOTE: this key is intentionally NOT registered in
   * KNOWN_STORAGE_KEYS — it holds the secret token and must never travel inside
   * the gist payload or the downloadable backup.
   */
  saveConfig(config: GistConfig): void {
    const normalized: GistConfig = {
      token: config.token.trim(),
      gistId: extractGistId(config.gistId),
      fileName: config.fileName?.trim() || DEFAULT_FILE_NAME,
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    this._config.set(normalized);
  }

  /** Whether enough config exists to attempt a sync. */
  hasConfig(): boolean {
    const c = this._config();
    return !!c && !!c.token && !!c.gistId;
  }

  // --- Remote operations ---

  /**
   * PATCH the gist with the full export payload. `exportJson` is the string
   * returned by TimeEntryService.exportAll(); we parse it, stamp `updatedAt`,
   * and write it back as the gist file content.
   */
  push(exportJson: string): Observable<void> {
    const config = this._config();
    if (!config || !config.token || !config.gistId) {
      return throwError(() => ({ kind: 'no-config' } as GistSyncError));
    }

    let payload: GistPayload;
    try {
      const base = JSON.parse(exportJson) as Omit<GistPayload, 'updatedAt'>;
      payload = { ...base, updatedAt: new Date().toISOString() };
    } catch {
      return throwError(() => ({ kind: 'parse' } as GistSyncError));
    }

    const body = {
      files: {
        [config.fileName]: { content: JSON.stringify(payload, null, 2) },
      },
    };

    return this.http
      .patch(`${GIST_API_BASE}/${config.gistId}`, body, { headers: this.headers(config.token) })
      .pipe(
        map(() => void 0),
        catchError((err: HttpErrorResponse) => throwError(() => toSyncError(err))),
      );
  }

  /**
   * GET the gist and return the parsed payload from the configured file.
   * Returns null if the file exists but is empty.
   */
  pull(): Observable<GistPayload | null> {
    const config = this._config();
    if (!config || !config.token || !config.gistId) {
      return throwError(() => ({ kind: 'no-config' } as GistSyncError));
    }

    return this.http
      .get<GistApiResponse>(`${GIST_API_BASE}/${config.gistId}`, { headers: this.headers(config.token) })
      .pipe(
        map(res => {
          const file = res.files?.[config.fileName];
          const content = file?.content?.trim();
          if (!content) return null;
          try {
            return JSON.parse(content) as GistPayload;
          } catch {
            throw { kind: 'parse' } as GistSyncError;
          }
        }),
        catchError((err: unknown) => throwError(() => normalizeError(err))),
      );
  }

  // --- Helpers ---

  /** Build the GitHub API headers. The token is only ever placed here. */
  private headers(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  }
}

/** Minimal shape of the GitHub gist GET response we rely on. */
interface GistApiResponse {
  id: string;
  files: Record<string, { filename: string; content?: string; truncated?: boolean } | undefined>;
}

/** Accept a full gist URL or a bare id and return just the id. */
function extractGistId(input: string): string {
  const value = input.trim();
  if (!value) return '';
  // e.g. https://gist.github.com/user/<id> or .../<id>#file -> take last id-like segment
  const match = value.match(/[0-9a-f]{20,}/i);
  if (match) return match[0];
  // Fall back to the last path segment for short/legacy ids.
  const segments = value.split(/[/#?]/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : value;
}

/** Map an HttpErrorResponse to a typed sync error. Never leaks the token. */
function toSyncError(err: HttpErrorResponse): GistSyncError {
  switch (err.status) {
    case 401:
      return { kind: 'unauthorized', status: 401 };
    case 404:
      return { kind: 'not-found', status: 404 };
    case 422:
      return { kind: 'validation', status: 422 };
    default:
      return { kind: 'network', status: err.status };
  }
}

/** Normalize either an already-typed GistSyncError or an HttpErrorResponse. */
function normalizeError(err: unknown): GistSyncError {
  if (err instanceof HttpErrorResponse) return toSyncError(err);
  if (err && typeof err === 'object' && 'kind' in err) return err as GistSyncError;
  return { kind: 'network' };
}
