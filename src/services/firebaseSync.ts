/**
 * firebaseSync: Cloud Firestore synchronization service for Kenchiko World.
 * Manages user-specific save slots and the global shared master document for asobi, ouen, and kounichan configurations.
 */
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  setLogLevel,
  doc,
  setDoc,
  getDoc,
  Firestore,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { GameSaveData, NyanCharacter, NyanTransparencyOptions, GiftItem, DiaryEntry, KenchikoAsobi, KenchikoState, OuenCategory, OuenItem } from '../types';
import { UserRewardState, RewardTicket, GaraponHistoryEntry } from '../types/rewards';
import { createInitialRewardState } from './rewardService';
import { DEFAULT_INITIAL_STATE } from './storage';
import { DEFAULT_KOUNICHAN_SETTINGS } from '../types/kounichan';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST } from '../data/defaultOuen';
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
}

/**
 * Lightweight, parameter-free Kenchiko state for cloud synchronization.
 * Strips out unused status parameters (mood, stamina, hunger, happiness).
 */
export interface KenchikoSyncState {
  currentLocation: string;
  targetLocation: string | null;
  transportMethod: string | null;
  currentActivity: string;
  currentActivityTitle: string;
  activityStartedAt: number;
  activityDurationSec: number;
  currentCompanionNyanId: number | null;
  customImageUrl?: string;
  monologue: string;
  equippedItem?: string | null;
  totalPlayTimeSec?: number;
}

/**
 * Highly optimized, lightweight Firestore document schema (2-5KB vs 300KB).
 */
