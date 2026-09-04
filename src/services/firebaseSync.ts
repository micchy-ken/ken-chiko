import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { GameSaveData, NyanCharacter, NyanTransparencyOptions, GiftItem, DiaryEntry, KenchikoAsobi, KenchikoState } from '../types';
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
 * Lightweight per-character user progress and customization payload.
 * Eliminates static metadata (descriptions, prompts, lore, dialogues) from Firestore writes.
 */
export interface NyanProgressEntry {
  discovered?: boolean;
  discoveryDate?: string;
  friendshipLevel?: number;
  playCount?: number;
  customImageUrl?: string;
  rawImageUrl?: string;
  transparency?: NyanTransparencyOptions;
}

/**
 * Highly optimized, lightweight Firestore document schema (2-5KB vs 300KB).
 */
export interface UserProgressDoc {
  version: number;
  kenchiko: KenchikoState;
  nyanProgress: Record<number, NyanProgressEntry>;
  inventory: GiftItem[];
  diary: DiaryEntry[];
  asobiList?: KenchikoAsobi[];
  kihonNyanCustomImageUrl?: string;
  googleDriveFolderUrl?: string;
  stats: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  lastSaved: number;
  updatedAt?: string;
}

/**
 * Recursively removes any `undefined` values from an object or array.
 * Firestore `setDoc` throws runtime errors if any property is `undefined`.
 */
export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = removeUndefinedDeep(val);
      }
    }
    return cleaned as any;
  }
  return obj;
}

/**
 * Extracts ONLY user-specific progress, discoveries, and custom image overrides.
 * Strictly guarantees no `undefined` keys exist in the output object.
 */
export function extractUserProgress(data: GameSaveData): UserProgressDoc {
  const nyanProgress: Record<number, NyanProgressEntry> = {};

  if (Array.isArray(data.characters)) {
    for (const char of data.characters) {
      const hasCustomization =
        char.discovered ||
        (char.friendshipLevel !== undefined && char.friendshipLevel > 0) ||
        (char.playCount !== undefined && char.playCount > 0) ||
        Boolean(char.customImageUrl) ||
        Boolean(char.rawImageUrl) ||
        Boolean(char.transparency);

      if (hasCustomization) {
        const entry: NyanProgressEntry = {};
        if (char.discovered !== undefined) entry.discovered = char.discovered;
        if (char.discoveryDate) entry.discoveryDate = char.discoveryDate;
        if (char.friendshipLevel !== undefined) entry.friendshipLevel = char.friendshipLevel;
        if (char.playCount !== undefined) entry.playCount = char.playCount;
        if (char.customImageUrl) entry.customImageUrl = char.customImageUrl;
        if (char.rawImageUrl) entry.rawImageUrl = char.rawImageUrl;
        if (char.transparency) entry.transparency = char.transparency;

        nyanProgress[char.no] = entry;
      }
    }
  }

  // Cap diary to latest 30 entries for optimal payload size
  const cappedDiary = Array.isArray(data.diary) ? data.diary.slice(0, 30) : [];

  const rawDoc: UserProgressDoc = {
    version: data.version || 2,
    kenchiko: data.kenchiko,
    nyanProgress,
    inventory: data.inventory || [],
    diary: cappedDiary,
    asobiList: data.asobiList || [],
    kihonNyanCustomImageUrl: data.kihonNyanCustomImageUrl || '',
    googleDriveFolderUrl: data.googleDriveFolderUrl || '',
    stats: data.stats || {
      totalEncounters: 0,
      totalSnacksEaten: 0,
      totalNapMinutes: 0,
      totalTrips: 0,
    },
    lastSaved: data.lastSaved || Date.now(),
  };

  return removeUndefinedDeep(rawDoc);
}

/**
 * Reconstructs a full GameSaveData object by combining the static master character list (INITIAL_NYANS / Sheets)
 * with the lightweight UserProgressDoc.
 * Backward-compatible: safely reads older documents with monolithic `characters` arrays if present.
 */
