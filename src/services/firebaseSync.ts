import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { GameSaveData, NyanCharacter, NyanTransparencyOptions, GiftItem, DiaryEntry, KenchikoAsobi, KenchikoState } from '../types';
import { DEFAULT_INITIAL_STATE } from './storage';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { getActiveUserId, getFirestoreDocIdForUser, getLocalStorageKeyForUser, DEFAULT_GLOBAL_DOC_ID } from './userService';
import { loadLocalKenchikoImage, saveLocalKenchikoImage } from './imageCompression';

export const GLOBAL_SHARED_DOC_ID = DEFAULT_GLOBAL_DOC_ID;

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
  lastMetAt?: number;
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
        if (char.lastMetAt) entry.lastMetAt = char.lastMetAt;
        if (char.friendshipLevel !== undefined) entry.friendshipLevel = char.friendshipLevel;
        if (char.playCount !== undefined) entry.playCount = char.playCount;
        if (char.rawImageUrl) entry.rawImageUrl = char.rawImageUrl;
        if (char.transparency) entry.transparency = char.transparency;

        // Size optimization: Protect against Firestore 1MB single-doc limit.
        // If rawImageUrl is present (e.g. Google Drive/external URL), we don't need to persist a 400KB base64 duplicate.
        // If it is a standalone custom image, allow it only if reasonable in size (< 40KB).
        if (char.customImageUrl) {
          const isLargeDataUrl = char.customImageUrl.startsWith('data:image') && char.customImageUrl.length > 40000;
          if (!char.rawImageUrl && !isLargeDataUrl) {
            entry.customImageUrl = char.customImageUrl;
          } else if (char.rawImageUrl && !isLargeDataUrl && !char.customImageUrl.startsWith('data:image')) {
            entry.customImageUrl = char.customImageUrl;
          }
        }

        nyanProgress[char.no] = entry;
      }
    }
  }

  // Cap diary to latest 30 entries for optimal payload size
  const cappedDiary = Array.isArray(data.diary) ? data.diary.slice(0, 30) : [];

  const cleanedKenchiko = { ...data.kenchiko };
  // Ensure Kenchiko's custom avatar image is synced across devices (fallback to local if memory is empty)
  if (!cleanedKenchiko.customImageUrl) {
    const localImg = loadLocalKenchikoImage();
    if (localImg) {
      cleanedKenchiko.customImageUrl = localImg;
    }
  }

  const rawDoc: UserProgressDoc = {
    version: data.version || 2,
    kenchiko: cleanedKenchiko,
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
 * Deduplicates diary entries recorded within 2000ms of each other (prevents double-firing)
 */
export function deduplicateDiary(diary: DiaryEntry[]): DiaryEntry[] {
  if (!diary || diary.length <= 1) return diary || [];
  const deduped: DiaryEntry[] = [];
  for (let i = 0; i < diary.length; i++) {
    const entry = diary[i];
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(entry.timestamp - prev.timestamp) < 2000) {
      continue;
    }
    deduped.push(entry);
  }
  return deduped;
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
          lastMetAt: prog.lastMetAt || base.lastMetAt,
          friendshipLevel: prog.friendshipLevel !== undefined ? prog.friendshipLevel : base.friendshipLevel,
          playCount: prog.playCount !== undefined ? prog.playCount : base.playCount,
          customImageUrl: prog.customImageUrl || (prog.rawImageUrl ? prog.rawImageUrl : base.customImageUrl),
          rawImageUrl: prog.rawImageUrl || base.rawImageUrl,
          transparency: prog.transparency || base.transparency,
        });
      }
    }
  }

  const mergedCharacters = Array.from(charMap.values()).sort((a, b) => a.no - b.no);
  const localKenchikoImg = loadLocalKenchikoImage();
  const remoteKenchiko = remoteDoc.kenchiko || DEFAULT_INITIAL_STATE.kenchiko;

  return {
    version: remoteDoc.version || 2,
    kenchiko: {
      ...DEFAULT_INITIAL_STATE.kenchiko,
      ...remoteKenchiko,
      customImageUrl: remoteKenchiko.customImageUrl || localKenchikoImg || '',
    },
    characters: mergedCharacters,
    inventory: remoteDoc.inventory || DEFAULT_INITIAL_STATE.inventory,
    diary: deduplicateDiary(remoteDoc.diary || DEFAULT_INITIAL_STATE.diary),
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
        lastMetAt: Math.max(sec.lastMetAt || 0, base.lastMetAt || 0),
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
        lastMetAt: prim.lastMetAt !== undefined ? prim.lastMetAt : base.lastMetAt,
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

export const BANNED_INITIAL_ASOBI_IDS = new Set<string>([
  'asobi_snack_2',
  'asobi_nap_1',
  'asobi_nap_2',
  'asobi_nap_rec',
  'asobi_work_1',
  'asobi_work_2',
  'asobi_study_1',
  'asobi_shop_1',
  'asobi_shop_2',
  'asobi_onsen_1',
  'asobi_camp_1',
  'asobi_forest_1',
  'asobi_trans_walk',
  'asobi_trans_bike',
  'asobi_trans_car',
  'asobi_trans_jinbei',
  'asobi_trans_train',
  'asobi_trans_all',
  'asobi_space_1',
  'asobi_space_2',
  'asobi_opt_glasses',
  'asobi_opt_stretch',
]);

/**
 * Ensures that deleted legacy default items can never resurrect or overwrite user items.
 * Guarantees all 15 master user items are preserved.
 */
export function sanitizeAsobiList(list?: KenchikoAsobi[]): KenchikoAsobi[] {
  const input = Array.isArray(list) ? list : [];
  // 1. Remove all banned old default items
  const filtered = input.filter((item) => item && item.id && !BANNED_INITIAL_ASOBI_IDS.has(item.id));

  // 2. Fix legacy default texts on asobi_song_strolling and asobi_snack_1 if reverted
  const sanitized: KenchikoAsobi[] = filtered.map((item) => {
    if (item.id === 'asobi_song_strolling' && item.title !== 'けんちこはお湯を沸かした') {
      return {
        ...item,
        title: 'けんちこはお湯を沸かした',
        content: 'おーまーえーのーこーとーをー♪ゆーるーしーはーしーなーいー♪',
        condition: 'loc_living' as const,
      };
    }
    if (item.id === 'asobi_snack_1' && item.title !== 'けんちこは働いている！珍しい') {
      return {
        ...item,
        title: 'けんちこは働いている！珍しい',
        content: 'かえりたいよう。あさなのにかえりたいよう',
        condition: 'loc_office' as const,
      };
    }
    return item;
  });

  // 3. Ensure all 15 user master items are always present
  const map = new Map<string, KenchikoAsobi>();
  for (const m of INITIAL_ASOBI_LIST) {
    map.set(m.id, { ...m });
  }
  for (const s of sanitized) {
    map.set(s.id, { ...s });
  }

  return Array.from(map.values());
}

/**
 * Robustly merges remote asobi list with local asobi list.
 * Remote is authoritative for the shared cloud state.
 * Any custom items created locally while offline (or with newer updatedAt) are merged into the list.
 */
export function mergeAsobiLists(
  remoteList?: KenchikoAsobi[],
  localList?: KenchikoAsobi[],
  remoteLastSaved: number = 0
): KenchikoAsobi[] {
  const remote = sanitizeAsobiList(remoteList);
  const local = sanitizeAsobiList(localList);

  const map = new Map<string, KenchikoAsobi>();

  // 1. Remote items are the baseline source of truth
  for (const item of remote) {
    map.set(item.id, { ...item });
  }

  // 2. Check local items: if local has an item with a newer update timestamp, or an offline newly-created item
  for (const localItem of local) {
    const existing = map.get(localItem.id);
    const localTime = localItem.updatedAt || localItem.createdAt || 0;

    if (!existing) {
      if (localTime > remoteLastSaved || localItem.id.startsWith('asobi_1788')) {
        map.set(localItem.id, { ...localItem });
      }
    } else {
      const remoteTime = existing.updatedAt || existing.createdAt || 0;
      if (localTime > remoteTime) {
        map.set(localItem.id, { ...localItem });
      }
    }
  }

  return sanitizeAsobiList(Array.from(map.values()));
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
const DAILY_WRITES_KEY = 'kenchiko_daily_writes_v2';
const AUTO_SYNC_ENABLED_KEY = 'kenchiko_cloud_auto_sync_enabled_v2';

// Safe daily budget: 500 writes per day (only ~2.5% of the 20,000 free daily writes)
export const MAX_DAILY_WRITES = 500;

export interface DailyWriteStats {
  date: string; // YYYY-MM-DD
  count: number;
}

export function getDailyWriteStats(): DailyWriteStats {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(DAILY_WRITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed;
      }
    }
  } catch {}
  return { date: today, count: 0 };
}