export interface UserProgressDoc {
  version: number;
  kenchiko: KenchikoSyncState;
  nyanProgress: Record<number, NyanProgressEntry>;
  inventory: GiftItem[];
  diary: DiaryEntry[];
  asobiList?: KenchikoAsobi[];
  ouenCategories?: OuenCategory[];
  ouenList?: OuenItem[];
  kihonNyanCustomImageUrl?: string;
  googleDriveFolderUrl?: string;
  stats: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  rewards?: import('../types/rewards').UserRewardState;
  kounichan?: import('../types/kounichan').KounichanSettings;
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
 * Strictly strips out obsolete parameters (mood, stamina, hunger, happiness).
 * Strictly guarantees no `undefined` keys exist in the output object.
 */
export function extractUserProgress(data: GameSaveData): UserProgressDoc {
  const nyanProgress: Record<number, NyanProgressEntry> = {};

  if (Array.isArray(data.characters)) {
    for (const char of data.characters) {
      const hasProgress =
        char.discovered ||
        Boolean(char.discoveryDate) ||
        (char.friendshipLevel !== undefined && char.friendshipLevel > 1) ||
        (char.playCount !== undefined && char.playCount > 0) ||
        Boolean(char.lastMetAt);

      if (hasProgress) {
        const entry: NyanProgressEntry = {};
        if (char.discovered !== undefined) entry.discovered = char.discovered;
        if (char.discoveryDate) entry.discoveryDate = char.discoveryDate;
        if (char.lastMetAt) entry.lastMetAt = char.lastMetAt;
        if (char.friendshipLevel !== undefined) entry.friendshipLevel = char.friendshipLevel;
        if (char.playCount !== undefined) entry.playCount = char.playCount;

        nyanProgress[char.no] = entry;
      }
    }
  }

  // Cap diary to latest 30 entries for optimal payload size
  const cappedDiary = Array.isArray(data.diary) ? data.diary.slice(0, 30) : [];

  const localImg = loadLocalKenchikoImage();
  const cleanedKenchiko: KenchikoSyncState = {
    currentLocation: data.kenchiko?.currentLocation || 'living',
    targetLocation: data.kenchiko?.targetLocation || null,
    transportMethod: data.kenchiko?.transportMethod || null,
    currentActivity: data.kenchiko?.currentActivity || 'spacing_out',
    currentActivityTitle: data.kenchiko?.currentActivityTitle || 'のんびり過ごしている',
    activityStartedAt: data.kenchiko?.activityStartedAt || Date.now(),
    activityDurationSec: data.kenchiko?.currentActivity === 'transit'
      ? 20
      : (data.kenchiko?.activityDurationSec || 300),
    currentCompanionNyanId: data.kenchiko?.currentCompanionNyanId || null,
    customImageUrl: data.kenchiko?.customImageUrl || localImg || '',
    monologue: data.kenchiko?.monologue || '',
    equippedItem: data.kenchiko?.equippedItem || null,
    totalPlayTimeSec: data.kenchiko?.totalPlayTimeSec || 0,
  };

  const rawDoc: UserProgressDoc = {
    version: data.version || 2,
    kenchiko: cleanedKenchiko,
    nyanProgress,
    inventory: data.inventory || [],
    diary: cappedDiary,
    asobiList: data.asobiList || [],
    ouenCategories: data.ouenCategories || INITIAL_OUEN_CATEGORIES,
    ouenList: data.ouenList || INITIAL_OUEN_LIST,
    kihonNyanCustomImageUrl: data.kihonNyanCustomImageUrl || '',
    googleDriveFolderUrl: data.googleDriveFolderUrl || '',
    stats: data.stats || {
      totalEncounters: 0,
      totalSnacksEaten: 0,
      totalNapMinutes: 0,
      totalTrips: 0,
    },
    rewards: data.rewards ? removeUndefinedDeep(data.rewards) : undefined,
    kounichan: data.kounichan ? removeUndefinedDeep(data.kounichan) : undefined,
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
 * Safely merges cloud rewards state with local backup rewards state,
 * preventing point loss, ticket loss, or duplicate ticket IDs.
 */
export function mergeRewardStates(
  cloudRewards?: UserRewardState,
  localRewards?: UserRewardState
): UserRewardState {
  if (!cloudRewards && !localRewards) {
    return createInitialRewardState();
  }
  if (!cloudRewards) return localRewards || createInitialRewardState();
  if (!localRewards) return cloudRewards;

  // Merge tickets avoiding duplicates by ID
  const ticketMap = new Map<string, RewardTicket>();
  for (const t of localRewards.tickets || []) {
    ticketMap.set(t.id, t);
  }
  for (const t of cloudRewards.tickets || []) {
    const existing = ticketMap.get(t.id);
    if (existing) {
      ticketMap.set(t.id, {
        ...existing,
        ...t,
        isUsed: existing.isUsed || t.isUsed,
        usedAt: existing.usedAt || t.usedAt,
      });
    } else {
      ticketMap.set(t.id, t);
    }
  }

  // Merge readStoryIds
  const readStories = Array.from(
    new Set([...(cloudRewards.readStoryIds || []), ...(localRewards.readStoryIds || [])])
  );

  // Merge history avoiding duplicates by ID
  const historyMap = new Map<string, GaraponHistoryEntry>();
  for (const h of localRewards.history || []) {
    historyMap.set(h.id, h);
  }
  for (const h of cloudRewards.history || []) {
    historyMap.set(h.id, h);
  }
  const mergedHistory = Array.from(historyMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  return {
    points: Math.max(cloudRewards.points || 0, localRewards.points || 0),
    lifetimePoints: Math.max(cloudRewards.lifetimePoints || 0, localRewards.lifetimePoints || 0),
    hasClaimedInitialDiscoveryBonus: Boolean(
      cloudRewards.hasClaimedInitialDiscoveryBonus || localRewards.hasClaimedInitialDiscoveryBonus
    ),
    initialBonusAmount: Math.max(
      cloudRewards.initialBonusAmount || 0,
      localRewards.initialBonusAmount || 0
    ),
    lastPettedDate: cloudRewards.lastPettedDate || localRewards.lastPettedDate,
    readStoryIds: readStories,
    tickets: Array.from(ticketMap.values()),
    history: mergedHistory,
  };
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

  // 1. Legacy doc support: If remote doc has full `characters` array (only adopt individual progress)
  if (Array.isArray(remoteDoc.characters) && remoteDoc.characters.length > 0) {
    for (const remoteChar of remoteDoc.characters) {
      const base = charMap.get(remoteChar.no);
      if (base) {
        charMap.set(remoteChar.no, {
          ...base,
          discovered: remoteChar.discovered !== undefined ? remoteChar.discovered : base.discovered,
          discoveryDate: remoteChar.discoveryDate || base.discoveryDate,
          lastMetAt: remoteChar.lastMetAt || base.lastMetAt,
          friendshipLevel: remoteChar.friendshipLevel !== undefined ? remoteChar.friendshipLevel : base.friendshipLevel,
          playCount: remoteChar.playCount !== undefined ? remoteChar.playCount : base.playCount,
          // Images and visual definitions strictly remain base (master data)
        });
      }
    }
  }

  // 2. Modern compact schema: `nyanProgress` dictionary (PROGRESS ONLY)
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
          // Master image is authoritative; user progress NEVER carries or overrides character images
        });
      }
    }
  }

  const mergedCharacters = Array.from(charMap.values()).sort((a, b) => a.no - b.no);
  const localKenchikoImg = loadLocalKenchikoImage();
  const remoteKenchiko = remoteDoc.kenchiko || DEFAULT_INITIAL_STATE.kenchiko;
  const isTransit = remoteKenchiko.currentActivity === 'transit';
  const transitElapsedMs = isTransit && remoteKenchiko.activityStartedAt
    ? Date.now() - remoteKenchiko.activityStartedAt
    : 0;

  // If remote data says Kenchiko is in transit but > 20s have already passed, auto-complete transit to arrival location
  let cleanedKenchiko = {
    ...DEFAULT_INITIAL_STATE.kenchiko,
    ...remoteKenchiko,
    activityDurationSec: isTransit ? 20 : (remoteKenchiko.activityDurationSec || 300),
    customImageUrl: remoteKenchiko.customImageUrl || localKenchikoImg || '',
  };

  if (isTransit && transitElapsedMs > 20000) {
    cleanedKenchiko = {
      ...cleanedKenchiko,
      currentLocation: remoteKenchiko.targetLocation || remoteKenchiko.currentLocation || 'living',
      targetLocation: null,
      transportMethod: null,
      currentActivity: 'spacing_out',
      currentActivityTitle: 'のんびり過ごしている',
      activityStartedAt: Date.now(),
      activityDurationSec: 300,
    };
  }

  return {
    version: remoteDoc.version || 2,
    kenchiko: cleanedKenchiko,
    characters: mergedCharacters,
    inventory: remoteDoc.inventory || DEFAULT_INITIAL_STATE.inventory,
    diary: deduplicateDiary(remoteDoc.diary || DEFAULT_INITIAL_STATE.diary),
    asobiList: remoteDoc.asobiList || DEFAULT_INITIAL_STATE.asobiList,
    ouenCategories: remoteDoc.ouenCategories || DEFAULT_INITIAL_STATE.ouenCategories || INITIAL_OUEN_CATEGORIES,
    ouenList: remoteDoc.ouenList || DEFAULT_INITIAL_STATE.ouenList || INITIAL_OUEN_LIST,
    kihonNyanCustomImageUrl: remoteDoc.kihonNyanCustomImageUrl,
    googleDriveFolderUrl: remoteDoc.googleDriveFolderUrl,
    stats: remoteDoc.stats || DEFAULT_INITIAL_STATE.stats,
    rewards: remoteDoc.rewards || DEFAULT_INITIAL_STATE.rewards,
    kounichan: remoteDoc.kounichan || DEFAULT_KOUNICHAN_SETTINGS,
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
        discovered: Boolean(sec.discovered || base.discovered),
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
        discovered: Boolean(prim.discovered || base.discovered),
        discoveryDate: prim.discoveryDate || base.discoveryDate,
        lastMetAt: Math.max(prim.lastMetAt || 0, base.lastMetAt || 0),
        friendshipLevel: Math.max(prim.friendshipLevel || 0, base.friendshipLevel || 0),
        playCount: Math.max(prim.playCount || 0, base.playCount || 0),
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
  syncDocId: 'ken-chiko-global-master',
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

// Quota & Rate Limit Protection State
const QUOTA_STORAGE_KEY = 'kenchiko_firestore_quota_until';
const DAILY_WRITES_KEY = 'kenchiko_daily_writes_v2';
const AUTO_SYNC_ENABLED_KEY = 'kenchiko_cloud_auto_sync_enabled_v2';

// Safe daily budget: 150 writes per day (far below the 20,000 free daily writes)
export const MAX_DAILY_WRITES = 150;
const DAILY_LIMIT_DISABLED_KEY = 'kenchiko_daily_limit_disabled_v2';

export function isDailyLimitDisabled(): boolean {
  try {
    return localStorage.getItem(DAILY_LIMIT_DISABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDailyLimitDisabled(disabled: boolean): void {
  try {
    localStorage.setItem(DAILY_LIMIT_DISABLED_KEY, String(disabled));
  } catch {}
  notifyConnectionStatusChange(isCurrentlyConnected);
}

export function isAdminSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const sessionAuth = sessionStorage.getItem('kenchiko_admin_authenticated') === 'true';
    const params = new URLSearchParams(window.location.search);
    const isStandalone = params.has('admin') || params.has('dev') || params.has('key') || params.has('pass');
    return sessionAuth || isStandalone || isDailyLimitDisabled();
  } catch {
    return false;
  }
}

export function resetDailyWriteCount(): void {
  const today = new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem(DAILY_WRITES_KEY, JSON.stringify({ date: today, count: 0 }));
  } catch {}
  notifyConnectionStatusChange(isCurrentlyConnected);
}

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
    // STRICT SAFETY: Default to false. Automatic background writes are disabled to completely eliminate quota consumption.
    return val === 'true';
  } catch {
    return false;
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
  isDailyLimitDisabled: boolean;
  isAdminUncapped: boolean;
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
  const limitDisabled = isDailyLimitDisabled();
  const adminActive = isAdminSessionActive();

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
    isDailyLimitDisabled: limitDisabled,
    isAdminUncapped: adminActive || limitDisabled,
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

    // Suppress internal connection retry warning logs from polluting console
    try {
      setLogLevel('silent');
    } catch {}

    // Connect to database with in-memory cache and robust HTTP long-polling (prevents iframe WebChannel drops)
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
            experimentalForceLongPolling: true,
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

let lastConnectionCheckTime = 0;
let lastConnectionCheckResult: { success: boolean; error?: string } = { success: true };

export async function testFirebaseConnection(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyConnectionStatusChange(false, 'オフライン状態です');
    return { success: false, error: '端末がオフラインです' };
  }

  const now = Date.now();
  // If tested in last 2 minutes and succeeded, reuse result without performing a redundant Firestore read
  if (now - lastConnectionCheckTime < 120000 && lastConnectionCheckResult.success && isCurrentlyConnected) {
    return lastConnectionCheckResult;
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

    const docId = config.syncDocId || GLOBAL_SHARED_DOC_ID;
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);
    await getDoc(docRef);
    sessionDbReadCount++;
    console.log(`[CloudSync] 🔍 Firestore疎通確認 [1件読込]: ドキュメント=kenchiko_world/${docId}`);
    lastConnectionCheckTime = Date.now();
    lastConnectionCheckResult = { success: true };
    clearQuotaExhausted();
    notifyConnectionStatusChange(true);
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    lastConnectionCheckTime = Date.now();
    lastConnectionCheckResult = { success: false, error: errMsg };
    notifyConnectionStatusChange(false, errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Real-time changes subscription (disabled to prevent background read traffic).
 * Game state is maintained locally with zero periodic cloud reads.
 */
export function subscribeToRemoteChanges(
  _onDataChanged: (remoteData: GameSaveData) => void,
  _config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): () => void {
  return () => {};
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
        // Automatically ensure asobiList, ouenList, and characters are normalized with latest master defaults
        const asobi = Array.isArray(parsed.asobiList) && parsed.asobiList.length >= INITIAL_ASOBI_LIST.length
          ? parsed.asobiList
          : INITIAL_ASOBI_LIST;

        const ouen = Array.isArray(parsed.ouenList) && parsed.ouenList.length >= INITIAL_OUEN_LIST.length
          ? parsed.ouenList
          : INITIAL_OUEN_LIST;

        const ouenCats = Array.isArray(parsed.ouenCategories) && parsed.ouenCategories.length >= INITIAL_OUEN_CATEGORIES.length
          ? parsed.ouenCategories
          : INITIAL_OUEN_CATEGORIES;

        const progressMap = new Map((parsed.characters || []).map((c: any) => [c.no, c]));
        const characters = INITIAL_NYANS.map((master) => {
          const cur = progressMap.get(master.no) as any;
          if (!cur) return master;
          return {
            ...master,
            discovered: Boolean(cur.discovered),
            discoveryDate: cur.discoveryDate,
            lastMetAt: cur.lastMetAt || 0,
            friendshipLevel: Math.max(cur.friendshipLevel || 1, 1),
            playCount: cur.playCount || 0,
            customImageUrl: master.customImageUrl || cur.customImageUrl || undefined,
            rawImageUrl: master.rawImageUrl || cur.rawImageUrl || undefined,
            transparency: master.transparency || cur.transparency,
          };
        });

        return {
          ...parsed,
          asobiList: asobi,
          ouenList: ouen,
          ouenCategories: ouenCats,
          characters,
        } as GameSaveData;
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

export interface MasterFetchStatus {
  fetchedFromCloud: boolean;
  docId: string;
  asobiCount?: number;
  ouenCount?: number;
  charactersCount?: number;
  customImagesCount?: number;
  errorDetail?: string;
  timestamp: number;
}

export interface InitialFetchResult {
  success: boolean;
  data: GameSaveData;
  isNew?: boolean;
  error?: string;
  masterStatus: MasterFetchStatus;
}

// Fetch initial state from Firestore:
// 1. Common Master DB (GLOBAL_SHARED_DOC_ID): Kenchiko appearance (avatar & name) and Asobi list
// 2. User Progress DB (userDocId): Progress state (nekozukan, omoide enikki, inventory, stats)
let inFlightInitialFetchPromise: Promise<InitialFetchResult> | null = null;
let lastInitialFetchTime = 0;
let lastInitialFetchResult: InitialFetchResult | null = null;
let lastInitialFetchUid: string | null = null;

export async function fetchInitialFirebaseState(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  forceRefresh: boolean = false
): Promise<InitialFetchResult> {
  const activeUid = getActiveUserId();

  if (!forceRefresh && inFlightInitialFetchPromise) {
    return inFlightInitialFetchPromise;
  }

  if (!forceRefresh && lastInitialFetchResult && Date.now() - lastInitialFetchTime < 15000 && lastInitialFetchUid === activeUid) {
    return lastInitialFetchResult;
  }

  const doFetch = async (): Promise<InitialFetchResult> => {
    const localBackup = loadLocalBackup();
    const timestamp = Date.now();

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notifyConnectionStatusChange(false, 'オフライン状態です');
        return {
          success: false,
          data: localBackup || DEFAULT_INITIAL_STATE,
          error: 'オフライン状態です',
          masterStatus: {
            fetchedFromCloud: false,
            docId: 'ken-chiko-global-master',
            errorDetail: 'ブラウザがオフラインです',
            timestamp,
          },
        };
      }

      if (!firestoreDb) {
        const initRes = initFirebase(config);
        if (!initRes.success) {
          notifyConnectionStatusChange(false, initRes.error);
          return {
            success: false,
            data: localBackup || DEFAULT_INITIAL_STATE,
            error: initRes.error,
            masterStatus: {
              fetchedFromCloud: false,
              docId: 'ken-chiko-global-master',
              errorDetail: initRes.error || 'Firebase初期化エラー',
              timestamp,
            },
          };
        }
      }
      if (!firestoreDb) {
        notifyConnectionStatusChange(false, 'Firestore is not ready');
        return {
          success: false,
          data: localBackup || DEFAULT_INITIAL_STATE,
          error: 'Firestore is not ready',
          masterStatus: {
            fetchedFromCloud: false,
            docId: 'ken-chiko-global-master',
            errorDetail: 'Firestoreのインスタンスを取得できませんでした',
            timestamp,
          },
        };
      }

      // --- STEP 1: Fetch Common Shared Master Document (ken-chiko-global-master & fallback ken-chiko-global-state) ---
      // けんちこの見た目（画像・名前）と遊びリスト、応援、図鑑マスターは全ユーザー共通の公式マスターから読み込む
      let globalRaw: any = null;
      let masterDocIdUsed = 'ken-chiko-global-master';
      let masterErrorDetail: string | undefined = undefined;

      try {
        const masterDocRef = doc(firestoreDb, 'kenchiko_world', 'ken-chiko-global-master');
        const masterSnap = await getDoc(masterDocRef);
        sessionDbReadCount++;
        if (masterSnap.exists()) {
          globalRaw = masterSnap.data();
          masterDocIdUsed = 'ken-chiko-global-master';
        } else {
          const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
          const globalSnap = await getDoc(globalDocRef);
          sessionDbReadCount++;
          if (globalSnap.exists()) {
            globalRaw = globalSnap.data();
            masterDocIdUsed = GLOBAL_SHARED_DOC_ID;
          } else {
            masterErrorDetail = 'Firestore上にマスタードキュメント (ken-chiko-global-master / global-state) が見つかりませんでした';
          }
        }
      } catch (gErr: any) {
        if (gErr?.code === 'resource-exhausted' || gErr?.status === 429) {
          markQuotaExhausted();
        }
        masterErrorDetail = `マスター読込エラー: ${gErr?.message || gErr?.code || String(gErr)}`;
        console.warn('Firestore global shared read note:', gErr);
      }

      const masterFetched = Boolean(globalRaw);

      // --- STEP 2: Fetch User-specific Progress Document (ken-chiko-user-ken, ken-chiko-user-chiko, etc.) ---
      // 進行状況（ねこずかん・思い出絵日記・持ち物・統計）はユーザー個別DBから読み込む
      const userDocId = config.syncDocId || getFirestoreDocIdForUser(activeUid);

      let userRaw: any = null;
      let userErrorDetail: string | undefined = undefined;
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
          userErrorDetail = `ユーザーデータ読込エラー: ${uErr?.message || uErr?.code || String(uErr)}`;
          console.warn('Firestore user progress read note:', uErr);
        }
      }

      clearQuotaExhausted();
      notifyConnectionStatusChange(true);
      console.log(`[CloudSync] 📥 Firestore読込完了 [2件]: master(${masterDocIdUsed}, 成功=${masterFetched}) + user(${userDocId}) (累計セッション読込: ${sessionDbReadCount}回)`);

    // --- STEP 3: Assemble Shared Master Data (Asobi & Kenchiko Avatar/Name) ---
    // Asobi list is strictly loaded from the Global Shared Master document (or local backup / initial defaults)
    const globalAsobiList = sanitizeAsobiList(
      globalRaw?.asobiList && globalRaw.asobiList.length > 0
        ? globalRaw.asobiList
        : (localBackup?.asobiList && localBackup.asobiList.length > 0
            ? localBackup.asobiList
            : INITIAL_ASOBI_LIST)
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

    const globalOuenCategories: OuenCategory[] =
      globalRaw?.ouenCategories && globalRaw.ouenCategories.length > 0
        ? globalRaw.ouenCategories
        : (localBackup?.ouenCategories && localBackup.ouenCategories.length > 0
            ? localBackup.ouenCategories
            : INITIAL_OUEN_CATEGORIES);

    const globalOuenList: OuenItem[] =
      globalRaw?.ouenList && globalRaw.ouenList.length > 0
        ? globalRaw.ouenList
        : (localBackup?.ouenList && localBackup.ouenList.length > 0
            ? localBackup.ouenList
            : INITIAL_OUEN_LIST);

    const globalKounichanSettings: import('../types/kounichan').KounichanSettings =
      globalRaw?.kounichan && typeof globalRaw.kounichan === 'object'
        ? {
            ...DEFAULT_KOUNICHAN_SETTINGS,
            ...globalRaw.kounichan,
            vehicles: {
              ...DEFAULT_KOUNICHAN_SETTINGS.vehicles,
              ...(globalRaw.kounichan.vehicles || {}),
            },
            stats: {
              ...DEFAULT_KOUNICHAN_SETTINGS.stats,
              ...(globalRaw.kounichan.stats || {}),
            },
          }
        : (localBackup?.kounichan || DEFAULT_KOUNICHAN_SETTINGS);

    // --- STEP 4: Assemble User-specific Progress Data ---
    // 1. 公式マスターから最新キャラクターリストを取得
    const masterNyans: NyanCharacter[] =
      Array.isArray(globalRaw?.characters) && globalRaw.characters.length > 0
        ? globalRaw.characters
        : INITIAL_NYANS;

    let userBaseData: GameSaveData;
    if (userRaw && userRaw.kenchiko) {
      userBaseData = reconstructGameSaveData(userRaw, masterNyans);
    } else if (localBackup) {
      userBaseData = localBackup;
    } else {
      userBaseData = DEFAULT_INITIAL_STATE;
    }

    // 2. 公式マスターの定義・画像を厳格な正本とし、ユーザーの進行度（発見・親密度など）のみをマージ
    const progressMap = new Map((userBaseData.characters || []).map((c) => [c.no, c]));
    const mergedCharacters: NyanCharacter[] = masterNyans.map((master) => {
      const cur = progressMap.get(master.no);
      if (!cur) return master;
      return {
        ...master,
        discovered: Boolean(cur.discovered),
        discoveryDate: cur.discoveryDate,
        lastMetAt: cur.lastMetAt || 0,
        friendshipLevel: Math.max(cur.friendshipLevel || 1, 1),
        playCount: cur.playCount || 0,
        // 画像と透過設定は公式マスターのみが唯一の正本
        customImageUrl: master.customImageUrl || undefined,
        rawImageUrl: master.rawImageUrl || undefined,
        transparency: master.transparency,
      };
    });

    const mergedData: GameSaveData = {
      ...userBaseData,
      // 共通DBから読むデータ: あそびリスト & 応援メッセージ & こうにちゃん設定 & けんちこ（外見）
      asobiList: globalAsobiList,
      ouenCategories: globalOuenCategories,
      ouenList: globalOuenList,
      kounichan: globalKounichanSettings,
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
      rewards: mergeRewardStates(userBaseData.rewards, localBackup?.rewards),
      lastSaved: Date.now(),
    };

    saveLocalBackup(mergedData);
    if (globalKenchikoAvatar) {
      saveLocalKenchikoImage(globalKenchikoAvatar);
    }

    // Initialize content signature from freshly loaded remote state so startup triggers 0 echo writes
    try {
      const compactLoaded = extractUserProgress(mergedData);
      lastWrittenContentString = getMeaningfulUserProgressHash(compactLoaded);
    } catch (_hashErr) {}

    const masterImagesCount = (masterNyans || []).filter(c => Boolean(c.customImageUrl)).length;
    const masterStatus: MasterFetchStatus = {
      fetchedFromCloud: masterFetched,
      docId: masterDocIdUsed,
      asobiCount: globalAsobiList.length,
      ouenCount: globalOuenList.length,
      charactersCount: masterNyans.length,
      customImagesCount: masterImagesCount,
      errorDetail: masterErrorDetail,
      timestamp,
    };

    const overallSuccess = masterFetched && !masterErrorDetail;
    const result: InitialFetchResult = {
      success: overallSuccess,
      data: mergedData,
      isNew: !userRaw,
      error: masterErrorDetail || userErrorDetail,
      masterStatus,
    };
    lastInitialFetchTime = Date.now();
    lastInitialFetchUid = activeUid;
    lastInitialFetchResult = result;
    return result;
  } catch (err: any) {
    notifyConnectionStatusChange(false, err?.message || String(err));
    return {
      success: false,
      data: localBackup || DEFAULT_INITIAL_STATE,
      error: err.message || '予期せぬ読込エラーが発生しました',
      masterStatus: {
        fetchedFromCloud: false,
        docId: 'ken-chiko-global-master',
        errorDetail: err.message || String(err),
        timestamp,
      },
    };
  }
  };

  inFlightInitialFetchPromise = doFetch().finally(() => {
    inFlightInitialFetchPromise = null;
  });

  return inFlightInitialFetchPromise;
}