export function reconstructGameSaveData(
  remoteDoc: any,
  masterNyans: NyanCharacter[] = INITIAL_NYANS
): GameSaveData {
  if (!remoteDoc) return DEFAULT_INITIAL_STATE;

  const charMap = new Map<number, NyanCharacter>();
  for (const master of masterNyans) {
    charMap.set(master.no, { ...master });
  }

  // 1. Legacy doc support: If remote doc has full `characters` array
  if (Array.isArray(remoteDoc.characters) && remoteDoc.characters.length > 0) {
    for (const remoteChar of remoteDoc.characters) {
      const base = charMap.get(remoteChar.no) || remoteChar;
      charMap.set(remoteChar.no, {
        ...base,
        ...remoteChar,
        name: base.name || remoteChar.name,
        reading: base.reading || remoteChar.reading,
        motif: base.motif || remoteChar.motif,
        dialogue: base.dialogue || remoteChar.dialogue,
        dialogueMeaning: base.dialogueMeaning || remoteChar.dialogueMeaning,
      });
    }
  }

  // 2. Modern compact schema: `nyanProgress` dictionary
  if (remoteDoc.nyanProgress && typeof remoteDoc.nyanProgress === 'object') {
    for (const [key, prog] of Object.entries(remoteDoc.nyanProgress as Record<string, NyanProgressEntry>)) {
      const no = parseInt(key, 10);
      if (isNaN(no)) continue;
      const base = charMap.get(no);
      if (base) {
        charMap.set(no, {
          ...base,
          discovered: prog.discovered !== undefined ? prog.discovered : base.discovered,
          discoveryDate: prog.discoveryDate || base.discoveryDate,
          friendshipLevel: prog.friendshipLevel !== undefined ? prog.friendshipLevel : base.friendshipLevel,
          playCount: prog.playCount !== undefined ? prog.playCount : base.playCount,
          customImageUrl: prog.customImageUrl || base.customImageUrl,
          rawImageUrl: prog.rawImageUrl || base.rawImageUrl,
          transparency: prog.transparency || base.transparency,
        });
      }
    }
  }

  const mergedCharacters = Array.from(charMap.values()).sort((a, b) => a.no - b.no);

  return {
    version: remoteDoc.version || 2,
    kenchiko: remoteDoc.kenchiko || DEFAULT_INITIAL_STATE.kenchiko,
    characters: mergedCharacters,
    inventory: remoteDoc.inventory || DEFAULT_INITIAL_STATE.inventory,
    diary: remoteDoc.diary || DEFAULT_INITIAL_STATE.diary,
    asobiList: remoteDoc.asobiList || DEFAULT_INITIAL_STATE.asobiList,
    kihonNyanCustomImageUrl: remoteDoc.kihonNyanCustomImageUrl,
    googleDriveFolderUrl: remoteDoc.googleDriveFolderUrl,
    stats: remoteDoc.stats || DEFAULT_INITIAL_STATE.stats,
    lastSaved: remoteDoc.lastSaved || Date.now(),
    githubRepo: remoteDoc.githubRepo || 'ken-chiko',
    autoSyncGithub: remoteDoc.autoSyncGithub ?? true,
  };
}

/**
 * Robustly merges character lists with baseline (INITIAL_NYANS).
 */
