import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
import { GameSaveData, NyanCharacter } from '../types';
import { DEFAULT_INITIAL_STATE } from './storage';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { getActiveUserId, getFirestoreDocIdForUser, getLocalStorageKeyForUser } from './userService';

export interface FirebaseCustomConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
  syncDocId?: string; // default: "ken-chiko-global-state" or "ken-chiko-user-{userId}"
}

/**
 * Robustly merges remote/saved character list with the baseline 231 characters (INITIAL_NYANS).
 * Ensures:
 * 1. All 231 characters are always present in the game (no characters ever disappear).
 * 2. User customizations (customImageUrl, rawImageUrl, transparency settings, discovery status, friendship, playCount)
 *    from remote or local backup are seamlessly retained and prioritized over defaults.
 * 3. Any newly added custom characters with ID > 231 are also retained.
 */
export function mergeCharactersWithDefaults(
  customCharacters?: NyanCharacter[],
  secondaryCharacters?: NyanCharacter[]
): NyanCharacter[] {
  const charMap = new Map<number, NyanCharacter>();

  // 1. Seed with baseline 231 nyans
  for (const nyan of INITIAL_NYANS) {
    charMap.set(nyan.no, { ...nyan });
  }

  // 2. Overlay secondary characters if available
  if (secondaryCharacters && secondaryCharacters.length > 0) {
    for (const sec of secondaryCharacters) {
      const base = charMap.get(sec.no) || sec;
      charMap.set(sec.no, {
        ...base,
        ...sec,
        discovered: sec.discovered || base.discovered,
        discoveryDate: sec.discoveryDate || base.discoveryDate,
        friendshipLevel: Math.max(sec.friendshipLevel || 0, base.friendshipLevel || 0),
        playCount: Math.max(sec.playCount || 0, base.playCount || 0),
        customImageUrl: sec.customImageUrl || base.customImageUrl,
        rawImageUrl: sec.rawImageUrl || base.rawImageUrl,
        transparency: sec.transparency || base.transparency,
      });
    }
  }

  // 3. Overlay primary custom characters
  if (customCharacters && customCharacters.length > 0) {
    for (const prim of customCharacters) {
      const base = charMap.get(prim.no) || prim;
      charMap.set(prim.no, {
        ...base,
        ...prim,
        discovered: prim.discovered !== undefined ? prim.discovered : base.discovered,
        discoveryDate: prim.discoveryDate || base.discoveryDate,
        friendshipLevel: prim.friendshipLevel !== undefined ? prim.friendshipLevel : base.friendshipLevel,
        playCount: prim.playCount !== undefined ? prim.playCount : base.playCount,
        customImageUrl: prim.customImageUrl !== undefined ? prim.customImageUrl : base.customImageUrl,
        rawImageUrl: prim.rawImageUrl !== undefined ? prim.rawImageUrl : base.rawImageUrl,
        transparency: prim.transparency !== undefined ? prim.transparency : base.transparency,
      });
    }
  }

  return Array.from(charMap.values()).sort((a, b) => a.no - b.no);
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
  const activeUser = getActiveUserId();
  const dynamicDocId = getFirestoreDocIdForUser(activeUser);

  return {
    apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    projectId: projectId,
    appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    syncDocId: dynamicDocId,
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
const QUOTA_STORAGE_KEY = 'kenchiko_firestore_quota_until';

function getPersistedQuotaUntil(): number {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function setPersistedQuotaUntil(until: number): void {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, String(until));
  } catch {}
}

let quotaExhaustedUntil: number = getPersistedQuotaUntil();
let lastSuccessfulWriteTime: number = 0;
let isQuotaCurrentlyExhausted: boolean = Date.now() < quotaExhaustedUntil;
let onQuotaStatusChangeCallback: ((exhausted: boolean) => void) | null = null;

export function markQuotaExhausted(durationMs: number = 24 * 60 * 60 * 1000): void {
  isQuotaCurrentlyExhausted = true;
  quotaExhaustedUntil = Date.now() + durationMs;
  setPersistedQuotaUntil(quotaExhaustedUntil);
  if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(true);
  notifyConnectionStatusChange(false, 'Firebase無料枠上限到達（ローカル保護モードで動作中）');
}

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
  const isQuota = isQuotaCurrentlyExhausted && Date.now() < quotaExhaustedUntil;
  return {
    isConnected: !isOffline && isCurrentlyConnected && !isQuota,
    isOffline: isOffline || !isCurrentlyConnected || isQuota,
    lastError: isQuota ? 'Firestoreの1日無料枠上限に達しました（データはローカルで安全に保護されています）' : lastConnectionError,
    isQuotaExhausted: isQuota,
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

// Local Backup Safety Net Key (Dynamic by user)
export function saveLocalBackup(data: GameSaveData, userId?: string | null): void {
  try {
    const activeUid = userId !== undefined ? userId : getActiveUserId();
    const storageKey = getLocalStorageKeyForUser(activeUid);
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Ignore quota or private browsing errors
  }
}

export function loadLocalBackup(userId?: string | null): GameSaveData | null {
  try {
    const activeUid = userId !== undefined ? userId : getActiveUserId();
    const storageKey = getLocalStorageKeyForUser(activeUid);
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.kenchiko) {
        return parsed as GameSaveData;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Reset data for specific user or global
export function resetUserData(userId?: string | null): void {
  try {
    const activeUid = userId !== undefined ? userId : getActiveUserId();
    const storageKey = getLocalStorageKeyForUser(activeUid);
    localStorage.removeItem(storageKey);
  } catch (_e) {}
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
  const localBackup = loadLocalBackup();

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyConnectionStatusChange(false, 'オフライン状態です');
      return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: 'オフライン状態です' };
    }

    if (getIsQuotaExhausted()) {
      notifyConnectionStatusChange(false, 'Firebase無料枠上限のためローカルデータで動作中');
      return { success: true, data: localBackup || DEFAULT_INITIAL_STATE };
    }

    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: initRes.error };
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestore is not ready');
      return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: 'Firestore is not ready' };
    }

    const docId = config.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);
    
    try {
      const snap = await getDoc(docRef);
      notifyConnectionStatusChange(true);
      if (snap.exists()) {
        const remoteData = snap.data() as GameSaveData;
        if (remoteData && remoteData.kenchiko) {
          // If local backup has a newer timestamp than remote Firestore (e.g. edited while offline or during quota limits),
          // preserve the newer local data and queue a sync to Firestore!
          const localIsNewer = Boolean(
            localBackup &&
            localBackup.lastSaved &&
            remoteData.lastSaved &&
            localBackup.lastSaved > remoteData.lastSaved
          );

          const primarySource = localIsNewer ? localBackup! : remoteData;
          const secondarySource = localIsNewer ? remoteData : (localBackup || DEFAULT_INITIAL_STATE);

          const mergedAsobiList =
            primarySource.asobiList && primarySource.asobiList.length > 0
              ? primarySource.asobiList
              : secondarySource.asobiList || DEFAULT_INITIAL_STATE.asobiList;

          const mergedCharacters = mergeCharactersWithDefaults(
            primarySource.characters,
            secondarySource.characters
          );

          const mergedData: GameSaveData = {
            ...DEFAULT_INITIAL_STATE,
            ...secondarySource,
            ...primarySource,
            asobiList: mergedAsobiList,
            characters: mergedCharacters,
            inventory:
              primarySource.inventory && primarySource.inventory.length > 0
                ? primarySource.inventory
                : secondarySource.inventory || DEFAULT_INITIAL_STATE.inventory,
            diary:
              primarySource.diary && primarySource.diary.length > 0
                ? primarySource.diary
                : secondarySource.diary || DEFAULT_INITIAL_STATE.diary,
            lastSaved: Math.max(primarySource.lastSaved || 0, secondarySource.lastSaved || 0, Date.now()),
          };

          saveLocalBackup(mergedData);

          // If local was newer, asynchronously sync the updated state back to Firebase
          if (localIsNewer && !getIsQuotaExhausted()) {
            executeFirestoreWrite(mergedData, config).catch(() => {});
          }

          return { success: true, data: mergedData, isNew: false };
        }
      }
    } catch (readErr: any) {
      const errMsg = String(readErr?.message || readErr);
      if (readErr?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('resource-exhausted')) {
        markQuotaExhausted();
      } else {
        console.warn('Firestore initial read note:', readErr);
        notifyConnectionStatusChange(false, errMsg);
      }
    }

    const fallbackState = localBackup || DEFAULT_INITIAL_STATE;
    saveLocalBackup(fallbackState);
    return { success: true, data: fallbackState, isNew: false };
  } catch (err: any) {
    notifyConnectionStatusChange(false, err?.message || String(err));
    return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: err.message };
  }
}