let pendingWriteTimeout: any = null;
let latestPendingData: GameSaveData | null = null;
let queuedImmediateData: GameSaveData | null = null;
let isWritingToFirestore = false;
let lastWrittenContentString: string = '';
let sessionDbReadCount: number = 0;
let sessionDbWriteCount: number = 0;

/**
 * Global audit recorder for any Firestore write across the entire application.
 * Increments session & daily counters and emits an event for reactive UI display.
 */
export function recordFirestoreWrite(docName: string, count: number = 1): void {
  sessionDbWriteCount += count;
  for (let i = 0; i < count; i++) {
    incrementDailyWriteCount();
  }
  console.log(`[FirestoreWriteAudit] 🎯 書き込み記録: ${docName} (+${count}回, セッション累計: ${sessionDbWriteCount}回, 本日累計: ${getDailyWriteStats().count}回)`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kenchiko-firestore-write', {
        detail: { docName, count, sessionWrites: sessionDbWriteCount, dailyWrites: getDailyWriteStats().count },
      })
    );
  }
}

/**
 * Cooldown between automatic routine cloud writes: 120 seconds (2 minutes).
 * LocalStorage updates at 0ms latency for 100% data safety.
 */
export const MIN_AUTO_SYNC_INTERVAL_MS = 120000;

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