export function incrementDailyWriteCount(): number {
  const stats = getDailyWriteStats();
  stats.count += 1;
  try {
    localStorage.setItem(DAILY_WRITES_KEY, JSON.stringify(stats));
  } catch {}
  return stats.count;
}

export function isCloudAutoSyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setCloudAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(enabled));
  } catch {}
  notifyConnectionStatusChange(isCurrentlyConnected);
}

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
// Initialize with current time to prevent startup burst
let lastSuccessfulWriteTime: number = Date.now();
let isQuotaCurrentlyExhausted: boolean = Date.now() < quotaExhaustedUntil;
let onQuotaStatusChangeCallback: ((exhausted: boolean) => void) | null = null;

// Auto-clear expired quota flags on initialization
if (typeof window !== 'undefined') {
  if (quotaExhaustedUntil && Date.now() >= quotaExhaustedUntil) {
    clearQuotaExhausted();
  }
}

export function markQuotaExhausted(durationMs: number = 5 * 60 * 1000): void {
  isQuotaCurrentlyExhausted = true;
  quotaExhaustedUntil = Date.now() + durationMs;
  setPersistedQuotaUntil(quotaExhaustedUntil);
  if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(true);
  notifyConnectionStatusChange(false, 'Firebase一時待機中（ローカル保護モード）');
}

