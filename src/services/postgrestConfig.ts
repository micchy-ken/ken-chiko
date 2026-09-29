/**
 * PostgREST / PostgreSQL connection configuration for Kenchiko World.
 */

export const DEFAULT_POSTGREST_BASE_URL = 'https://micchy.synology.me:9943';
export const POSTGREST_STORAGE_KEY = 'kenchiko_postgrest_url_v1';
export const POSTGREST_ENABLED_KEY = 'kenchiko_postgrest_enabled_v1';

export function getPostgrestBaseUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(POSTGREST_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  }
  return DEFAULT_POSTGREST_BASE_URL;
}

export function setPostgrestBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(POSTGREST_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  }
}

export function isPostgrestEnabled(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(POSTGREST_ENABLED_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  }
  // Default to enabled since master is ready on Synology
  return true;
}

export function setPostgrestEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(POSTGREST_ENABLED_KEY, String(enabled));
  }
}