/**
 * Computes a deterministic content signature of meaningful user progress.
 * Strictly excludes fluctuating ambient states (monologue, activity timer, lastMetAt, lastSaved, etc.)
 * so routine simulation ticks or background tab updates generate 0 Firestore writes.
 */
export function getMeaningfulUserProgressHash(doc: UserProgressDoc): string {
  const nyanKeys = Object.keys(doc.nyanProgress || {}).sort((a, b) => Number(a) - Number(b));
  const nyanStr = nyanKeys
    .map((k) => {
      const entry = doc.nyanProgress[Number(k)];
      return `${k}:${entry.discovered ? 1 : 0}:${entry.friendshipLevel || 0}:${entry.playCount || 0}`;
    })
    .join(';');

  const invStr = (doc.inventory || [])
    .map((item) => `${item.id}:${item.count}`)
    .sort()
    .join(';');

  // Diary length and summary (ignore millisecond timestamps)
  const diaryStr = (doc.diary || [])
    .slice(0, 30)
    .map((d) => `${d.activityTitle || ''}@${d.locationName || ''}`)
    .join(';');

  const statsStr = `${doc.stats?.totalEncounters || 0}:${doc.stats?.totalSnacksEaten || 0}:${doc.stats?.totalNapMinutes || 0}:${doc.stats?.totalTrips || 0}`;

  const assetsStr = `${doc.kenchiko?.customImageUrl || ''}|${doc.kihonNyanCustomImageUrl || ''}|${doc.googleDriveFolderUrl || ''}|${doc.kenchiko?.equippedItem || ''}|${doc.kenchiko?.currentLocation || ''}`;

  const rewardsStr = `${doc.rewards?.points || 0}:${(doc.rewards?.tickets || []).length}:${(doc.rewards?.tickets || []).filter((t) => t.isUsed).length}`;

  return `${nyanStr}#${invStr}#${diaryStr}#${statsStr}#${assetsStr}#${rewardsStr}`;
}