export function clearQuotaExhausted(): void {
  isQuotaCurrentlyExhausted = false;
  quotaExhaustedUntil = 0;
  setPersistedQuotaUntil(0);
  if (onQuotaStatusChangeCallback) onQuotaStatusChangeCallback(false);
  notifyConnectionStatusChange(true);
}

// Connection Status Tracking
export interface FirebaseConnectionStatus {
  isConnected: boolean;
  isOffline: boolean;
  lastError?: string;
  isQuotaExhausted?: boolean;
  isAutoSyncEnabled: boolean;
  dailyWriteCount: number;
  maxDailyWrites: number;
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
  const dailyStats = getDailyWriteStats();
  const autoSync = isCloudAutoSyncEnabled();

  // During initial boot phase (first ~2.5s), do not alarm the user with an offline warning
  const effectiveOffline = isInitialPhase ? false : (isOffline || !isCurrentlyConnected || isQuota);

  return {
    isConnected: !isOffline && isCurrentlyConnected && !isQuota,
    isOffline: effectiveOffline,
    lastError: isQuota ? 'Firestoreの1日無料枠上限に達しました（データはローカルで安全に保護されています）' : lastConnectionError,
    isQuotaExhausted: isQuota,
    isAutoSyncEnabled: autoSync,
    dailyWriteCount: dailyStats.count,
    maxDailyWrites: MAX_DAILY_WRITES,
  };
}

