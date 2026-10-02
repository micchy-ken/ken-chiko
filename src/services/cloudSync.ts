/**
 * cloudSync: Cloud synchronization service for Kenchiko World.
 * Exclusively uses Synology NAS PostgreSQL (via PostgREST) and LocalStorage.
 * Completely free of Firebase dependencies.
 */

import {
  GameSaveData,
  NyanCharacter,
  MasterNyanCharacter,
  GiftItem,
  DiaryEntry,
  KenchikoAsobi,
  KenchikoState,
  OuenCategory,
  OuenItem,
} from '../types';
import { UserRewardState, RewardTicket, GaraponHistoryEntry } from '../types/rewards';
import { createInitialRewardState } from './rewardService';
import { DEFAULT_INITIAL_STATE } from './storage';
import { DEFAULT_KOUNICHAN_SETTINGS } from '../types/kounichan';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST, mergeOuenCategories, mergeOuenList } from '../data/defaultOuen';
import { getActiveUserId, DEFAULT_GLOBAL_DOC_ID, getLocalStorageKeyForUser, USER_LOCAL_KEY_PREFIX } from './userService';
import { loadLocalKenchikoImage, saveLocalKenchikoImage } from './imageCompression';
import {
  cleanseMasterCharacters,
  extractProgressMap,
  composeCharacters,
  mergeUserProgressSafely,
} from '../utils/dataSeparation';
import {
  fetchFullMasterDataFromPostgrest,
  saveMasterAsobiToPostgrest,
  saveMasterOuenToPostgrest,
  saveMasterSettingsToPostgrest,
  saveSingleMasterAsobiToPostgrest,
  deleteSingleMasterAsobiFromPostgrest,
  saveSingleMasterOuenItemToPostgrest,
  deleteSingleMasterOuenItemFromPostgrest,
  saveSingleMasterOuenCategoryToPostgrest,
  deleteSingleMasterOuenCategoryFromPostgrest,
  saveSingleMasterNyanToPostgrest,
  deleteSingleMasterNyanFromPostgrest,
} from './postgrestMasterService';
import {
  fetchUserSaveFromPostgrest,
  saveUserSaveToPostgrest,
  deleteUserFromPostgrest,
} from './postgrestUserService';
import { getPostgrestBaseUrl, isPostgrestEnabled } from './postgrestConfig';
import { recordAuditLog } from './firestoreTrafficLogger';

// Re-export single-row master functions for direct component usage
export {
  saveSingleMasterAsobiToPostgrest,
  deleteSingleMasterAsobiFromPostgrest,
  saveSingleMasterOuenItemToPostgrest,
  deleteSingleMasterOuenItemFromPostgrest,
  saveSingleMasterOuenCategoryToPostgrest,
  deleteSingleMasterOuenCategoryFromPostgrest,
  saveSingleMasterNyanToPostgrest,
  deleteSingleMasterNyanFromPostgrest,
};

export const GLOBAL_SHARED_DOC_ID = DEFAULT_GLOBAL_DOC_ID;
export const MAX_DAILY_WRITES = 999999; // Unlimited on Synology PostgreSQL

export interface CloudCustomConfig {
  baseUrl?: string;
  authToken?: string;
  apiKey?: string;
  projectId?: string;
  appId?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

// Backward-compatibility interface
export type FirebaseCustomConfig = CloudCustomConfig;

export interface NyanProgressEntry {
  discovered?: boolean;
  discoveryDate?: string;
  lastMetAt?: number;
  friendshipLevel?: number;
  playCount?: number;
}

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
  hintLocation?: string | null;
}

export interface UserProgressDoc {
  version: number;
  kenchiko: KenchikoSyncState;
  nyanProgress: Record<number, NyanProgressEntry>;
  inventory: GiftItem[];
  diary: DiaryEntry[];
  asobiList?: KenchikoAsobi[];
  ouenList?: OuenItem[];
  ouenCategories?: OuenCategory[];
  rewards?: UserRewardState;
  stats?: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  lastSaved: number;
  userId?: string;
}