export function mergeCharactersWithDefaults(
  customCharacters?: NyanCharacter[],
  secondaryCharacters?: NyanCharacter[]
): NyanCharacter[] {
  const charMap = new Map<number, NyanCharacter>();

  // 1. Seed with baseline nyans
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
        name: base.name || sec.name,
        reading: base.reading || sec.reading,
        motif: base.motif || sec.motif,
        firstAppeared: base.firstAppeared || sec.firstAppeared,
        episode: base.episode || sec.episode,
        promptJa: base.promptJa || sec.promptJa,
        promptEn: base.promptEn || sec.promptEn,
        dialogue: base.dialogue || sec.dialogue,
        dialogueMeaning: base.dialogueMeaning || sec.dialogueMeaning,
        discovered: sec.discovered !== undefined ? sec.discovered : base.discovered,
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
        name: base.name || prim.name,
        reading: base.reading || prim.reading,
        motif: base.motif || prim.motif,
        firstAppeared: base.firstAppeared || prim.firstAppeared,
        episode: base.episode || prim.episode,
        promptJa: base.promptJa || prim.promptJa,
        promptEn: base.promptEn || prim.promptEn,
        dialogue: base.dialogue || prim.dialogue,
        dialogueMeaning: base.dialogueMeaning || prim.dialogueMeaning,
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
  // Managed in environment / defaults
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
let isInitialPhase: boolean = true;
let lastConnectionError: string | undefined = undefined;
let autoReconnectTimer: any = null;
let isAutoReconnecting: boolean = false;
const connectionStatusListeners = new Set<(status: FirebaseConnectionStatus) => void>();

export function getFirebaseConnectionStatus(): FirebaseConnectionStatus {
  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const isQuota = isQuotaCurrentlyExhausted && Date.now() < quotaExhaustedUntil;
  // During initial boot phase (first ~2.5s), do not alarm the user with an offline warning
  const effectiveOffline = isInitialPhase ? false : (isOffline || !isCurrentlyConnected || isQuota);

  return {
    isConnected: !isOffline && isCurrentlyConnected && !isQuota,
    isOffline: effectiveOffline,
    lastError: isQuota ? 'Firestoreの1日無料枠上限に達しました（データはローカルで安全に保護されています）' : lastConnectionError,
    isQuotaExhausted: isQuota,
  };
}

export function endInitialConnectionPhase(): void {
  isInitialPhase = false;
  notifyConnectionStatusChange(isCurrentlyConnected, lastConnectionError);
  if (!isCurrentlyConnected) {
    startAutoReconnectLoop();
  }
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
    } catch {}
  });

  if (!connected && !isQuotaCurrentlyExhausted && !isInitialPhase) {
    startAutoReconnectLoop();
  } else if (connected) {
    stopAutoReconnectLoop();
  }
}

/**
 * Automatically retries connecting to Firebase every 5 seconds until restored.
 */
export function startAutoReconnectLoop(): void {
  if (autoReconnectTimer || isCurrentlyConnected || isQuotaCurrentlyExhausted) return;

  autoReconnectTimer = setInterval(async () => {
    if (isAutoReconnecting || isCurrentlyConnected || isQuotaCurrentlyExhausted) {
      if (isCurrentlyConnected || isQuotaCurrentlyExhausted) {
        stopAutoReconnectLoop();
      }
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return; // Skip retry while device is offline
    }

    isAutoReconnecting = true;
    try {
      const res = await testFirebaseConnection();
      if (res.success) {
        stopAutoReconnectLoop();
      }
    } catch {
      // Ignored - will retry in 5s
    } finally {
      isAutoReconnecting = false;
    }
  }, 5000);
}

export function stopAutoReconnectLoop(): void {
  if (autoReconnectTimer) {
    clearInterval(autoReconnectTimer);
    autoReconnectTimer = null;
  }
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

    // Connect to database with Firestore persistent indexedDB cache
    if (!firestoreDb) {
      const dbId =
        activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)'
          ? activeConfig.firestoreDatabaseId
          : undefined;

      try {
        firestoreDb = initializeFirestore(
          firebaseApp,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          },
          dbId
        );
      } catch (_cacheErr) {
        try {
          firestoreDb = getFirestore(firebaseApp, dbId);
        } catch {
          firestoreDb = getFirestore(firebaseApp);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Firebase init error', err);
    return { success: false, error: err.message || 'Firebase初期化に失敗しました' };
  }
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
    sessionDbReadCount++;
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
  } catch {}
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
  } catch {}
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
  } catch (err) {}
}