export function endInitialConnectionPhase(): void {
  isInitialPhase = false;
  notifyConnectionStatusChange(isCurrentlyConnected, lastConnectionError);
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

    // Connect to database with in-memory cache to prevent IndexedDB mutation burst
    if (!firestoreDb) {
      const dbId =
        activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)'
          ? activeConfig.firestoreDatabaseId
          : undefined;

      try {
        firestoreDb = initializeFirestore(
          firebaseApp,
          {
            localCache: memoryLocalCache(),
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

/**
 * Returns the active Firestore DB instance, initializing Firebase if needed.
 */
export function getFirestoreDbInstance(): Firestore | null {
  if (!firestoreDb) {
    initFirebase();
  }
  return firestoreDb;
}

/**
 * Explicitly writes a user document to Firestore for the given user ID.
 */
export async function writeUserDocExplicit(userId: string, data: GameSaveData): Promise<boolean> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) return false;
    const userDocId = getFirestoreDocIdForUser(userId);
    const userDocRef = doc(db, 'kenchiko_world', userDocId);
    const compact = extractUserProgress(data);
    const payload = removeUndefinedDeep({
      ...compact,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(userDocRef, payload);
    return true;
  } catch (err) {
    console.error('Failed to write user doc explicitly:', err);
    return false;
  }
}

/**
 * Explicitly deletes a user document from Firestore.
 */
export async function deleteUserDocExplicit(userId: string): Promise<boolean> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) return false;
    const userDocId = getFirestoreDocIdForUser(userId);
    const userDocRef = doc(db, 'kenchiko_world', userDocId);
    await deleteDoc(userDocRef);
    return true;
  } catch (err) {
    console.error('Failed to delete user doc explicitly:', err);
    return false;
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
    clearQuotaExhausted();
    notifyConnectionStatusChange(true);
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Subscribes to real-time changes on the Firestore documents (onSnapshot).
 * Enables instantaneous sync between devices and browser tabs for both:
 * 1. User-specific progress (nyanProgress, diary, inventory, stats)
 * 2. Shared master data (Asobi list & Kenchiko avatar/name)
 */
export function subscribeToRemoteChanges(
  onDataChanged: (remoteData: GameSaveData) => void,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    if (!firestoreDb) {
      initFirebase(config);
    }
    if (!firestoreDb) return () => {};

    const activeUid = getActiveUserId();
    const userDocId = config.syncDocId || getFirestoreDocIdForUser(activeUid);
    const userDocRef = doc(firestoreDb, 'kenchiko_world', userDocId);
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);

    if (unsubscribeSnapshot) {
      try {
        unsubscribeSnapshot();
      } catch {}
      unsubscribeSnapshot = null;
    }

    let unsubGlobal: Unsubscribe | null = null;

    const unsubUser = onSnapshot(
      userDocRef,
      { includeMetadataChanges: false },
      (snap) => {
        // Skip local writes that haven't been committed to server yet
        if (snap.metadata.hasPendingWrites) {
          return;
        }
        if (snap.exists()) {
          const raw = snap.data();
          if (raw && raw.kenchiko) {
            const reconstructed = reconstructGameSaveData(raw, INITIAL_NYANS);
            const currentLocal = loadLocalBackup();
            // Preserve shared master data from current local state
            const merged: GameSaveData = {
              ...reconstructed,
              asobiList: sanitizeAsobiList(currentLocal?.asobiList && currentLocal.asobiList.length > 0 ? currentLocal.asobiList : reconstructed.asobiList),
              kenchiko: {
                ...reconstructed.kenchiko,
                customImageUrl: currentLocal?.kenchiko?.customImageUrl || reconstructed.kenchiko.customImageUrl,
              },
            };
            onDataChanged(merged);
            notifyConnectionStatusChange(true);
          }
        }
      },
      (err) => {
        console.warn('Firestore onSnapshot user error:', err);
      }
    );

    if (userDocId !== GLOBAL_SHARED_DOC_ID) {
      unsubGlobal = onSnapshot(
        globalDocRef,
        { includeMetadataChanges: false },
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          if (snap.exists()) {
            const raw = snap.data();
            if (raw) {
              const currentLocal = loadLocalBackup() || DEFAULT_INITIAL_STATE;
              const merged: GameSaveData = {
                ...currentLocal,
                asobiList: sanitizeAsobiList(raw.asobiList && raw.asobiList.length > 0 ? raw.asobiList : currentLocal.asobiList),
                kenchiko: {
                  ...currentLocal.kenchiko,
                  customImageUrl: raw.kenchiko?.customImageUrl || currentLocal.kenchiko.customImageUrl,
                },
                kihonNyanCustomImageUrl: raw.kihonNyanCustomImageUrl || currentLocal.kihonNyanCustomImageUrl,
                googleDriveFolderUrl: raw.googleDriveFolderUrl || currentLocal.googleDriveFolderUrl,
              };
              saveLocalBackup(merged);
              if (raw.kenchiko?.customImageUrl) {
                saveLocalKenchikoImage(raw.kenchiko.customImageUrl);
              }
              onDataChanged(merged);
            }
          }
        },
        (err) => {
          console.warn('Firestore onSnapshot global error:', err);
        }
      );
    }

    unsubscribeSnapshot = () => {
      try {
        unsubUser();
      } catch {}
      if (unsubGlobal) {
        try {
          unsubGlobal();
        } catch {}
      }
    };

    return () => {
      if (unsubscribeSnapshot) {
        try {
          unsubscribeSnapshot();
        } catch {}
        unsubscribeSnapshot = null;
      }
    };
  } catch (e) {
    console.warn('subscribeToRemoteChanges failed to initialize:', e);
    return () => {};
  }
}

