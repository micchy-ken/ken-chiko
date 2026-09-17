export interface AppVersionInfo {
  version: string;
  buildTime: string;
  releaseNotes?: string;
}

export const CURRENT_APP_VERSION = '2026.09.16-v6';
export const CURRENT_BUILD_TIME = '2026-09-16 23:25';

/**
 * Checks static /version.json hosted on the web server (Cost: 0 Firestore reads/writes)
 * Adds a timestamp query param to bust aggressive browser / PWA caching.
 */
export async function checkAppVersion(): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  latestBuildTime?: string;
}> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
    }

    const data: AppVersionInfo = await res.json();
    if (data && data.version && data.version !== CURRENT_APP_VERSION) {
      return {
        hasUpdate: true,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: data.version,
        latestBuildTime: data.buildTime,
      };
    }

    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: data?.version,
    };
  } catch (err) {
    console.warn('Version check note:', err);
    return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
  }
}

/**
 * Perform a clean reload bypassing cache
 */
export function performAppReload(): void {
  try {
    // If ServiceWorker exists in browser, unregister to ensure fresh assets
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  } catch {}

  // Force page reload
  window.location.reload();
}