let pendingWriteTimeout: any = null;
let latestPendingData: GameSaveData | null = null;
let isWritingToFirestore = false;

async function executeFirestoreWrite(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  // Always protect data in local storage
  saveLocalBackup(data);

  if (getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保持中' };
  }

  const now = Date.now();
  // Enforce a hard throttle: never write to Firestore if less than 3500ms since last write
  if (now - lastSuccessfulWriteTime < 3500) {
    if (!pendingWriteTimeout) {
      latestPendingData = data;
      pendingWriteTimeout = setTimeout(() => {
        pendingWriteTimeout = null;
        if (latestPendingData) {
          executeFirestoreWrite(latestPendingData, config).catch(() => {});
        }
      }, 3500 - (now - lastSuccessfulWriteTime));
    }
    return { success: true };
  }

  isWritingToFirestore = true;
  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        isWritingToFirestore = false;
        return initRes;
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestore is not initialized');
      isWritingToFirestore = false;
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
      setPersistedQuotaUntil(0);
      if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(false);
    }
    isWritingToFirestore = false;
    return { success: true };
  } catch (err: any) {
    isWritingToFirestore = false;
    const errMsg = err?.message || String(err);
    if (err?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('resource-exhausted') || errMsg.includes('Free daily write units')) {
      markQuotaExhausted();
      return { success: true, error: 'Firebaseの書き込み上限に達しました。ローカル保存で継続しています。' };
    }
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

// Protect state in local storage on page unload (NEVER send network write to Firestore on background/visibilitychange)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (latestPendingData) {
      saveLocalBackup(latestPendingData);
    }
  });
}