// Local Backup Safety Net Key (Dynamic by user)
export function saveLocalBackup(data: GameSaveData, userId?: string | null): void {
  try {
    const activeUid = userId !== undefined ? userId : getActiveUserId();
    const storageKey = getLocalStorageKeyForUser(activeUid);
    localStorage.setItem(storageKey, JSON.stringify(data));
    if (data.kenchiko?.customImageUrl) {
      saveLocalKenchikoImage(data.kenchiko.customImageUrl);
    }
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

// Fetch initial state from Firestore:
// 1. Common Master DB (GLOBAL_SHARED_DOC_ID): Kenchiko appearance (avatar & name) and Asobi list
// 2. User Progress DB (userDocId): Progress state (nekozukan, omoide enikki, inventory, stats)
export async function fetchInitialFirebaseState(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; data: GameSaveData; isNew?: boolean; error?: string }> {
  const localBackup = loadLocalBackup();

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyConnectionStatusChange(false, 'オフライン状態です');
      return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: 'オフライン状態です' };
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

    // --- STEP 1: Fetch Common Shared Master Document (ken-chiko-global-state) ---
    // けんちこの見た目（画像・名前）と遊びリストは全ユーザー共通のDBから読み込む
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
    let globalRaw: any = null;
    try {
      const globalSnap = await getDoc(globalDocRef);
      sessionDbReadCount++;
      if (globalSnap.exists()) {
        globalRaw = globalSnap.data();
      }
    } catch (gErr: any) {
      if (gErr?.code === 'resource-exhausted' || gErr?.status === 429) {
        markQuotaExhausted();
      }
      console.warn('Firestore global shared read note:', gErr);
    }

    // --- STEP 2: Fetch User-specific Progress Document (ken-chiko-user-ken, ken-chiko-user-chiko, etc.) ---
    // 進行状況（ねこずかん・思い出絵日記・持ち物・統計）はユーザー個別DBから読み込む
    const activeUid = getActiveUserId();
    const userDocId = config.syncDocId || getFirestoreDocIdForUser(activeUid);

    let userRaw: any = null;
    if (userDocId === GLOBAL_SHARED_DOC_ID) {
      userRaw = globalRaw;
    } else {
      try {
        const userDocRef = doc(firestoreDb, 'kenchiko_world', userDocId);
        const userSnap = await getDoc(userDocRef);
        sessionDbReadCount++;
        if (userSnap.exists()) {
          userRaw = userSnap.data();
        }
      } catch (uErr: any) {
        if (uErr?.code === 'resource-exhausted' || uErr?.status === 429) {
          markQuotaExhausted();
        }
        console.warn('Firestore user progress read note:', uErr);
      }
    }

    clearQuotaExhausted();
    notifyConnectionStatusChange(true);

    // --- STEP 3: Assemble Shared Master Data (Asobi & Kenchiko Avatar/Name) ---
    const globalAsobiList = sanitizeAsobiList(
      globalRaw?.asobiList && globalRaw.asobiList.length > 0
        ? globalRaw.asobiList
        : (userRaw?.asobiList && userRaw.asobiList.length > 0
            ? userRaw.asobiList
            : (localBackup?.asobiList && localBackup.asobiList.length > 0
                ? localBackup.asobiList
                : INITIAL_ASOBI_LIST))
    );

    const globalKenchikoAvatar =
      globalRaw?.kenchiko?.customImageUrl ||
      userRaw?.kenchiko?.customImageUrl ||
      loadLocalKenchikoImage() ||
      localBackup?.kenchiko?.customImageUrl ||
      '';

    const globalKihonNyanImg =
      globalRaw?.kihonNyanCustomImageUrl ||
      userRaw?.kihonNyanCustomImageUrl ||
      '';

    const globalDriveUrl =
      globalRaw?.googleDriveFolderUrl ||
      userRaw?.googleDriveFolderUrl ||
      '';

    // --- STEP 4: Assemble User-specific Progress Data ---
    let userBaseData: GameSaveData;
    if (userRaw && userRaw.kenchiko) {
      userBaseData = reconstructGameSaveData(userRaw, INITIAL_NYANS);
    } else if (localBackup) {
      userBaseData = localBackup;
    } else {
      userBaseData = DEFAULT_INITIAL_STATE;
    }

    const mergedCharacters = mergeCharactersWithDefaults(
      userBaseData.characters,
      localBackup?.characters
    );

    const mergedData: GameSaveData = {
      ...userBaseData,
      // 共通DBから読むデータ: あそびリスト & けんちこ（外見）
      asobiList: globalAsobiList,
      kenchiko: {
        ...userBaseData.kenchiko,
        customImageUrl: globalKenchikoAvatar,
      },
      kihonNyanCustomImageUrl: globalKihonNyanImg,
      googleDriveFolderUrl: globalDriveUrl,

      // ユーザー個別DBから読むデータ: 進行状況（ねこずかん・日記・持ち物・統計）
      characters: mergedCharacters,
      diary: userBaseData.diary || [],
      inventory:
        userBaseData.inventory && userBaseData.inventory.length > 0
          ? userBaseData.inventory
          : (localBackup?.inventory || DEFAULT_INITIAL_STATE.inventory),
      stats: userBaseData.stats || localBackup?.stats || DEFAULT_INITIAL_STATE.stats,
      lastSaved: Date.now(),
    };

    saveLocalBackup(mergedData);
    if (globalKenchikoAvatar) {
      saveLocalKenchikoImage(globalKenchikoAvatar);
    }

    return { success: true, data: mergedData, isNew: !userRaw };
  } catch (err: any) {
    notifyConnectionStatusChange(false, err?.message || String(err));
    return { success: true, data: localBackup || DEFAULT_INITIAL_STATE, error: err.message };
  }
}

