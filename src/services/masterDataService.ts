import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NyanCharacter, GameMasterData } from '../types';
import { DEFAULT_MASTER_DATA } from './storage';
import { getFirestoreDbInstance, initFirebase } from './firebaseSync';

export interface KenchikoMasterMeta {
  version: number;
  updatedAt: number;
  nyanCount: number;
  lastUpdatedNote?: string;
}

export interface KenchikoMasterNyansDoc {
  version: number;
  updatedAt: number;
  nyans: NyanCharacter[];
}

export const MASTER_META_DOC_ID = 'ken-chiko-master-meta';
export const MASTER_NYANS_DOC_ID = 'ken-chiko-master-nyans';
export const GLOBAL_MASTER_DOC_ID = 'ken-chiko-global-master';
export const FIRESTORE_COLLECTION = 'kenchiko_world';

const CACHED_MASTER_VERSION_KEY = 'kenchiko_cached_master_version_v1';
const CACHED_MASTER_NYANS_KEY = 'kenchiko_cached_master_nyans_v1';
const LOCAL_GLOBAL_MASTER_KEY = 'kenchiko_global_master_data_v1';

/**
 * Remove undefined properties deeply for Firestore compatibility
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
}

/**
 * Load local master data (draft or cached)
 */
export function loadLocalMasterData(): GameMasterData {
  try {
    const raw = localStorage.getItem(LOCAL_GLOBAL_MASTER_KEY);
    if (!raw) return DEFAULT_MASTER_DATA;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MASTER_DATA,
      ...parsed,
      characters: Array.isArray(parsed.characters) && parsed.characters.length > 0 ? parsed.characters : DEFAULT_MASTER_DATA.characters,
      asobiList: Array.isArray(parsed.asobiList) ? parsed.asobiList : DEFAULT_MASTER_DATA.asobiList,
      ouenCategories: Array.isArray(parsed.ouenCategories) ? parsed.ouenCategories : DEFAULT_MASTER_DATA.ouenCategories,
      ouenList: Array.isArray(parsed.ouenList) ? parsed.ouenList : DEFAULT_MASTER_DATA.ouenList,
      kounichan: parsed.kounichan || DEFAULT_MASTER_DATA.kounichan,
    };
  } catch {
    return DEFAULT_MASTER_DATA;
  }
}

/**
 * Save local master data (pure local draft; 0 network calls)
 */
export function saveLocalMasterData(master: GameMasterData): void {
  try {
    localStorage.setItem(LOCAL_GLOBAL_MASTER_KEY, JSON.stringify(master));
  } catch (err) {
    console.warn('saveLocalMasterData error:', err);
  }
}

/**
 * Get locally stored master version
 */