// Burst write tracker: strictly prevents runaway loops from generating dozens or hundreds of writes in seconds
const recentWriteTimestamps: number[] = [];
const BURST_WINDOW_MS = 60000; // 1 minute
const MAX_BURST_WRITES_PER_WINDOW = 6; // Max 6 writes per minute (plenty for normal human actions, hard stops abnormal spikes)

export async function executeFirestoreWrite(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  forceManual: boolean = false,
  bypassDailyLimit: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // Always protect data in local storage immediately (0 latency, 0 quota)
  saveLocalBackup(data);

  const isAdmin = bypassDailyLimit || isAdminSessionActive() || isDailyLimitDisabled();
  const dailyStats = getDailyWriteStats();

  // Burst Circuit Breaker: strictly prevent abnormal spikes (hard-stops runaway writes exceeding 6 writes/min)
  const nowForBurst = Date.now();
  const burstWindowStart = nowForBurst - BURST_WINDOW_MS;
  while (recentWriteTimestamps.length > 0 && recentWriteTimestamps[0] < burstWindowStart) {
    recentWriteTimestamps.shift();
  }
  if (recentWriteTimestamps.length >= MAX_BURST_WRITES_PER_WINDOW) {
    console.warn(`[CircuitBreaker] 🛑 短時間の書き込みスパイクを検知 (${recentWriteTimestamps.length}回/分)。異常書き込み防止のためFirestore書き込みを遮断し、ローカルに安全保存しました。`);
    return {
      success: true,
      error: '短時間の過剰書き込みを検知したため、ローカル保存で安全に保護しています。',
    };
  }

  // Absolute hard emergency ceiling for ANY session (including admin) to prevent 20,000 quota exhaustion
  const ABSOLUTE_DAILY_EMERGENCY_LIMIT = 500;
  if (dailyStats.count >= ABSOLUTE_DAILY_EMERGENCY_LIMIT) {
    console.warn(`[CloudSync] 🛑 1日の緊急安全上限(${ABSOLUTE_DAILY_EMERGENCY_LIMIT}回)に達したためローカル保存に固定`);
    return {
      success: true,
      error: `Firestore無料枠保護のため、本日の安全書き込み上限（${ABSOLUTE_DAILY_EMERGENCY_LIMIT}回）で停止し、ローカル保存で安全に継続しています。`,
    };
  }

  // STRICT SAFETY GUARD: Block all automatic background writes.
  // ONLY explicit manual button clicks (forceManual === true, such as "Firebaseに保存") are allowed to write to Firestore!
  if (!forceManual) {
    console.log('[CloudSync] 🛡️ 自動書き込みは安全のため完全遮断中（手動保存ボタンのみ許可）');
    return { success: true };
  }

  // 1. Check quota exhaustion (skip if manual save or admin)
  if (!forceManual && !isAdmin && getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保護中' };
  }

  // 1.5. If active user is default/unspecified, DO NOT perform automatic cloud writes.
  // Anonymous / default users in preview iframe should be 100% local only unless manual save button is clicked.
  const activeUid = getActiveUserId();
  if (!forceManual && !isAdmin && (!activeUid || activeUid === 'default' || activeUid === 'global')) {
    console.log('[CloudSync] 🛑 プレイヤー未指定（プレビュー/デフォルト環境）のためクラウド自動書き込みをスキップ（ローカル完全保護）');
    return { success: true };
  }

  // 2. Check user auto-sync toggle (if false, only manual save or admin allowed)
  if (!forceManual && !isAdmin && !isCloudAutoSyncEnabled()) {
    console.log('[CloudSync] 🛑 クラウド自動書き込みOFF: ローカル保存のみ実施（Firestore通信: 0回）');
    return { success: true, error: 'クラウド自動書き込みはOFF（ローカル保存中）です' };
  }

  // 3. Strict daily write budget (Skip if manual save, admin session, or daily limit disabled)
  if (!forceManual && !isAdmin && dailyStats.count >= MAX_DAILY_WRITES) {
    console.warn(`[CloudSync] ⚠️ 本日の安全書き込み上限(${MAX_DAILY_WRITES}回)に達したためローカル保存に切り替え`);
    return {
      success: true,
      error: `本日の安全書き込み上限（${MAX_DAILY_WRITES}回）に達したため、ローカル保存で安全に保護しています`,
    };
  }

  // Extract compact UserProgressDoc (removes static character lore)
  const compactProgressDoc = extractUserProgress(data);
  const currentMeaningfulHash = getMeaningfulUserProgressHash(compactProgressDoc);

  // Skip write completely if meaningful game progress has not changed (ALWAYS check this to prevent runaway writes)
  if (lastWrittenContentString && lastWrittenContentString === currentMeaningfulHash) {
    console.log('[CloudSync] ⏭️ クラウド書き込みスキップ: 有意な進行度（新発見・アイテム等）の変化なし（Firestore通信: 0回）');
    return { success: true };
  }

  const now = Date.now();
  // 4. Enforce rate-limit throttle: Minimum 120s for auto-sync, 10s for manual/admin writes
  const minInterval = isAdmin ? 10000 : MIN_AUTO_SYNC_INTERVAL_MS;
  if (now - lastSuccessfulWriteTime < minInterval) {
    const waitSec = Math.round((minInterval - (now - lastSuccessfulWriteTime)) / 1000);
    console.log(`[CloudSync] ⏳ スロットル待機中: 最低間隔のため待機 (${waitSec}秒後に保留分を書き込み)`);
    if (!pendingWriteTimeout) {
      latestPendingData = data;
      pendingWriteTimeout = setTimeout(() => {
        pendingWriteTimeout = null;
        if (latestPendingData) {
          executeFirestoreWrite(latestPendingData, config, false, isAdmin).catch(() => {});
        }
      }, minInterval - (now - lastSuccessfulWriteTime));
    }
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

    // 1. Write the compact progress document EXCLUSIVELY to the active user's personal document
    // NOTE: asobiList, ouenList and master configs are global master collections and are NEVER written here!
    const { asobiList: _ignoredAsobi, ouenList: _ignoredOuen, ouenCategories: _ignoredOuenCat, ...userProgressOnly } = compactProgressDoc as any;
    const payload = removeUndefinedDeep({
      ...userProgressOnly,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(userDocRef, payload);
    sessionDbWriteCount++;
    incrementDailyWriteCount();
    recentWriteTimestamps.push(Date.now());
    lastWrittenContentString = currentMeaningfulHash;

    const limitInfo = isAdmin ? ' [管理画面: 150回制限解除済み・無制限]' : `/${MAX_DAILY_WRITES}`;
    console.log(`[CloudSync] 💾 Firestore書き込み完了 [1回]: ドキュメント=kenchiko_world/${userDocId} (本日累計: ${getDailyWriteStats().count}${limitInfo})`);

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
      executeFirestoreWrite(nextData, config, true, true).catch(() => {});
    }
  }
}

export async function syncSaveDataToFirebase(
  data: GameSaveData,
  isImmediate = false,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  bypassDailyLimit: boolean = false
): Promise<{ success: boolean; error?: string }> {
  saveLocalBackup(data);
  latestPendingData = data;

  const isAdmin = bypassDailyLimit || isAdminSessionActive() || isDailyLimitDisabled();

  // ONLY explicit manual button clicks bypass debouncing (isImmediate = true)
  if (isImmediate) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    if (isWritingToFirestore) {
      queuedImmediateData = data;
      return { success: true };
    }
    return executeFirestoreWrite(data, config, true, bypassDailyLimit);
  }

  if (!isAdmin && getIsQuotaExhausted()) {
    return { success: true, error: 'Firebase無料枠上限のためローカル保持中' };
  }

  // If user disabled auto-sync and it's not a direct manual trigger
  if (!isCloudAutoSyncEnabled()) {
    return { success: true };
  }

  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  if (pendingWriteTimeout) {
    return { success: true };
  }

  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config, false, bypassDailyLimit).catch(() => {});
    }
  }, Math.max(5000, MIN_AUTO_SYNC_INTERVAL_MS - timeSinceLast));

  return { success: true };
}