export interface DailyWriteStats {
  count: number;
  max: number;
  date: string;
  remaining: number;
  isLimitReached: boolean;
  isDisabled: boolean;
}

export type MasterFetchStatus = 'idle' | 'fetching' | 'synced' | 'failed' | 'fallback_local';

export interface CloudConnectionStatus {
  isConnected: boolean;
  isOffline: boolean;
  lastError: string | null;
  lastSyncTime: number | null;
  docId: string;
  isInitialConnection?: boolean;
  dailyWriteCount: number;
  isDailyLimitDisabled: boolean;
  isAutoSyncEnabled: boolean;
  isQuotaExhausted: boolean;
  masterStatus?: MasterFetchStatus;
  masterErrorDetail?: string;
}

// Backward compatibility alias
export type FirebaseConnectionStatus = CloudConnectionStatus;

export interface CloudAccessStats {
  sessionReads: number;
  sessionWrites: number;
  readLogs: Array<{ path: string; time: number }>;
  writeLogs: Array<{ path: string; time: number }>;
}

export type FirebaseAccessStats = CloudAccessStats;

export interface InitialStateFetchResult {
  success: boolean;
  data: GameSaveData;
  state: GameSaveData;
  masterChanged: boolean;
  masterStatus: MasterFetchStatus;
  masterVersion?: number;
  isNewUser: boolean;
  isOffline: boolean;
  masterErrorDetail?: string;
  error?: string;
  connectionMessage?: string;
}

/**
 * Remove undefined values deeply
 */
export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = removeUndefinedDeep(value);
    }
  }
  return result as T;
}

/**
 * Extracts purely user progress into a UserProgressDoc
 */
export function extractUserProgress(data: GameSaveData): UserProgressDoc {
  const nyanProgress: Record<number, NyanProgressEntry> = {};

  if (Array.isArray(data.characters)) {
    for (const char of data.characters) {
      if (char.discovered || char.friendshipLevel || char.playCount || char.discoveryDate) {
        nyanProgress[char.no] = {
          discovered: Boolean(char.discovered),
          discoveryDate: char.discoveryDate,
          lastMetAt: char.lastMetAt,
          friendshipLevel: char.friendshipLevel || 0,
          playCount: char.playCount || 0,
        };
      }
    }
  }

  const kenchikoSync: KenchikoSyncState = {
    currentLocation: data.kenchiko.currentLocation,
    targetLocation: data.kenchiko.targetLocation || null,
    transportMethod: data.kenchiko.transportMethod || null,
    currentActivity: data.kenchiko.currentActivity,
    currentActivityTitle: data.kenchiko.currentActivityTitle,
    activityStartedAt: data.kenchiko.activityStartedAt,
    activityDurationSec: data.kenchiko.activityDurationSec,
    currentCompanionNyanId: data.kenchiko.currentCompanionNyanId ?? null,
    monologue: data.kenchiko.monologue || '',
    equippedItem: data.kenchiko.equippedItem || null,
    totalPlayTimeSec: data.kenchiko.totalPlayTimeSec || 0,
    hintLocation: data.kenchiko.hintLocation || null,
  };

  return {
    version: data.version || 1,
    kenchiko: kenchikoSync,
    nyanProgress,
    inventory: data.inventory || [],
    diary: deduplicateDiary(data.diary || []),
    rewards: data.rewards || createInitialRewardState(),
    stats: data.stats || {
      totalEncounters: 0,
      totalSnacksEaten: 0,
      totalNapMinutes: 0,
      totalTrips: 0,
    },
    lastSaved: Date.now(),
    userId: getActiveUserId() || 'default',
  };
}

export function deduplicateDiary(diary: DiaryEntry[]): DiaryEntry[] {
  if (!Array.isArray(diary)) return [];
  const seen = new Set<string>();
  const unique: DiaryEntry[] = [];
  for (const d of diary) {
    if (!d || !d.id) continue;
    if (!seen.has(d.id)) {
      seen.add(d.id);
      unique.push(d);
    }
  }
  return unique;
}

