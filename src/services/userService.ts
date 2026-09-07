// User management and persistence service for Multi-user support via query parameters (?user=yumi etc.)

import { collection, getDocs } from 'firebase/firestore';
import { GameSaveData, NyanCharacter, KenchikoAsobi } from '../types';
import { DEFAULT_INITIAL_STATE } from './storage';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { INITIAL_ITEMS } from '../data/items';
import {
  getFirestoreDbInstance,
  reconstructGameSaveData,
  writeUserDocExplicit,
  deleteUserDocExplicit,
} from './firebaseSync';

export const DEFAULT_GLOBAL_DOC_ID = 'ken-chiko-global-state';
export const USER_LOCAL_KEY_PREFIX = 'kenchiko_save_state_user_';
const ACTIVE_USER_STORAGE_KEY = 'kenchiko_active_user_id';
const KNOWN_USERS_STORAGE_KEY = 'kenchiko_known_user_ids_list';

export interface UserCompanionSummary {
  nyanId: number | null;
  name: string;
  reading?: string;
  motif?: string;
  imageUrl?: string;
}

export interface UserDetailData {
  userId: string;
  docId: string;
  isCurrent: boolean;
  source: 'firestore' | 'local' | 'both';
  lastSaved: number;
  updatedAt?: string;
  dataSizeEstimate: number; // in bytes
  kenchiko: {
    currentLocation: string;
    targetLocation: string | null;
    transportMethod: string | null;
    currentActivityTitle: string;
    monologue: string;
    currentCompanionNyanId: number | null;
    totalPlayTimeSec: number;
  };
  companionNyan: UserCompanionSummary | null;
  discoveredCount: number;
  totalNyans: number;
  discoveredNyans: Array<{
    no: number;
    name: string;
    reading?: string;
    motif?: string;
    friendshipLevel: number;
    playCount: number;
    discoveryDate?: string;
    imageUrl?: string;
  }>;
  inventoryCount: number;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    count: number;
    icon: string;
    effectText?: string;
  }>;
  diaryCount: number;
  diaries: Array<{
    id: string;
    timestamp: number;
    dateFormatted: string;
    locationName: string;
    activityTitle: string;
    nyanName: string | null;
    text: string;
  }>;
  stats: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  rawSaveData: GameSaveData;
}

/**
 * Gets the locally stored list of known user IDs
 */
export function getKnownUserIds(): string[] {
  if (typeof window === 'undefined') return ['default'];
  try {
    const raw = localStorage.getItem(KNOWN_USERS_STORAGE_KEY);
    if (!raw) return ['default'];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(['default', ...parsed.filter(Boolean)]));
    }
  } catch {
    // Ignore error
  }
  return ['default'];
}

/**
 * Registers a user ID in the locally stored known users list
 */
export function registerKnownUserId(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const list = getKnownUserIds();
    if (!list.includes(userId)) {
      list.push(userId);
      localStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore error
  }
}

/**
 * Removes a user ID from the locally stored known users list
 */
