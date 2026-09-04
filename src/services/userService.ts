// User management and persistence service for Multi-user support via query parameters (?user=yumi etc.)

const DEFAULT_GLOBAL_DOC_ID = 'ken-chiko-global-state';
const USER_LOCAL_KEY_PREFIX = 'kenchiko_save_state_user_';
const ACTIVE_USER_STORAGE_KEY = 'kenchiko_active_user_id';

/**
 * Sanitizes a user string from URL params into a safe Firestore document ID & storage key
 */
export function sanitizeUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Keep alphanumeric, underscores, hyphens, and common safe unicode characters
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '').slice(0, 64);
  return sanitized || null;
}

/**
 * Reads the active user ID from URL query params (e.g. ?user=yumi, ?uid=yumi, ?player=yumi)
 * Falls back to session/local storage if previously opened with a user.
 */
export function getActiveUserId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user') || params.get('uid') || params.get('player') || params.get('u');
    const sanitized = sanitizeUserId(userParam);
    if (sanitized) {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, sanitized);
      return sanitized;
    }
  } catch (_e) {
    // Ignore URL errors
  }

  // Fallback to persisted active user if stored
  try {
    const stored = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    return sanitizeUserId(stored);
  } catch {
    return null;
  }
}

/**
 * Sets the active user explicitly and updates the URL parameter without reloading
 */
export function setActiveUserId(userId: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    if (userId) {
      const sanitized = sanitizeUserId(userId);
      if (sanitized) {
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, sanitized);
        url.searchParams.set('user', sanitized);
      }
    } else {
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      url.searchParams.delete('user');
      url.searchParams.delete('uid');
      url.searchParams.delete('player');
      url.searchParams.delete('u');
    }
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  } catch {
    // Ignore history errors
  }
}

/**
 * Returns the Firestore document ID for the current active user
 * Default user: "ken-chiko-global-state"
 * Custom user (e.g. "yumi"): "ken-chiko-user-yumi"
 */
export function getFirestoreDocIdForUser(userId: string | null): string {
  if (!userId) return DEFAULT_GLOBAL_DOC_ID;
  return `ken-chiko-user-${userId}`;
}

/**
 * Returns the LocalStorage backup key for the current active user
 */
export function getLocalStorageKeyForUser(userId: string | null): string {
  if (!userId) return 'kenchiko_save_state_backup_v2';
  return `${USER_LOCAL_KEY_PREFIX}${userId}`;
}