export function mergeRewardStates(
  localRewards?: UserRewardState,
  remoteRewards?: UserRewardState
): UserRewardState {
  if (!localRewards && !remoteRewards) return createInitialRewardState();
  if (!remoteRewards) return localRewards || createInitialRewardState();
  if (!localRewards) return remoteRewards;

  const mergedPoints = Math.max(localRewards.points || 0, remoteRewards.points || 0);
  const mergedLifetime = Math.max(localRewards.lifetimePoints || 0, remoteRewards.lifetimePoints || 0);

  const ticketMap = new Map<string, RewardTicket>();
  for (const t of [...(localRewards.tickets || []), ...(remoteRewards.tickets || [])]) {
    if (!ticketMap.has(t.id)) {
      ticketMap.set(t.id, t);
    } else {
      const existing = ticketMap.get(t.id)!;
      if (t.isUsed || existing.isUsed) {
        ticketMap.set(t.id, { ...existing, isUsed: true, usedAt: t.usedAt || existing.usedAt });
      }
    }
  }

  const historyMap = new Map<string, GaraponHistoryEntry>();
  for (const g of [...(localRewards.history || []), ...(remoteRewards.history || [])]) {
    if (!historyMap.has(g.id)) {
      historyMap.set(g.id, g);
    }
  }

  const readStoryIds = Array.from(
    new Set([...(localRewards.readStoryIds || []), ...(remoteRewards.readStoryIds || [])])
  );

  return {
    points: mergedPoints,
    lifetimePoints: mergedLifetime,
    hasClaimedInitialDiscoveryBonus: localRewards.hasClaimedInitialDiscoveryBonus || remoteRewards.hasClaimedInitialDiscoveryBonus || false,
    initialBonusAmount: Math.max(localRewards.initialBonusAmount || 0, remoteRewards.initialBonusAmount || 0),
    lastPettedDate: remoteRewards.lastPettedDate || localRewards.lastPettedDate,
    readStoryIds,
    tickets: Array.from(ticketMap.values()).sort((a, b) => b.obtainedAt - a.obtainedAt),
    history: Array.from(historyMap.values()).sort((a, b) => b.timestamp - a.timestamp),
    lastUpdated: Math.max(localRewards.lastUpdated || 0, remoteRewards.lastUpdated || 0),
  };
}

export function mergeDiaryEntriesSafely(localDiary: DiaryEntry[], remoteDiary: DiaryEntry[]): DiaryEntry[] {
  return deduplicateDiary([...(remoteDiary || []), ...(localDiary || [])]);
}