let pendingWriteTimeout: any = null;
let latestPendingData: GameSaveData | null = null;
let queuedImmediateData: GameSaveData | null = null;
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

export async function executeFirestoreWrite(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  forceManual: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // Always protect data in local storage
  saveLocalBackup(data);

  // 1. Check quota exhaustion (skip if manual save)
  if (!forceManual && getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保護中' };
  }

  // 2. Check user auto-sync toggle (if false, only manual save allowed)
  if (!forceManual && !isCloudAutoSyncEnabled()) {
    return { success: true, error: 'クラウド自動書き込みはOFF（ローカル保存中）です' };
  }

  // 3. Strict daily write budget (Skip if manual save)
  const dailyStats = getDailyWriteStats();
  if (!forceManual && dailyStats.count >= MAX_DAILY_WRITES) {
    return {
      success: true,
      error: `本日の安全書き込み上限（${MAX_DAILY_WRITES}回）に達したため、ローカル保存で安全に保護しています`,
    };
  }

  const now = Date.now();
  // 4. Enforce strict rate-limit throttle: Minimum 60s between non-manual writes
  if (!forceManual && now - lastSuccessfulWriteTime < 60000) {
    if (!pendingWriteTimeout) {
      latestPendingData = data;
      pendingWriteTimeout = setTimeout(() => {
        pendingWriteTimeout = null;
        if (latestPendingData) {
          executeFirestoreWrite(latestPendingData, config, false).catch(() => {});
        }
      }, 60000 - (now - lastSuccessfulWriteTime));
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
        key === 'hunger' ||
        key === 'activityStartedAt'
      ) {
        return undefined;
      }
      return value === undefined ? null : value;
    })
  );
  const currentContentString = JSON.stringify(sanitizedContent);

  // Skip write completely if meaningful content has not changed (unless forced manual write)
  if (!forceManual && lastWrittenContentString && lastWrittenContentString === currentContentString) {
    return { success: true };
  }

  isWritingToFirestore = true;
  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        notifyConnectionStatusChange(false, initRes.error);
        lastSuccessfulWriteTime = Date.now(); // Back off on init error
        return initRes;
      }
    }
    if (!firestoreDb) {
      notifyConnectionStatusChange(false, 'Firestore is not initialized');
      lastSuccessfulWriteTime = Date.now();
      return { success: false, error: 'Firestore is not initialized' };
    }

    const activeUid = getActiveUserId();
    const userDocId = config.syncDocId || getFirestoreDocIdForUser(activeUid);
    const userDocRef = doc(firestoreDb, 'kenchiko_world', userDocId);

    // Sanitize asobiList before writing to prevent legacy default items from polluting the DB
    const cleanAsobiList = sanitizeAsobiList(compactProgressDoc.asobiList);
    compactProgressDoc.asobiList = cleanAsobiList;

    // 1. Write the compact progress document to the active user's personal document
    const payload = removeUndefinedDeep({
      ...compactProgressDoc,
      asobiList: cleanAsobiList,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(userDocRef, payload);

    // 2. Keep the Global Shared Master DB (ken-chiko-global-state) updated for common data:
    // (Asobi list, Kenchiko avatar & name, Kihon nyan custom image, Google Drive folder URL)
    if (userDocId !== GLOBAL_SHARED_DOC_ID) {
      try {
        const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
        const globalPayload = removeUndefinedDeep({
          asobiList: cleanAsobiList,
          kenchiko: {
            customImageUrl: compactProgressDoc.kenchiko?.customImageUrl || loadLocalKenchikoImage() || '',
          },
          kihonNyanCustomImageUrl: compactProgressDoc.kihonNyanCustomImageUrl || '',
          googleDriveFolderUrl: compactProgressDoc.googleDriveFolderUrl || '',
          lastSaved: Date.now(),
          updatedAt: new Date().toISOString(),
        });
        await setDoc(globalDocRef, globalPayload, { merge: true });
      } catch (globalWriteErr) {
        console.warn('Failed to update global shared master state:', globalWriteErr);
      }
    }

    sessionDbWriteCount++;
    incrementDailyWriteCount();
    lastWrittenContentString = currentContentString;
    lastSuccessfulWriteTime = Date.now();
    notifyConnectionStatusChange(true);

    if (isQuotaCurrentlyExhausted) {
      clearQuotaExhausted();
    }
    return { success: true };
  } catch (err: any) {
    lastSuccessfulWriteTime = Date.now(); // Back off on error to avoid loop
    const errMsg = err?.message || String(err);
    if (err?.code === 'resource-exhausted' || err?.status === 429) {
      markQuotaExhausted();
      return { success: true, error: 'Firebaseの書き込み上限に達しました。一時的にローカル保存で継続しています。' };
    }
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  } finally {
    isWritingToFirestore = false;
    if (queuedImmediateData) {
      const nextData = queuedImmediateData;
      queuedImmediateData = null;
      executeFirestoreWrite(nextData, config, true).catch(() => {});
    }
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

  if (isImmediate) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    if (isWritingToFirestore) {
      queuedImmediateData = data;
      return { success: true };
    }
    return executeFirestoreWrite(data, config, true);
  }

  if (getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保持中' };
  }

  // If user disabled auto-sync and it's not a direct manual trigger
  if (!isCloudAutoSyncEnabled()) {
    return { success: true };
  }

  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  // Debounced write
  if (pendingWriteTimeout) {
    return { success: true };
  }

  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config, false).catch(() => {});
    }
  }, Math.max(5000, 60000 - timeSinceLast));

  return { success: true };
}