export function unregisterKnownUserId(userId: string): void {
  if (typeof window === 'undefined' || !userId || userId === 'default') return;
  try {
    const list = getKnownUserIds().filter((id) => id !== userId);
    localStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore error
  }
}

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
      registerKnownUserId(sanitized);
      return sanitized;
    }
  } catch (_e) {
    // Ignore URL errors
  }

  // Fallback to persisted active user if stored
  try {
    const stored = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    const sanitized = sanitizeUserId(stored);
    if (sanitized) {
      registerKnownUserId(sanitized);
      return sanitized;
    }
    return null;
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
        registerKnownUserId(sanitized);
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
 * Returns the Firestore document ID for the current active user's progress.
 * Default user: "ken-chiko-user-default"
 * User "ken": "ken-chiko-user-ken"
 * User "chiko": "ken-chiko-user-chiko"
 * (Note: Shared master data like Kenchiko avatar and Asobi list always reads from DEFAULT_GLOBAL_DOC_ID)
 */
export function getFirestoreDocIdForUser(userId: string | null): string {
  if (!userId || userId === 'default' || userId === 'global') {
    return 'ken-chiko-user-default';
  }
  return `ken-chiko-user-${userId}`;
}

/**
 * Returns the LocalStorage backup key for the current active user's progress.
 */
export function getLocalStorageKeyForUser(userId: string | null): string {
  if (!userId || userId === 'default' || userId === 'global') {
    return 'kenchiko_save_state_backup_v2';
  }
  return `${USER_LOCAL_KEY_PREFIX}${userId}`;
}

/**
 * Parses raw save data and master nyans into a detailed UserDetailData representation
 */
function buildUserDetailData(
  userId: string,
  docId: string,
  saveData: GameSaveData,
  source: 'firestore' | 'local' | 'both',
  updatedAt?: string,
  currentActiveId?: string | null
): UserDetailData {
  const isCurrent =
    userId === currentActiveId ||
    (userId === 'default' && (!currentActiveId || currentActiveId === 'default'));

  // Discovered nyans
  const discoveredNyans = (saveData.characters || [])
    .filter((c) => c.discovered)
    .map((c) => ({
      no: c.no,
      name: c.name,
      reading: c.reading,
      motif: c.motif,
      friendshipLevel: c.friendshipLevel || 1,
      playCount: c.playCount || 1,
      discoveryDate: c.discoveryDate,
      imageUrl: c.customImageUrl || c.rawImageUrl,
    }))
    .sort((a, b) => b.friendshipLevel - a.friendshipLevel || a.no - b.no);

  // Companion nyan info
  let companionNyan: UserCompanionSummary | null = null;
  if (saveData.kenchiko?.currentCompanionNyanId) {
    const compChar = (saveData.characters || []).find(
      (c) => c.no === saveData.kenchiko.currentCompanionNyanId
    );
    if (compChar) {
      companionNyan = {
        nyanId: compChar.no,
        name: compChar.name,
        reading: compChar.reading,
        motif: compChar.motif,
        imageUrl: compChar.customImageUrl || compChar.rawImageUrl,
      };
    }
  }

  // Inventory count & list
  const invList = (saveData.inventory || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    count: item.count || 0,
    icon: item.icon,
    effectText: item.effectText,
  }));
  const inventoryCount = invList.reduce((sum, item) => sum + item.count, 0);

  // Diaries
  const diaryList = (saveData.diary || []).map((d) => ({
    id: d.id,
    timestamp: d.timestamp,
    dateFormatted: d.dateFormatted,
    locationName: d.locationName,
    activityTitle: d.activityTitle,
    nyanName: d.nyanName,
    text: d.text,
  }));

  // Estimate JSON size
  let dataSizeEstimate = 0;
  try {
    dataSizeEstimate = new Blob([JSON.stringify(saveData)]).size;
  } catch {
    dataSizeEstimate = 2048;
  }

  return {
    userId,
    docId,
    isCurrent,
    source,
    lastSaved: saveData.lastSaved || Date.now(),
    updatedAt: updatedAt || (saveData.lastSaved ? new Date(saveData.lastSaved).toISOString() : undefined),
    dataSizeEstimate,
    kenchiko: {
      currentLocation: saveData.kenchiko?.currentLocation || 'living',
      targetLocation: saveData.kenchiko?.targetLocation || null,
      transportMethod: saveData.kenchiko?.transportMethod || null,
      currentActivityTitle: saveData.kenchiko?.currentActivityTitle || 'のんびり過ごしている',
      monologue: saveData.kenchiko?.monologue || '',
      currentCompanionNyanId: saveData.kenchiko?.currentCompanionNyanId || null,
      totalPlayTimeSec: saveData.kenchiko?.totalPlayTimeSec || 0,
    },
    companionNyan,
    discoveredCount: discoveredNyans.length,
    totalNyans: saveData.characters?.length || INITIAL_NYANS.length,
    discoveredNyans,
    inventoryCount,
    inventory: invList,
    diaryCount: diaryList.length,
    diaries: diaryList,
    stats: saveData.stats || {
      totalEncounters: 0,
      totalSnacksEaten: 0,
      totalNapMinutes: 0,
      totalTrips: 0,
    },
    rawSaveData: saveData,
  };
}

let cachedUsersData: UserDetailData[] | null = null;
let lastUsersFetchTime = 0;
const USERS_CACHE_TTL = 30000; // 30 seconds

export function invalidateUsersCache(): void {
  cachedUsersData = null;
  lastUsersFetchTime = 0;
}

/**
 * Fetches all registered users from both Firestore and LocalStorage
 */
