import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
import { GameSaveData } from '../types';
import { DEFAULT_INITIAL_STATE } from './storage';

export interface FirebaseCustomConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
  syncDocId?: string; // default: "ken-chiko-global-state"
}

// Built-in Firebase configuration for the project
export const DEFAULT_FIREBASE_CONFIG: FirebaseCustomConfig = {
  projectId: 'gen-lang-client-0027333270',
  appId: '1:589716285990:web:0b1c0cce13f5f0187154e7',
  apiKey: 'AIzaSyCDqLWbRYRSsrhzYKdUXvd5DQ6m360yKBk',
  authDomain: 'gen-lang-client-0027333270.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-fae23163-8cc8-4b97-bd81-37d5070e358a',
  storageBucket: 'gen-lang-client-0027333270.firebasestorage.app',
  messagingSenderId: '589716285990',
  syncDocId: 'ken-chiko-global-state',
};

export function getEnvFirebaseConfig(): FirebaseCustomConfig {
  const env = (import.meta as any).env || {};
  const projectId = env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    projectId: projectId,
    appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    syncDocId: 'ken-chiko-global-state',
  };
}

export function loadSavedFirebaseConfig(): FirebaseCustomConfig {
  return getEnvFirebaseConfig();
}

export function saveFirebaseConfig(_config: FirebaseCustomConfig): void {
  // Config is managed in environment / default config
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let unsubscribeSnapshot: Unsubscribe | null = null;

// Quota & Rate Limit Protection State
let quotaExhaustedUntil: number = 0;
let lastSuccessfulWriteTime: number = 0;
let isQuotaCurrentlyExhausted: boolean = false;
let onQuotaStatusChangeCallback: ((exhausted: boolean) => void) | null = null;

// Connection Status Tracking
export interface FirebaseConnectionStatus {
  isConnected: boolean;
  isOffline: boolean;
  lastError?: string;
  isQuotaExhausted?: boolean;
}

let isCurrentlyConnected: boolean = false;
let lastConnectionError: string | undefined = undefined;
const connectionStatusListeners = new Set<(status: FirebaseConnectionStatus) => void>();

export function getFirebaseConnectionStatus(): FirebaseConnectionStatus {
  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  return {
    isConnected: !isOffline && isCurrentlyConnected,
    isOffline: isOffline || !isCurrentlyConnected,
    lastError: lastConnectionError,
    isQuotaExhausted: isQuotaCurrentlyExhausted && Date.now() < quotaExhaustedUntil,
  };
}

export function subscribeFirebaseConnectionStatus(
  listener: (status: FirebaseConnectionStatus) => void
): () => void {
  connectionStatusListeners.add(listener);
  listener(getFirebaseConnectionStatus());
  return () => {
    connectionStatusListeners.delete(listener);
  };
}

function notifyConnectionStatusChange(connected: boolean, error?: string) {
  isCurrentlyConnected = connected;
  if (error !== undefined) {
    lastConnectionError = error;
  }
  const currentStatus = getFirebaseConnectionStatus();
  connectionStatusListeners.forEach((listener) => {
    try {
      listener(currentStatus);
    } catch {
      // ignore
    }
  });
}

// Window online/offline listener setup
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    testFirebaseConnection().catch(() => {});
  });
  window.addEventListener('offline', () => {
    notifyConnectionStatusChange(false, 'ネットワークが切断されています（オフライン）');
  });
}

export function setQuotaStatusCallback(cb: (exhausted: boolean) => void) {
  onQuotaStatusChangeCallback = cb;
}

export function getIsQuotaExhausted(): boolean {
  return isQuotaCurrentlyExhausted && Date.now() < quotaExhaustedUntil;
}

export async function testFirebaseConnection(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyConnectionStatusChange(false, 'オフライン状態です');
    return { success: false, error: '端末がオフラインです' };
  }

  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        return initRes;
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestoreの初期化に失敗しました');
      return { success: false, error: 'Firestore is not initialized' };
    }

    const docId = config.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);
    await getDoc(docRef);
    notifyConnectionStatusChange(true);
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

// Purge all legacy local storage data
export function purgeLocalData(): void {
  try {
    localStorage.removeItem('kenchiko_pet_world_v1');
    localStorage.removeItem('kenchiko_firebase_config_v1');
    localStorage.removeItem('kenchiko_google_doc_url');
  } catch (err) {
    // ignore
  }
}

export function initFirebase(config: FirebaseCustomConfig = loadSavedFirebaseConfig()): {
  success: boolean;
  error?: string;
} {
  try {
    const activeConfig = {
      ...loadSavedFirebaseConfig(),
      ...config,
    };

    if (!activeConfig.apiKey || !activeConfig.projectId) {
      return { success: false, error: 'Firebaseの設定情報が見つかりません' };
    }

    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
    } else {
      firebaseApp = initializeApp({
        apiKey: activeConfig.apiKey,
        authDomain: activeConfig.authDomain || `${activeConfig.projectId}.firebaseapp.com`,
        projectId: activeConfig.projectId,
        storageBucket: activeConfig.storageBucket,
        messagingSenderId: activeConfig.messagingSenderId,
        appId: activeConfig.appId,
      });
    }

    // Connect to database (with custom databaseId if defined)
    if (activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)') {
      try {
        firestoreDb = getFirestore(firebaseApp, activeConfig.firestoreDatabaseId);
      } catch {
        firestoreDb = getFirestore(firebaseApp);
      }
    } else {
      firestoreDb = getFirestore(firebaseApp);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Firebase init error', err);
    return { success: false, error: err.message || 'Firebase初期化に失敗しました' };
  }
}