// Fetch initial state from Firestore (with automatic reconstruction)
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
      sessionDbReadCount++;
      notifyConnectionStatusChange(true);

      if (snap.exists()) {
        const remoteRaw = snap.data();
        if (remoteRaw && remoteRaw.kenchiko) {
          // Reconstruct full game data from compact UserProgressDoc
          const remoteReconstructed = reconstructGameSaveData(remoteRaw, INITIAL_NYANS);

          const localIsNewer = Boolean(
            localBackup &&
            localBackup.lastSaved &&
            remoteReconstructed.lastSaved &&
            localBackup.lastSaved > remoteReconstructed.lastSaved
          );

          const primarySource = localIsNewer ? localBackup! : remoteReconstructed;
          const secondarySource = localIsNewer ? remoteReconstructed : (localBackup || DEFAULT_INITIAL_STATE);

          const mergedCharacters = mergeCharactersWithDefaults(
            primarySource.characters,
            secondarySource.characters
          );

          const mergedData: GameSaveData = {
            ...DEFAULT_INITIAL_STATE,
            ...secondarySource,
            ...primarySource,
            characters: mergedCharacters,
            lastSaved: Math.max(primarySource.lastSaved || 0, secondarySource.lastSaved || 0, Date.now()),
          };

          saveLocalBackup(mergedData);

          // If legacy format was read or local was newer, save compact format back to Firestore
          if ((!remoteRaw.nyanProgress || localIsNewer) && !getIsQuotaExhausted()) {
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
let lastWrittenContentString: string = '';
let sessionDbReadCount: number = 0;
let sessionDbWriteCount: number = 0;

export interface FirebaseAccessStats {
  sessionReads: number;
  sessionWrites: number;
  lastWriteTime: number;
  isWriting: boolean;
}

export function getFirebaseAccessStats(): FirebaseAccessStats {
  return {
    sessionReads: sessionDbReadCount,
    sessionWrites: sessionDbWriteCount,
    lastWriteTime: lastSuccessfulWriteTime,
    isWriting: isWritingToFirestore,
  };
}

export function resetFirebaseAccessStats(): void {
  sessionDbReadCount = 0;
  sessionDbWriteCount = 0;
}

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
  // Enforce a hard throttle: never write to Firestore if less than 15s since last write
  if (now - lastSuccessfulWriteTime < 15000) {
    if (!pendingWriteTimeout) {
      latestPendingData = data;
      pendingWriteTimeout = setTimeout(() => {
        pendingWriteTimeout = null;
        if (latestPendingData) {
          executeFirestoreWrite(latestPendingData, config).catch(() => {});
        }
      }, 15000 - (now - lastSuccessfulWriteTime));
    }
    return { success: true };
  }

  // Extract compact UserProgressDoc (removes 260KB of static character lore)
  const compactProgressDoc = extractUserProgress(data);

  // Hash content without fluctuating in-memory fields (hunger, stamina, playTime, timestamps)
  const sanitizedContent = JSON.parse(
    JSON.stringify(compactProgressDoc, (key, value) => {
      if (
        key === 'lastSaved' ||
        key === 'updatedAt' ||
        key === 'totalPlayTimeSec' ||
        key === 'stamina' ||
        key === 'hunger'
      ) {
        return undefined;
      }
      return value === undefined ? null : value;
    })
  );
  const currentContentString = JSON.stringify(sanitizedContent);

  // Skip write completely if meaningful content has not changed!
  if (lastWrittenContentString && lastWrittenContentString === currentContentString) {
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

    // Write the compact 2KB progress document to Firestore (strictly sanitized of undefined values)
    const payload = removeUndefinedDeep({
      ...compactProgressDoc,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, payload);

    sessionDbWriteCount++;
    lastWrittenContentString = currentContentString;
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
    if (
      err?.code === 'resource-exhausted' ||
      errMsg.includes('Quota') ||
      errMsg.includes('resource-exhausted') ||
      errMsg.includes('Free daily write units')
    ) {
      markQuotaExhausted();
      return { success: true, error: 'Firebaseの書き込み上限に達しました。ローカル保存で継続しています。' };
    }
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

// Protect state in local storage on page unload
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
  saveLocalBackup(data);
  latestPendingData = data;

  if (getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保持中' };
  }

  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  // Immediate write allowed only if >15s since last write and not currently writing
  if (isImmediate && timeSinceLast >= 15000 && !isWritingToFirestore) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    return executeFirestoreWrite(data, config);
  }

  // Debounced write
  if (pendingWriteTimeout) {
    return { success: true };
  }

  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config).catch(() => {});
    }
  }, Math.max(3000, 15000 - timeSinceLast));

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
          const remoteData = snapshot.data();
          if (remoteData && remoteData.kenchiko) {
            // Skip echo update if our own local write is pending or occurred < 2 seconds ago
            if (pendingWriteTimeout || Date.now() - lastSuccessfulWriteTime < 2000) {
              return;
            }

            const safeData = reconstructGameSaveData(remoteData, INITIAL_NYANS);
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