// User-action-only and Exit-only save APIs
export async function saveOnUserAction(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  // Always update local storage first
  saveLocalBackup(data);
  latestPendingData = data;

  // If user disabled cloud auto-sync, keep 100% local
  if (!isCloudAutoSyncEnabled() || getIsQuotaExhausted()) {
    return { success: true };
  }

  // Debounce consecutive fast user actions (e.g. rapid tapping) by 5 seconds
  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  if (timeSinceLast >= 15000 && !isWritingToFirestore) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    return executeFirestoreWrite(data, config, false);
  }

  if (pendingWriteTimeout) {
    return { success: true };
  }

  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config, false).catch(() => {});
    }
  }, Math.max(5000, 15000 - timeSinceLast));

  return { success: true };
}

export async function saveOnAppExit(
  data?: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<void> {
  const dataToSave = data || latestPendingData;
  if (!dataToSave) return;
  saveLocalBackup(dataToSave);

  if (!isCloudAutoSyncEnabled() || getIsQuotaExhausted()) return;

  // Fire-and-forget sync on exit if meaningful changes exist
  executeFirestoreWrite(dataToSave, config, true).catch(() => {});
}

// Global page unload handler: Save to localStorage and try final cloud sync
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    saveOnAppExit();
  });
}

/**
 * Real-time continuous listener is intentionally deprecated.
 * Kenchiko is transaction-based (startup read, action write, exit write).
 * We maintain this signature as a no-op to prevent broken imports.
 */
export function subscribeToFirebaseState(
  _config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  _onRemoteUpdate: (data: GameSaveData) => void,
  _onError?: (err: Error) => void
): () => void {
  return () => {};
}