// Fetch master state directly from Firestore (First load)
export async function fetchInitialFirebaseState(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; data: GameSaveData; isNew?: boolean; error?: string }> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyConnectionStatusChange(false, 'オフライン状態です');
      return { success: false, data: DEFAULT_INITIAL_STATE, error: 'オフライン状態です' };
    }

    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        return { success: false, data: DEFAULT_INITIAL_STATE, error: initRes.error };
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestore is not ready');
      return { success: false, data: DEFAULT_INITIAL_STATE, error: 'Firestore is not ready' };
    }

    const docId = config.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);
    
    try {
      const snap = await getDoc(docRef);
      notifyConnectionStatusChange(true);
      if (snap.exists()) {
        const remoteData = snap.data() as GameSaveData;
        if (remoteData && remoteData.kenchiko) {
          return { success: true, data: remoteData, isNew: false };
        }
      }
    } catch (readErr: any) {
      console.warn('Firestore initial read notice:', readErr);
      if (readErr?.code === 'resource-exhausted' || String(readErr?.message).includes('Quota')) {
        isQuotaCurrentlyExhausted = true;
        quotaExhaustedUntil = Date.now() + 60 * 1000;
        if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(true);
        notifyConnectionStatusChange(false, 'Firestore無料クォータ上限到達');
      } else {
        notifyConnectionStatusChange(false, readErr?.message || String(readErr));
      }
    }

    return { success: true, data: DEFAULT_INITIAL_STATE, isNew: false };
  } catch (err: any) {
    console.error('Error fetching initial Firestore state', err);
    notifyConnectionStatusChange(false, err?.message || String(err));
    return { success: false, data: DEFAULT_INITIAL_STATE, error: err.message };
  }
}

export async function syncSaveDataToFirebase(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  // If quota is currently exceeded, skip network write and operate in memory
  if (isQuotaCurrentlyExhausted && Date.now() < quotaExhaustedUntil) {
    return { success: false, error: 'Firestore無料書き込み上限のため待機中（メモリ動作）' };
  }

  // Throttle writes: minimum 3 seconds between writes from a single client
  const now = Date.now();
  if (now - lastSuccessfulWriteTime < 3000) {
    return { success: true };
  }

  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        return initRes;
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestore is not initialized');
      return { success: false, error: 'Firestore is not initialized' };
    }

    const docId = config.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);

    const sanitizedData = JSON.parse(
      JSON.stringify(data, (_, value) => (value === undefined ? null : value))
    );

    await setDoc(docRef, {
      ...sanitizedData,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });

    lastSuccessfulWriteTime = Date.now();
    notifyConnectionStatusChange(true);
    if (isQuotaCurrentlyExhausted) {
      isQuotaCurrentlyExhausted = false;
      if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(false);
    }

    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (err?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('resource-exhausted')) {
      isQuotaCurrentlyExhausted = true;
      quotaExhaustedUntil = Date.now() + 120 * 1000; // Pause for 2 minutes to respect backend
      if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(true);
      notifyConnectionStatusChange(false, 'Firebaseの書き込み上限に達しました（メモリ動作中）');
      console.warn('[Firestore] Daily quota limit reached. Gracefully operating in memory.');
      return { success: false, error: 'Firebaseの書き込み上限に達しました。ローカルメモリ上で継続します。' };
    }
    console.warn('Sync to Firestore note:', err);
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

export function subscribeToFirebaseState(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  onRemoteUpdate: (data: GameSaveData) => void,
  onError?: (err: Error) => void
): () => void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (!firestoreDb) {
    const initRes = initFirebase(config);
    if (!initRes.success) {
      notifyConnectionStatusChange(false, initRes.error);
      if (onError) onError(new Error(initRes.error));
      return () => {};
    }
  }

  if (!firestoreDb) return () => {};

  const docId = config.syncDocId || 'ken-chiko-global-state';
  const docRef = doc(firestoreDb, 'kenchiko_world', docId);

  try {
    unsubscribeSnapshot = onSnapshot(
      docRef,
      (snapshot) => {
        notifyConnectionStatusChange(true);
        if (snapshot.exists()) {
          const remoteData = snapshot.data() as GameSaveData;
          if (remoteData && remoteData.kenchiko) {
            onRemoteUpdate(remoteData);
          }
        }
      },
      (err) => {
        if (err?.code === 'resource-exhausted' || String(err?.message).includes('Quota')) {
          isQuotaCurrentlyExhausted = true;
          quotaExhaustedUntil = Date.now() + 120 * 1000;
          if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(true);
          notifyConnectionStatusChange(false, 'Firebaseクォータ上限');
        } else {
          console.warn('Firebase snapshot listener note:', err);
          notifyConnectionStatusChange(false, err?.message || String(err));
        }
        if (onError) onError(err);
      }
    );
  } catch (listenErr: any) {
    console.warn('Firebase subscription init note:', listenErr);
    notifyConnectionStatusChange(false, listenErr?.message || String(listenErr));
  }

  return () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}