export function reconstructGameSaveData(
  userDocOrData: any,
  masterNyans: MasterNyanCharacter[] | NyanCharacter[]
): GameSaveData {
  const pureMaster = cleanseMasterCharacters(masterNyans || INITIAL_NYANS);
  const progressMap = extractProgressMap(userDocOrData?.nyanProgress || userDocOrData?.characters);
  const mergedCharacters = composeCharacters(pureMaster, progressMap);

  const kenchikoState: KenchikoState = {
    currentLocation: userDocOrData?.kenchiko?.currentLocation || DEFAULT_INITIAL_STATE.kenchiko.currentLocation,
    targetLocation: userDocOrData?.kenchiko?.targetLocation || null,
    transportMethod: userDocOrData?.kenchiko?.transportMethod || null,
    currentActivity: userDocOrData?.kenchiko?.currentActivity || DEFAULT_INITIAL_STATE.kenchiko.currentActivity,
    currentActivityTitle: userDocOrData?.kenchiko?.currentActivityTitle || DEFAULT_INITIAL_STATE.kenchiko.currentActivityTitle,
    activityStartedAt: userDocOrData?.kenchiko?.activityStartedAt || Date.now(),
    activityDurationSec: userDocOrData?.kenchiko?.activityDurationSec || DEFAULT_INITIAL_STATE.kenchiko.activityDurationSec,
    currentCompanionNyanId: userDocOrData?.kenchiko?.currentCompanionNyanId ?? null,
    customImageUrl: userDocOrData?.kenchiko?.customImageUrl || loadLocalKenchikoImage() || undefined,
    monologue: userDocOrData?.kenchiko?.monologue || DEFAULT_INITIAL_STATE.kenchiko.monologue,
    equippedItem: userDocOrData?.kenchiko?.equippedItem || null,
    totalPlayTimeSec: userDocOrData?.kenchiko?.totalPlayTimeSec || 0,
    hintLocation: userDocOrData?.kenchiko?.hintLocation || null,
  };

  const inventory = Array.isArray(userDocOrData?.inventory) ? userDocOrData.inventory : DEFAULT_INITIAL_STATE.inventory;
  const diary = deduplicateDiary(userDocOrData?.diary || DEFAULT_INITIAL_STATE.diary);
  const rewards = mergeRewardStates(DEFAULT_INITIAL_STATE.rewards, userDocOrData?.rewards);
  const stats = userDocOrData?.stats || DEFAULT_INITIAL_STATE.stats;

  return {
    version: userDocOrData?.version || 1,
    kenchiko: kenchikoState,
    characters: mergedCharacters,
    inventory,
    diary,
    asobiList: userDocOrData?.asobiList || INITIAL_ASOBI_LIST,
    ouenCategories: userDocOrData?.ouenCategories || INITIAL_OUEN_CATEGORIES,
    ouenList: userDocOrData?.ouenList || INITIAL_OUEN_LIST,
    rewards,
    kounichan: userDocOrData?.kounichan || DEFAULT_KOUNICHAN_SETTINGS,
    stats,
    lastSaved: userDocOrData?.lastSaved || Date.now(),
    githubRepo: '',
    autoSyncGithub: false,
  };
}

export function mergeCharactersWithDefaults(
  currentNyans: NyanCharacter[],
  defaultNyans: MasterNyanCharacter[] = INITIAL_NYANS
): NyanCharacter[] {
  const pureMaster = cleanseMasterCharacters(defaultNyans);
  const progressMap = extractProgressMap(currentNyans);
  return composeCharacters(pureMaster, progressMap);
}

export function sanitizeAsobiList(list?: KenchikoAsobi[]): KenchikoAsobi[] {
  if (!Array.isArray(list) || list.length === 0) return INITIAL_ASOBI_LIST;
  return list;
}