export async function fetchAllRegisteredUsers(
  masterNyans: NyanCharacter[] = INITIAL_NYANS,
  forceRefresh: boolean = false
): Promise<UserDetailData[]> {
  const now = Date.now();
  if (!forceRefresh && cachedUsersData && now - lastUsersFetchTime < USERS_CACHE_TTL) {
    return cachedUsersData;
  }

  const currentActiveId = getActiveUserId();
  const userMap = new Map<
    string,
    {
      saveData: GameSaveData;
      source: 'firestore' | 'local' | 'both';
      docId: string;
      updatedAt?: string;
    }
  >();

  // 1. Fetch from Firestore `kenchiko_world` collection if connected
  try {
    const db = getFirestoreDbInstance();
    if (db) {
      const colRef = collection(db, 'kenchiko_world');
      const snap = await getDocs(colRef);
      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        // Skip global shared state document
        if (docId === DEFAULT_GLOBAL_DOC_ID) continue;

        let uid = 'default';
        if (docId.startsWith('ken-chiko-user-')) {
          uid = docId.slice('ken-chiko-user-'.length) || 'default';
        } else {
          uid = docId;
        }

        const raw = docSnap.data();
        const parsed = reconstructGameSaveData(raw, masterNyans);
        userMap.set(uid, {
          saveData: parsed,
          source: 'firestore',
          docId,
          updatedAt: raw.updatedAt,
        });
        registerKnownUserId(uid);
      }
    }
  } catch (firestoreErr) {
    console.warn('Firestore fetchAllRegisteredUsers notice:', firestoreErr);
  }

  // 2. Scan LocalStorage for default user backup and per-user backups
  if (typeof window !== 'undefined') {
    // Check default user backup
    try {
      const defRaw = localStorage.getItem('kenchiko_save_state_backup_v2');
      if (defRaw) {
        const parsed = JSON.parse(defRaw);
        const reconstructed = reconstructGameSaveData(parsed, masterNyans);
        if (userMap.has('default')) {
          userMap.get('default')!.source = 'both';
        } else {
          userMap.set('default', {
            saveData: reconstructed,
            source: 'local',
            docId: 'ken-chiko-user-default',
          });
        }
      }
    } catch (_e) {}

    // Check all `kenchiko_save_state_user_*` keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(USER_LOCAL_KEY_PREFIX)) {
          const uid = key.slice(USER_LOCAL_KEY_PREFIX.length);
          if (!uid) continue;
          const rawStr = localStorage.getItem(key);
          if (rawStr) {
            const parsed = JSON.parse(rawStr);
            const reconstructed = reconstructGameSaveData(parsed, masterNyans);
            if (userMap.has(uid)) {
              userMap.get(uid)!.source = 'both';
            } else {
              userMap.set(uid, {
                saveData: reconstructed,
                source: 'local',
                docId: getFirestoreDocIdForUser(uid),
              });
            }
            registerKnownUserId(uid);
          }
        }
      }
    } catch (_e) {}

    // Check known user ids list
    const knownList = getKnownUserIds();
    for (const kid of knownList) {
      if (!userMap.has(kid)) {
        // Prepare initial empty state
        const fresh: GameSaveData = {
          ...DEFAULT_INITIAL_STATE,
          characters: masterNyans.map((n) => ({ ...n })),
          asobiList: INITIAL_ASOBI_LIST.map((a) => ({ ...a })),
          lastSaved: Date.now(),
        };
        userMap.set(kid, {
          saveData: fresh,
          source: 'local',
          docId: getFirestoreDocIdForUser(kid),
        });
      }
    }
  }

  // Ensure default user is always in the list
  if (!userMap.has('default')) {
    userMap.set('default', {
      saveData: {
        ...DEFAULT_INITIAL_STATE,
        characters: masterNyans.map((n) => ({ ...n })),
        asobiList: INITIAL_ASOBI_LIST.map((a) => ({ ...a })),
      },
      source: 'local',
      docId: 'ken-chiko-user-default',
    });
  }

  // Build the detailed list
  const results: UserDetailData[] = [];
  for (const [uid, info] of userMap.entries()) {
    results.push(
      buildUserDetailData(
        uid,
        info.docId,
        info.saveData,
        info.source,
        info.updatedAt,
        currentActiveId
      )
    );
  }

  // Sort: current user first, then by lastSaved descending
  const sorted = results.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return b.lastSaved - a.lastSaved;
  });

  cachedUsersData = sorted;
  lastUsersFetchTime = Date.now();
  return sorted;
}