// User-action-only and Exit-only save APIs
export async function saveOnUserAction(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
  bypassDailyLimit: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // Always update local storage first (instant, 0 latency, 0 data loss, 0 quota)
  saveLocalBackup(data);
  latestPendingData = data;

  // If user disabled cloud auto-sync, keep 100% local
  if (!isCloudAutoSyncEnabled() || getIsQuotaExhausted()) {
    return { success: true };
  }

  // Strictly block any auto-save when admin screen is open or admin session is active
  if (isAdminSessionActive() || (typeof window !== 'undefined' && (window.location.search.includes('admin') || window.location.search.includes('dev')))) {
    return { success: true };
  }

  // Check if meaningful changes exist before scheduling any cloud write
  const compact = extractUserProgress(data);
  const hash = getMeaningfulUserProgressHash(compact);
  if (lastWrittenContentString && hash === lastWrittenContentString) {
    return { success: true }; // Skip scheduling cloud write completely
  }

  // Debounce consecutive user actions (minimum 120s cooldown)
  const now = Date.now();
  const timeSinceLast = now - lastSuccessfulWriteTime;

  if (timeSinceLast >= MIN_AUTO_SYNC_INTERVAL_MS && !isWritingToFirestore) {
    if (pendingWriteTimeout) {
      clearTimeout(pendingWriteTimeout);
      pendingWriteTimeout = null;
    }
    return executeFirestoreWrite(data, config, false, bypassDailyLimit);
  }

  if (pendingWriteTimeout) {
    return { success: true };
  }

  pendingWriteTimeout = setTimeout(() => {
    pendingWriteTimeout = null;
    if (latestPendingData) {
      executeFirestoreWrite(latestPendingData, config, false, bypassDailyLimit).catch(() => {});
    }
  }, Math.max(5000, MIN_AUTO_SYNC_INTERVAL_MS - timeSinceLast));

  return { success: true };
}