export async function syncSaveDataToFirebase(
  data: GameSaveData,
  isImmediate = false,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  // Always update local backup synchronously so local state is instantly protected
  saveLocalBackup(data);
  latestPendingData = data;

  if (getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保持中' };
  }

  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  // Minimum 10 seconds throttle between Firestore writes
  if (isImmediate && timeSinceLast >= 10000 && !isWritingToFirestore) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    return executeFirestoreWrite(data, config);
  }

  // If already scheduled, wait for trailing debounce
  if (pendingWriteTimeout) {
    return { success: true };
  }

  // Schedule trailing debounced write with a minimum 15-second window
  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config).catch(() => {});
    }
  }, Math.max(2000, 15000 - timeSinceLast));

  return { success: true };
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

  if (getIsQuotaExhausted()) {
    notifyConnectionStatusChange(false, 'Firebase無料枠上限のためローカル保護モード中');
    return () => {};
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
            // If local write is currently pending or within 2 seconds of local write, don't overwrite
            if (pendingWriteTimeout || Date.now() - lastSuccessfulWriteTime < 2000) {
              return;
            }
            const local = loadLocalBackup();
            const mergedAsobiList =
              remoteData.asobiList && remoteData.asobiList.length > 0
                ? remoteData.asobiList
                : local?.asobiList || DEFAULT_INITIAL_STATE.asobiList;

            const mergedCharacters = mergeCharactersWithDefaults(
              remoteData.characters,
              local?.characters
            );

            const safeData: GameSaveData = {
              ...DEFAULT_INITIAL_STATE,
              ...remoteData,
              asobiList: mergedAsobiList,
              characters: mergedCharacters,
            };
            saveLocalBackup(safeData);
            onRemoteUpdate(safeData);
          }
        }
      },
      (err) => {
        const errMsg = String(err?.message || err);
        if (err?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('resource-exhausted')) {
          markQuotaExhausted();
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }
        } else {
          console.warn('Firebase snapshot listener note:', err);
          notifyConnectionStatusChange(false, errMsg);
        }
        if (onError) onError(err);
      }
    );
  } catch (listenErr: any) {
    const errMsg = String(listenErr?.message || listenErr);
    if (listenErr?.code === 'resource-exhausted' || errMsg.includes('Quota')) {
      markQuotaExhausted();
    } else {
      console.warn('Firebase subscription init note:', listenErr);
      notifyConnectionStatusChange(false, errMsg);
    }
  }

  return () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}