export function getCachedMasterVersion(): number {
  try {
    const raw = localStorage.getItem(CACHED_MASTER_VERSION_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Store current master version locally
 */
export function setCachedMasterVersion(version: number): void {
  try {
    localStorage.setItem(CACHED_MASTER_VERSION_KEY, String(version));
  } catch {}
}

/**
 * Get locally cached master nyans
 */
export function getCachedMasterNyans(): NyanCharacter[] | null {
  try {
    const raw = localStorage.getItem(CACHED_MASTER_NYANS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Save master nyans to local cache
 */
export function setCachedMasterNyans(nyans: NyanCharacter[]): void {
  try {
    // Only keep non-heavy master metadata in local storage
    const lightMaster: NyanCharacter[] = nyans.map((n) => ({
      no: n.no,
      name: n.name,
      reading: n.reading,
      motif: n.motif,
      firstAppeared: n.firstAppeared || '',
      episode: n.episode || '',
      promptJa: n.promptJa || '',
      promptEn: n.promptEn || '',
      dialogue: n.dialogue,
      dialogueMeaning: n.dialogueMeaning,
      discovered: false,
      playCount: 0,
      friendshipLevel: 1,
      customImageUrl: n.customImageUrl,
      rawImageUrl: n.rawImageUrl,
      transparency: n.transparency,
      favoriteItems: n.favoriteItems,
      favoriteLocations: n.favoriteLocations,
    }));
    localStorage.setItem(CACHED_MASTER_NYANS_KEY, JSON.stringify(lightMaster));
  } catch {}
}

/**
 * Fetches the complete global master data from Firestore (1 Read operation).
 */
export async function fetchGlobalMasterData(): Promise<GameMasterData | null> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) return null;

    const masterDocRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_MASTER_DOC_ID);
    const snap = await getDoc(masterDocRef);
    if (!snap.exists()) {
      // Fallback: try fetching legacy master nyans doc
      const legacyNyans = await fetchMasterNyans();
      if (legacyNyans) {
        return {
          ...DEFAULT_MASTER_DATA,
          version: legacyNyans.version,
          characters: legacyNyans.nyans,
          lastUpdated: Date.now(),
        };
      }
      return null;
    }

    const data = snap.data();
    return {
      version: data.version || 1,
      characters: Array.isArray(data.characters) ? data.characters : DEFAULT_MASTER_DATA.characters,
      asobiList: Array.isArray(data.asobiList) ? data.asobiList : DEFAULT_MASTER_DATA.asobiList,
      ouenCategories: Array.isArray(data.ouenCategories) ? data.ouenCategories : DEFAULT_MASTER_DATA.ouenCategories,
      ouenList: Array.isArray(data.ouenList) ? data.ouenList : DEFAULT_MASTER_DATA.ouenList,
      kounichan: data.kounichan || DEFAULT_MASTER_DATA.kounichan,
      kihonNyanCustomImageUrl: data.kihonNyanCustomImageUrl,
      googleDriveFolderUrl: data.googleDriveFolderUrl,
      lastUpdated: data.lastUpdated || Date.now(),
    };
  } catch (err) {
    console.warn('fetchGlobalMasterData warning:', err);
    return null;
  }
}

/**
 * Administrator action: Publish the entire GameMasterData to Firestore in a single atomic batch.
 * Exactly 2-3 document writes. 0 background intervals.
 */
export async function publishGlobalMasterData(
  master: GameMasterData,
  note?: string
): Promise<{ success: boolean; version?: number; error?: string }> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    const currentMeta = await fetchMasterMeta();
    const nextVersion = (currentMeta?.version || master.version || 0) + 1;
    const now = Date.now();

    const cleanCharacters: NyanCharacter[] = master.characters.map((n) => ({
      no: n.no,
      name: n.name || `にゃんこ #${n.no}`,
      reading: n.reading || '',
      motif: n.motif || '',
      firstAppeared: n.firstAppeared || '',
      episode: n.episode || '',
      promptJa: n.promptJa || '',
      promptEn: n.promptEn || '',
      dialogue: n.dialogue,
      dialogueMeaning: n.dialogueMeaning,
      discovered: false,
      discoveryDate: undefined,
      friendshipLevel: 1,
      playCount: 0,
      lastMetAt: 0,
      customImageUrl: n.customImageUrl || undefined,
      rawImageUrl: n.rawImageUrl || undefined,
      transparency: n.transparency || undefined,
      favoriteItems: n.favoriteItems,
      favoriteLocations: n.favoriteLocations,
    }));

    const globalMasterPayload = {
      version: nextVersion,
      characters: cleanCharacters,
      asobiList: master.asobiList || [],
      ouenCategories: master.ouenCategories || [],
      ouenList: master.ouenList || [],
      kounichan: master.kounichan,
      kihonNyanCustomImageUrl: master.kihonNyanCustomImageUrl || null,
      googleDriveFolderUrl: master.googleDriveFolderUrl || null,
      lastUpdated: now,
      note: note || `管理画面より一括マスター公開 (${cleanCharacters.length}体)`,
    };

    // 1. Write consolidated global master document
    const masterDocRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_MASTER_DOC_ID);
    await setDoc(masterDocRef, sanitizeForFirestore(globalMasterPayload));

    // 2. Write master nyans doc (for backward compatibility)
    const nyansRef = doc(db, FIRESTORE_COLLECTION, MASTER_NYANS_DOC_ID);
    await setDoc(
      nyansRef,
      sanitizeForFirestore({
        version: nextVersion,
        updatedAt: now,
        nyans: cleanCharacters,
      })
    );

    // 3. Write metadata document
    const metaRef = doc(db, FIRESTORE_COLLECTION, MASTER_META_DOC_ID);
    const metaPayload: KenchikoMasterMeta = {
      version: nextVersion,
      updatedAt: now,
      nyanCount: cleanCharacters.length,
      lastUpdatedNote: note || `管理画面より公開 (${cleanCharacters.length}匹)`,
    };
    await setDoc(metaRef, sanitizeForFirestore(metaPayload));

    // Update local caches
    const updatedMaster: GameMasterData = {
      ...master,
      version: nextVersion,
      characters: cleanCharacters,
      lastUpdated: now,
    };
    saveLocalMasterData(updatedMaster);
    setCachedMasterVersion(nextVersion);
    setCachedMasterNyans(cleanCharacters);

    return {
      success: true,
      version: nextVersion,
    };
  } catch (err: any) {
    console.error('publishGlobalMasterData error:', err);
    return {
      success: false,
      error: err.message || 'マスターデータの公開中にエラーが発生しました',
    };
  }
}

/**
 * Fetches the lightweight master metadata document from Firestore (1 Read operation).
 */