export async function saveOnAppExit(
  data?: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<void> {
  const dataToSave = data || latestPendingData;
  if (!dataToSave) return;
  // Always synchronously protect in local storage (0 latency, 0 network quota)
  saveLocalBackup(dataToSave);

  if (!isCloudAutoSyncEnabled() || getIsQuotaExhausted()) return;

  // Only perform a cloud write if genuine milestone progress changed!
  const compact = extractUserProgress(dataToSave);
  const hash = getMeaningfulUserProgressHash(compact);
  if (lastWrittenContentString && hash === lastWrittenContentString) {
    return; // Completely skip cloud write!
  }

  executeFirestoreWrite(dataToSave, config, false, false).catch(() => {});
}

/**
 * Saves asobiList EXCLUSIVELY to the Global Master Firestore document (ken-chiko-global-state).
 * This completely isolates asobi management from individual user progress documents,
 * consuming exactly ONE single write operation for the entire batch.
 */
export async function saveGlobalAsobiList(
  asobiList: KenchikoAsobi[],
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const cleanList = sanitizeAsobiList(asobiList);

    // 1. Immediately update local storage backup so changes are never lost locally
    const currentLocal = loadLocalBackup() || DEFAULT_INITIAL_STATE;
    const updatedLocal: GameSaveData = {
      ...currentLocal,
      asobiList: cleanList,
      lastSaved: Date.now(),
    };
    saveLocalBackup(updatedLocal);

    // 2. Initialize Firestore if needed
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Firebase接続エラー' };
      }
    }
    if (!firestoreDb) {
      return { success: false, error: 'Firestoreが初期化されていません' };
    }

    // 3. Write ONLY to the global shared master document (ken-chiko-global-state)
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
    const globalPayload = removeUndefinedDeep({
      asobiList: cleanList,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(globalDocRef, globalPayload, { merge: true });
    sessionDbWriteCount++;
    incrementDailyWriteCount();
    notifyConnectionStatusChange(true);

    return { success: true, count: cleanList.length };
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota') || err?.status === 429) {
      markQuotaExhausted();
    }
    console.error('Failed to save global asobiList:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Saves ouenList & ouenCategories EXCLUSIVELY to the Global Master Firestore document (ken-chiko-global-state).
 */
export async function saveGlobalOuenList(
  ouenList: OuenItem[],
  ouenCategories: OuenCategory[] = INITIAL_OUEN_CATEGORIES,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // 1. Immediately update local storage backup so changes are never lost locally
    const currentLocal = loadLocalBackup() || DEFAULT_INITIAL_STATE;
    const updatedLocal: GameSaveData = {
      ...currentLocal,
      ouenList: ouenList,
      ouenCategories: ouenCategories,
      lastSaved: Date.now(),
    };
    saveLocalBackup(updatedLocal);

    // 2. Initialize Firestore if needed
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Firebase接続エラー' };
      }
    }
    if (!firestoreDb) {
      return { success: false, error: 'Firestoreが初期化されていません' };
    }

    // 3. Write ONLY to the global shared master document (ken-chiko-global-state)
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
    const globalPayload = removeUndefinedDeep({
      ouenList,
      ouenCategories,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(globalDocRef, globalPayload, { merge: true });
    sessionDbWriteCount++;
    incrementDailyWriteCount();
    notifyConnectionStatusChange(true);

    return { success: true, count: ouenList.length };
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota') || err?.status === 429) {
      markQuotaExhausted();
    }
    console.error('Failed to save global ouenList:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Fetches the global cheer message list (ouenList) and categories from Firestore (ken-chiko-global-state or ken-chiko-global-master).
 * Useful for restoring cheer messages if local state was reset or deleted.
 */
export async function fetchGlobalOuenList(
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; ouenList?: OuenItem[]; ouenCategories?: OuenCategory[]; error?: string }> {
  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Firebase接続エラー' };
      }
    }
    if (!firestoreDb) {
      return { success: false, error: 'Firestoreが初期化されていません' };
    }

    // Check ken-chiko-global-state first
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
    const snap = await getDoc(globalDocRef);
    sessionDbReadCount++;

    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.ouenList) && data.ouenList.length > 0) {
        return {
          success: true,
          ouenList: data.ouenList,
          ouenCategories: Array.isArray(data.ouenCategories) && data.ouenCategories.length > 0 ? data.ouenCategories : INITIAL_OUEN_CATEGORIES,
        };
      }
    }

    // Fallback: check ken-chiko-global-master
    const masterDocRef = doc(firestoreDb, 'kenchiko_world', 'ken-chiko-global-master');
    const masterSnap = await getDoc(masterDocRef);
    sessionDbReadCount++;

    if (masterSnap.exists()) {
      const mData = masterSnap.data();
      if (Array.isArray(mData.ouenList) && mData.ouenList.length > 0) {
        return {
          success: true,
          ouenList: mData.ouenList,
          ouenCategories: Array.isArray(mData.ouenCategories) && mData.ouenCategories.length > 0 ? mData.ouenCategories : INITIAL_OUEN_CATEGORIES,
        };
      }
    }

    return {
      success: true,
      ouenList: INITIAL_OUEN_LIST,
      ouenCategories: INITIAL_OUEN_CATEGORIES,
    };
  } catch (err: any) {
    console.error('Failed to fetch global ouenList:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Saves kounichan settings EXCLUSIVELY to the Global Master Firestore document (ken-chiko-global-state).
 * This ensures that vehicles, illustrations, speed, direction, and master switch are shared across all users and devices.
 */
export async function saveGlobalKounichanSettings(
  settings: import('../types/kounichan').KounichanSettings,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSettings = removeUndefinedDeep({
      ...DEFAULT_KOUNICHAN_SETTINGS,
      ...settings,
      vehicles: {
        ...DEFAULT_KOUNICHAN_SETTINGS.vehicles,
        ...(settings.vehicles || {}),
      },
      stats: {
        ...DEFAULT_KOUNICHAN_SETTINGS.stats,
        ...(settings.stats || {}),
      },
    });

    // 1. Immediately update local storage backup so changes are never lost locally
    const currentLocal = loadLocalBackup() || DEFAULT_INITIAL_STATE;
    const updatedLocal: GameSaveData = {
      ...currentLocal,
      kounichan: cleanSettings,
      lastSaved: Date.now(),
    };
    saveLocalBackup(updatedLocal);

    // 2. Initialize Firestore if needed
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Firebase接続エラー' };
      }
    }
    if (!firestoreDb) {
      return { success: false, error: 'Firestoreが初期化されていません' };
    }

    // 3. Write ONLY to the global shared master document (ken-chiko-global-state)
    const globalDocRef = doc(firestoreDb, 'kenchiko_world', GLOBAL_SHARED_DOC_ID);
    const globalPayload = removeUndefinedDeep({
      kounichan: cleanSettings,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(globalDocRef, globalPayload, { merge: true });
    sessionDbWriteCount++;
    incrementDailyWriteCount();
    notifyConnectionStatusChange(true);

    return { success: true };
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota') || err?.status === 429) {
      markQuotaExhausted();
    }
    console.error('Failed to save global kounichan settings:', err);
    return { success: false, error: err?.message || String(err) };
  }
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