/**
 * Completely deletes a user's account from both Firestore and LocalStorage
 */
export async function deleteUserAccount(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: 'ユーザーIDが指定されていません' };
  }

  try {
    invalidateUsersCache();
    // 1. Remove from LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getLocalStorageKeyForUser(userId));
      if (userId !== 'default') {
        localStorage.removeItem(`${USER_LOCAL_KEY_PREFIX}${userId}`);
      }
      unregisterKnownUserId(userId);

      // If this was the active user, reset active user to default
      const currentActive = getActiveUserId();
      if (currentActive === userId) {
        setActiveUserId(null);
      }
    }

    // 2. Delete Firestore document
    await deleteUserDocExplicit(userId);

    return { success: true };
  } catch (err: any) {
    console.error('deleteUserAccount error:', err);
    return { success: false, error: err?.message || '削除中にエラーが発生しました' };
  }
}

/**
 * Resets a user's data back to default initial game state
 */
export async function resetUserAccount(
  userId: string,
  masterNyans: NyanCharacter[] = INITIAL_NYANS,
  masterAsobi: KenchikoAsobi[] = INITIAL_ASOBI_LIST
): Promise<{ success: boolean; error?: string; freshData?: GameSaveData }> {
  if (!userId) {
    return { success: false, error: 'ユーザーIDが指定されていません' };
  }

  try {
    invalidateUsersCache();
    const freshData: GameSaveData = {
      ...DEFAULT_INITIAL_STATE,
      characters: masterNyans.map((n) => ({
        ...n,
        discovered: false,
        friendshipLevel: 1,
        playCount: 0,
      })),
      inventory: INITIAL_ITEMS.map((item) => ({ ...item })),
      asobiList: masterAsobi.map((a) => ({ ...a })),
      diary: [],
      stats: {
        totalEncounters: 0,
        totalSnacksEaten: 0,
        totalNapMinutes: 0,
        totalTrips: 0,
      },
      lastSaved: Date.now(),
    };

    // 1. Save to LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(getLocalStorageKeyForUser(userId), JSON.stringify(freshData));
      registerKnownUserId(userId);
    }

    // 2. Sync to Firestore
    await writeUserDocExplicit(userId, freshData);

    return { success: true, freshData };
  } catch (err: any) {
    console.error('resetUserAccount error:', err);
    return { success: false, error: err?.message || '初期化中にエラーが発生しました' };
  }
}

/**
 * Creates a brand new user account with clean initial state
 */
export async function createNewUserAccount(
  newUserId: string,
  masterNyans: NyanCharacter[] = INITIAL_NYANS,
  masterAsobi: KenchikoAsobi[] = INITIAL_ASOBI_LIST
): Promise<{ success: boolean; error?: string; userId?: string; freshData?: GameSaveData }> {
  const sanitized = sanitizeUserId(newUserId);
  if (!sanitized) {
    return {
      success: false,
      error: '有効なユーザー名を入力してください（英数字・ひらがな・カタカナ・漢字など）',
    };
  }

  try {
    invalidateUsersCache();
    const freshData: GameSaveData = {
      ...DEFAULT_INITIAL_STATE,
      characters: masterNyans.map((n) => ({
        ...n,
        discovered: false,
        friendshipLevel: 1,
        playCount: 0,
      })),
      inventory: INITIAL_ITEMS.map((item) => ({ ...item })),
      asobiList: masterAsobi.map((a) => ({ ...a })),
      diary: [],
      stats: {
        totalEncounters: 0,
        totalSnacksEaten: 0,
        totalNapMinutes: 0,
        totalTrips: 0,
      },
      lastSaved: Date.now(),
    };

    // 1. Save to LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(getLocalStorageKeyForUser(sanitized), JSON.stringify(freshData));
      registerKnownUserId(sanitized);
    }

    // 2. Sync to Firestore
    await writeUserDocExplicit(sanitized, freshData);

    return { success: true, userId: sanitized, freshData };
  } catch (err: any) {
    console.error('createNewUserAccount error:', err);
    return { success: false, error: err?.message || 'ユーザー作成中にエラーが発生しました' };
  }
}