export async function fetchMasterMeta(): Promise<KenchikoMasterMeta | null> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) return null;

    const metaRef = doc(db, FIRESTORE_COLLECTION, MASTER_META_DOC_ID);
    const snap = await getDoc(metaRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      version: data.version || 1,
      updatedAt: data.updatedAt || Date.now(),
      nyanCount: data.nyanCount || 0,
      lastUpdatedNote: data.lastUpdatedNote || '',
    };
  } catch (err) {
    console.warn('fetchMasterMeta warning:', err);
    return null;
  }
}

/**
 * Fetches the consolidated master character list from Firestore.
 */
export async function fetchMasterNyans(): Promise<{ version: number; nyans: NyanCharacter[] } | null> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) return null;

    const nyansRef = doc(db, FIRESTORE_COLLECTION, MASTER_NYANS_DOC_ID);
    const snap = await getDoc(nyansRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    const nyans = Array.isArray(data.nyans) ? (data.nyans as NyanCharacter[]) : [];
    return {
      version: data.version || 1,
      nyans,
    };
  } catch (err) {
    console.warn('fetchMasterNyans warning:', err);
    return null;
  }
}

/**
 * Administrator action: Publish characters list to Firestore (compat wrapper around publishGlobalMasterData).
 */
export async function publishMasterData(
  nyans: NyanCharacter[],
  note?: string
): Promise<{ success: boolean; version?: number; count?: number; error?: string }> {
  const currentMaster = loadLocalMasterData();
  const res = await publishGlobalMasterData({
    ...currentMaster,
    characters: nyans,
  }, note);
  return {
    success: res.success,
    version: res.version,
    count: nyans.length,
    error: res.error,
  };
}

/**
 * Safely merge master character definitions with current user progress
 * Strictly preserves discovery status, encounter history, friendship, and personal customizations.
 */
export function mergeMasterWithCurrentProgress(
  currentNyans: NyanCharacter[],
  masterNyans: NyanCharacter[]
): NyanCharacter[] {
  const map = new Map(currentNyans.map((c) => [c.no, c]));
  return masterNyans.map((master) => {
    const cur = map.get(master.no);
    if (!cur) return master;
    return {
      ...master,
      // User individual progress
      discovered: Boolean(cur.discovered || master.discovered),
      discoveryDate: cur.discoveryDate || master.discoveryDate,
      lastMetAt: Math.max(cur.lastMetAt || 0, master.lastMetAt || 0),
      friendshipLevel: Math.max(cur.friendshipLevel || 0, master.friendshipLevel || 0, 1),
      playCount: Math.max(cur.playCount || 0, master.playCount || 0),
      // Master image is authoritative for official character art; prevent resurrecting removed/reset images
      customImageUrl: master.customImageUrl || undefined,
      rawImageUrl: master.rawImageUrl || undefined,
      transparency: master.transparency || undefined,
    };
  });
}

/**
 * Client Launch Sync: Checks master version with 1 lightweight Read.
 * If a new version exists, fetches masterNyans and cleanly merges with current user progress.
 */
export async function checkForMasterUpdateAndSync(
  currentNyans: NyanCharacter[],
  options: { force?: boolean } = {}
): Promise<{
  updated: boolean;
  version: number;
  nyans: NyanCharacter[];
  addedCount: number;
  error?: string;
}> {
  try {
    const cachedVersion = getCachedMasterVersion();
    const meta = await fetchMasterMeta();

    if (!meta) {
      // No cloud master published yet; cleanly fallback to current nyans
      return {
        updated: false,
        version: cachedVersion,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    // Check if new version is available
    if (!options.force && meta.version <= cachedVersion && currentNyans.length >= meta.nyanCount) {
      return {
        updated: false,
        version: cachedVersion,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    // Fetch new master characters
    const masterData = await fetchMasterNyans();
    if (!masterData || !masterData.nyans || masterData.nyans.length === 0) {
      return {
        updated: false,
        version: cachedVersion,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    const mergedNyans = mergeMasterWithCurrentProgress(currentNyans, masterData.nyans);
    const addedCount = Math.max(0, masterData.nyans.length - currentNyans.length);
    const hasContentChanges =
      addedCount > 0 ||
      meta.version > cachedVersion ||
      JSON.stringify(currentNyans.map((n) => [n.no, n.customImageUrl, n.name])) !==
        JSON.stringify(mergedNyans.map((n) => [n.no, n.customImageUrl, n.name]));

    // Save to local cache
    setCachedMasterVersion(meta.version);
    setCachedMasterNyans(masterData.nyans);

    return {
      updated: hasContentChanges,
      version: meta.version,
      nyans: mergedNyans,
      addedCount,
    };
  } catch (err: any) {
    console.warn('checkForMasterUpdateAndSync error:', err);
    return {
      updated: false,
      version: getCachedMasterVersion(),
      nyans: currentNyans,
      addedCount: 0,
      error: err.message,
    };
  }
}