export function mergeAsobiLists(
  currentList: KenchikoAsobi[] = [],
  defaultList: KenchikoAsobi[] = INITIAL_ASOBI_LIST
): KenchikoAsobi[] {
  const map = new Map<string, KenchikoAsobi>();
  for (const item of defaultList) {
    map.set(item.id, item);
  }
  for (const item of currentList) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function getEnvFirebaseConfig(): FirebaseCustomConfig {
  return { baseUrl: getPostgrestBaseUrl() };
}

export function loadSavedFirebaseConfig(): FirebaseCustomConfig {
  return { baseUrl: getPostgrestBaseUrl() };
}

export function saveFirebaseConfig(_config: FirebaseCustomConfig): void {}

export function isDailyLimitDisabled(): boolean {
  return true;
}

export function setDailyLimitDisabled(_disabled: boolean): void {}

export function isAdminSessionActive(): boolean {
  return true;
}

export function resetDailyWriteCount(): void {}

export function getDailyWriteStats(): DailyWriteStats {
  return {
    count: 0,
    max: 999999,
    date: new Date().toISOString().slice(0, 10),
    remaining: 999999,
    isLimitReached: false,
    isDisabled: true,
  };
}

export function incrementDailyWriteCount(): number {
  return 0;
}

export function isCloudAutoSyncEnabled(): boolean {
  return true;
}

export function setCloudAutoSyncEnabled(_enabled: boolean): void {}

export function markQuotaExhausted(_durationMs: number = 0): void {}

export function clearQuotaExhausted(): void {}

let connectionStatus: CloudConnectionStatus = {
  isConnected: true,
  isOffline: false,
  lastError: null,
  lastSyncTime: Date.now(),
  docId: 'synology-postgres',
  isInitialConnection: false,
  dailyWriteCount: 0,
  isDailyLimitDisabled: true,
  isAutoSyncEnabled: true,
  isQuotaExhausted: false,
  masterStatus: 'synced',
};

let statusListeners: Array<(status: CloudConnectionStatus) => void> = [];

export function getFirebaseConnectionStatus(): CloudConnectionStatus {
  return { ...connectionStatus };
}

export function getCloudConnectionStatus(): CloudConnectionStatus {
  return { ...connectionStatus };
}

export function endInitialConnectionPhase(): void {
  connectionStatus.isInitialConnection = false;
  notifyStatusChange();
}

export function subscribeFirebaseConnectionStatus(
  callback: (status: CloudConnectionStatus) => void
): () => void {
  statusListeners.push(callback);
  callback(getCloudConnectionStatus());
  return () => {
    statusListeners = statusListeners.filter((l) => l !== callback);
  };
}

export function subscribeCloudConnectionStatus(
  callback: (status: CloudConnectionStatus) => void
): () => void {
  return subscribeFirebaseConnectionStatus(callback);
}

function notifyStatusChange(): void {
  const current = getCloudConnectionStatus();
  for (const listener of statusListeners) {
    try {
      listener(current);
    } catch {}
  }
}

export function setQuotaStatusCallback(_cb: (exhausted: boolean) => void) {}

export function getIsQuotaExhausted(): boolean {
  return false;
}

export function initFirebase(_config?: FirebaseCustomConfig): {
  app: any;
  db: any;
  docId: string;
} {
  return {
    app: null,
    db: null,
    docId: 'synology-postgres',
  };
}

export function getFirestoreDbInstance(): any {
  return null;
}

export async function writeUserDocExplicit(userId: string, data: GameSaveData): Promise<boolean> {
  const res = await saveUserSaveToPostgrest(userId, data);
  return res.success;
}

export async function deleteUserDocExplicit(userId: string): Promise<boolean> {
  const res = await deleteUserFromPostgrest(userId);
  return res.success;
}

export async function testFirebaseConnection(
  _config?: FirebaseCustomConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getPostgrestBaseUrl()}/master_settings?limit=1`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Synology接続エラー' };
  }
}

export async function testCloudConnection(): Promise<{ success: boolean; error?: string }> {
  return testFirebaseConnection();
}

export function subscribeToRemoteChanges(_onRemoteUpdate: any): () => void {
  return () => {};
}

export function saveLocalBackup(data: GameSaveData, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getLocalStorageKeyForUser(userId || getActiveUserId());
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function loadLocalBackup(userId?: string | null): GameSaveData | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getLocalStorageKeyForUser(userId || getActiveUserId());
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resetUserData(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getLocalStorageKeyForUser(userId || getActiveUserId());
    localStorage.removeItem(key);
  } catch {}
}

export function purgeLocalData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('kenchiko_save_state_backup_v2');
  } catch {}
}

export async function fetchInitialFirebaseState(
  _config?: FirebaseCustomConfig,
  _isManualRetry?: boolean
): Promise<InitialStateFetchResult> {
  return fetchInitialCloudState(_config, _isManualRetry);
}

export async function fetchInitialCloudState(
  _config?: CloudCustomConfig,
  _isManualRetry?: boolean
): Promise<InitialStateFetchResult> {
  const activeUid = getActiveUserId();
  const localBackup = loadLocalBackup(activeUid);

  try {
    // 1. Fetch official Master Data from Synology PostgreSQL
    const masterData = await fetchFullMasterDataFromPostgrest();
    const pureMasterNyans = cleanseMasterCharacters(masterData?.characters || INITIAL_NYANS);

    // 2. Fetch User Save Data from Synology PostgreSQL
    let userRaw: any = null;
    if (activeUid) {
      const pgUser = await fetchUserSaveFromPostgrest(activeUid);
      if (pgUser) {
        userRaw = {
          version: pgUser.version,
          stats: pgUser.stats,
          inventory: pgUser.inventory,
          rewards: pgUser.rewards,
          nyanProgress: pgUser.nyan_progress,
          diary: pgUser.diary,
          ...(pgUser.raw_save || {}),
        };
      }
    }

    const baseData = userRaw || localBackup || DEFAULT_INITIAL_STATE;
    const reconstructed = reconstructGameSaveData(baseData, pureMasterNyans);

    // Inject shared master data (asobi, ouen, kounichan)
    if (masterData) {
      if (masterData.asobiList && masterData.asobiList.length > 0) {
        reconstructed.asobiList = masterData.asobiList;
      }
      if (masterData.ouenList && masterData.ouenList.length > 0) {
        reconstructed.ouenList = masterData.ouenList;
      }
      if (masterData.ouenCategories && masterData.ouenCategories.length > 0) {
        reconstructed.ouenCategories = masterData.ouenCategories;
      }
      if (masterData.kounichan) {
        reconstructed.kounichan = masterData.kounichan;
      }
    }

    saveLocalBackup(reconstructed, activeUid);

    connectionStatus.isConnected = true;
    connectionStatus.isOffline = false;
    connectionStatus.masterStatus = 'synced';
    connectionStatus.lastSyncTime = Date.now();
    notifyStatusChange();

    return {
      success: true,
      data: reconstructed,
      state: reconstructed,
      masterChanged: false,
      masterStatus: 'synced',
      masterVersion: masterData?.version || 1,
      isNewUser: !userRaw && !localBackup,
      isOffline: false,
      connectionMessage: 'Synology PostgreSQL クラウド同期完了',
    };
  } catch (err: any) {
    console.warn('[SynologySync] Initial state fetch fallback to local:', err);
    const fallback = localBackup || DEFAULT_INITIAL_STATE;
    connectionStatus.isConnected = false;
    connectionStatus.isOffline = true;
    connectionStatus.masterStatus = 'fallback_local';
    connectionStatus.lastError = err?.message;
    notifyStatusChange();

    return {
      success: false,
      data: fallback,
      state: fallback,
      masterChanged: false,
      masterStatus: 'fallback_local',
      isNewUser: !localBackup,
      isOffline: true,
      masterErrorDetail: err?.message,
      error: err?.message,
      connectionMessage: 'オフライン（端末ローカルで動作中）',
    };
  }
}

export function updateLastWrittenHash(_hash: string): void {}

export function recordFirestoreWrite(_docName: string, _count: number = 1): void {
  recordAuditLog('WRITE', 'SynologySync', 'synology_pg');
}

export function recordFirestoreRead(_docName: string, _count: number = 1): void {
  recordAuditLog('READ', 'SynologySync', 'synology_pg');
}

export function getFirebaseAccessStats(): CloudAccessStats {
  return {
    sessionReads: 0,
    sessionWrites: 0,
    readLogs: [],
    writeLogs: [],
  };
}

export function resetFirebaseAccessStats(): void {}

export function getMeaningfulUserProgressHash(doc: UserProgressDoc): string {
  try {
    return JSON.stringify({
      v: doc.version,
      np: doc.nyanProgress,
      k: {
        loc: doc.kenchiko.currentLocation,
        act: doc.kenchiko.currentActivityTitle,
        comp: doc.kenchiko.currentCompanionNyanId,
      },
      invCount: doc.inventory?.length || 0,
      diaryCount: doc.diary?.length || 0,
    });
  } catch {
    return String(Date.now());
  }
}

export async function executeFirestoreWrite(
  _dataToSync: GameSaveData,
  _activeConfig?: FirebaseCustomConfig,
  _options?: any
): Promise<{ success: boolean; error?: string }> {
  return syncSaveDataToCloud(_dataToSync);
}

export async function syncSaveDataToFirebase(
  dataToSync: GameSaveData,
  _isImmediate: boolean = false,
  _customConfig?: FirebaseCustomConfig
): Promise<{ success: boolean; error?: string; timestamp?: number }> {
  return syncSaveDataToCloud(dataToSync, _isImmediate, _customConfig);
}

export async function syncSaveDataToCloud(
  dataToSync: GameSaveData,
  _isImmediate: boolean = false,
  _customConfig?: CloudCustomConfig
): Promise<{ success: boolean; error?: string; timestamp?: number }> {
  const activeUid = getActiveUserId() || 'default';
  saveLocalBackup(dataToSync, activeUid);

  try {
    const res = await saveUserSaveToPostgrest(activeUid, dataToSync);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    recordAuditLog('WRITE', 'syncSaveDataToCloud', `user_saves/${activeUid}`);
    connectionStatus.lastSyncTime = Date.now();
    notifyStatusChange();
    return { success: true, timestamp: Date.now() };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Synology保存エラー' };
  }
}

export async function saveOnUserAction(
  saveData: GameSaveData,
  _activeConfig?: CloudCustomConfig | boolean
): Promise<void> {
  const activeUid = getActiveUserId() || 'default';
  saveLocalBackup(saveData, activeUid);
  await saveUserSaveToPostgrest(activeUid, saveData).catch((e) => {
    console.warn('[SynologySync] saveOnUserAction background notice:', e);
  });
}

export async function saveOnAppExit(
  saveData: GameSaveData,
  _activeConfig?: CloudCustomConfig | boolean
): Promise<void> {
  const activeUid = getActiveUserId() || 'default';
  saveLocalBackup(saveData, activeUid);
  await saveUserSaveToPostgrest(activeUid, saveData).catch(() => {});
}

export async function saveGlobalAsobiList(
  asobiList: KenchikoAsobi[]
): Promise<{ success: boolean; error?: string }> {
  return saveMasterAsobiToPostgrest(asobiList);
}

export async function saveGlobalOuenList(
  arg1: OuenItem[] | OuenCategory[],
  arg2?: OuenCategory[] | OuenItem[]
): Promise<{ success: boolean; error?: string }> {
  let items: OuenItem[] = [];
  let categories: OuenCategory[] = [];

  if (Array.isArray(arg1) && arg1.length > 0 && 'message' in (arg1[0] as any)) {
    items = arg1 as OuenItem[];
    categories = (arg2 as OuenCategory[]) || [];
  } else if (Array.isArray(arg1) && arg1.length > 0 && 'label' in (arg1[0] as any)) {
    categories = arg1 as OuenCategory[];
    items = (arg2 as OuenItem[]) || [];
  } else if (Array.isArray(arg2) && arg2.length > 0 && 'message' in (arg2[0] as any)) {
    items = arg2 as OuenItem[];
    categories = (arg1 as OuenCategory[]) || [];
  } else {
    items = (arg1 as any[]) || [];
    categories = (arg2 as any[]) || [];
  }

  return saveMasterOuenToPostgrest(categories, items);
}

export async function fetchGlobalOuenList(): Promise<{
  success: boolean;
  ouenList: OuenItem[];
  ouenCategories: OuenCategory[];
  categories: OuenCategory[];
  items: OuenItem[];
  error?: string;
}> {
  const master = await fetchFullMasterDataFromPostgrest();
  if (!master) {
    return {
      success: false,
      ouenList: INITIAL_OUEN_LIST,
      ouenCategories: INITIAL_OUEN_CATEGORIES,
      categories: INITIAL_OUEN_CATEGORIES,
      items: INITIAL_OUEN_LIST,
      error: '取得できませんでした',
    };
  }
  const cats = master.ouenCategories || INITIAL_OUEN_CATEGORIES;
  const items = master.ouenList || INITIAL_OUEN_LIST;
  return {
    success: true,
    ouenList: items,
    ouenCategories: cats,
    categories: cats,
    items: items,
  };
}

export async function saveGlobalKounichanSettings(
  settings: any
): Promise<{ success: boolean; error?: string }> {
  return saveMasterSettingsToPostgrest({ kounichan_settings: settings });
}

export function subscribeToFirebaseState(_onUpdate: any): () => void {
  return () => {};
}

export function subscribeToCloudState(_onUpdate: any): () => void {
  return () => {};
}
