import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NyanCharacter } from '../types';
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
export const FIRESTORE_COLLECTION = 'kenchiko_world';

const CACHED_MASTER_VERSION_KEY = 'kenchiko_cached_master_version_v1';
const CACHED_MASTER_NYANS_KEY = 'kenchiko_cached_master_nyans_v1';

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
 * Administrator action: Publish the current characters list to Firestore as the new official master.
 * Automatically increments version and writes both meta and full character records.
 */
export async function publishMasterData(
  nyans: NyanCharacter[],
  note?: string
): Promise<{ success: boolean; version?: number; count?: number; error?: string }> {
  try {
    if (!nyans || nyans.length === 0) {
      return { success: false, error: '公開するにゃんこデータが空です' };
    }

    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    // Get current version
    const currentMeta = await fetchMasterMeta();
    const nextVersion = (currentMeta?.version || 0) + 1;
    const now = Date.now();

    // Prepare master characters array with clean fields (defaulting discovered=false for clean distribution)
    const masterNyansList: NyanCharacter[] = nyans.map((n) => ({
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

    // 1. Write characters document
    const nyansRef = doc(db, FIRESTORE_COLLECTION, MASTER_NYANS_DOC_ID);
    await setDoc(
      nyansRef,
      sanitizeForFirestore({
        version: nextVersion,
        updatedAt: now,
        nyans: masterNyansList,
      })
    );

    // 2. Write metadata document
    const metaRef = doc(db, FIRESTORE_COLLECTION, MASTER_META_DOC_ID);
    const metaPayload: KenchikoMasterMeta = {
      version: nextVersion,
      updatedAt: now,
      nyanCount: masterNyansList.length,
      lastUpdatedNote: note || `管理画面より公開 (${masterNyansList.length}匹)`,
    };
    await setDoc(metaRef, sanitizeForFirestore(metaPayload));

    // Update local cache
    setCachedMasterVersion(nextVersion);
    setCachedMasterNyans(masterNyansList);

    return {
      success: true,
      version: nextVersion,
      count: masterNyansList.length,
    };
  } catch (err: any) {
    console.error('publishMasterData error:', err);
    return {
      success: false,
      error: err.message || 'マスターデータの公開中にエラーが発生しました',
    };
  }
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
      // User custom image override if set, otherwise use master image
      customImageUrl: cur.customImageUrl || master.customImageUrl,
      rawImageUrl: cur.rawImageUrl || master.rawImageUrl,
      transparency: cur.transparency ?? master.transparency,
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
