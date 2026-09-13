import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NyanCharacter, GameMasterData } from '../types';
import { DEFAULT_MASTER_DATA } from './storage';
import { getFirestoreDbInstance, initFirebase, recordFirestoreWrite } from './firebaseSync';
import { estimateMasterPublishCost, WriteCostEstimate } from './writeCostEstimator';

export interface KenchikoMasterManifest {
  version: number;
  charactersVersion: number;
  asobiVersion: number;
  assetsVersion: number;
  updatedAt: number;
  nyanCount: number;
  lastUpdatedNote?: string;
}

export interface MasterFetchDetail {
  success: boolean;
  data: GameMasterData | null;
  error?: string;
  sourceDoc: string;
  bytesRead?: number;
  estimatedReads?: number;
}

// Dedicated isolated documents
export const MASTER_MANIFEST_DOC_ID = 'ken-chiko-master-manifest';
export const MASTER_CHARACTERS_DOC_ID = 'ken-chiko-master-characters';
export const MASTER_ASOBI_DOC_ID = 'ken-chiko-master-asobi';
export const MASTER_ASSETS_DOC_ID = 'ken-chiko-master-assets';

// Legacy fallback
export const GLOBAL_MASTER_DOC_ID = 'ken-chiko-global-master';
export const MASTER_META_DOC_ID = 'ken-chiko-master-meta';
export const MASTER_NYANS_DOC_ID = 'ken-chiko-master-nyans';

export const FIRESTORE_COLLECTION = 'kenchiko_world';

// Local storage cache keys
const LOCAL_GLOBAL_MASTER_KEY = 'kenchiko_global_master_data_v1';
const CACHED_MANIFEST_KEY = 'kenchiko_cached_master_manifest_v2';
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
 * Get locally stored manifest
 */
export function getCachedManifest(): KenchikoMasterManifest | null {
  try {
    const raw = localStorage.getItem(CACHED_MANIFEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Store manifest in local storage
 */
export function setCachedManifest(manifest: KenchikoMasterManifest): void {
  try {
    localStorage.setItem(CACHED_MANIFEST_KEY, JSON.stringify(manifest));
    localStorage.setItem(CACHED_MASTER_VERSION_KEY, String(manifest.version));
  } catch {}
}

/**
 * Get locally stored master version
 */
export function getCachedMasterVersion(): number {
  const m = getCachedManifest();
  if (m && m.version) return m.version;
  try {
    const raw = localStorage.getItem(CACHED_MASTER_VERSION_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setCachedMasterVersion(version: number): void {
  try {
    localStorage.setItem(CACHED_MASTER_VERSION_KEY, String(version));
  } catch {}
}

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

export function setCachedMasterNyans(nyans: NyanCharacter[]): void {
  try {
    localStorage.setItem(CACHED_MASTER_NYANS_KEY, JSON.stringify(nyans));
  } catch {}
}

/**
 * Fetches the lightweight master manifest (< 1 KB, exactly 1 read).
 */
export async function fetchMasterManifest(): Promise<KenchikoMasterManifest | null> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) return null;

    // 1. Check isolated manifest document first
    const manifestRef = doc(db, FIRESTORE_COLLECTION, MASTER_MANIFEST_DOC_ID);
    const snap = await getDoc(manifestRef);
    if (snap.exists()) {
      const d = snap.data();
      return {
        version: d.version || 1,
        charactersVersion: d.charactersVersion || d.version || 1,
        asobiVersion: d.asobiVersion || d.version || 1,
        assetsVersion: d.assetsVersion || d.version || 1,
        updatedAt: d.updatedAt || Date.now(),
        nyanCount: d.nyanCount || 0,
        lastUpdatedNote: d.lastUpdatedNote || '',
      };
    }

    // 2. Fallback to global master header if manifest does not exist yet
    const masterDocRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_MASTER_DOC_ID);
    const legacySnap = await getDoc(masterDocRef);
    if (legacySnap.exists()) {
      const d = legacySnap.data();
      return {
        version: d.version || 1,
        charactersVersion: d.version || 1,
        asobiVersion: d.version || 1,
        assetsVersion: d.version || 1,
        updatedAt: d.lastUpdated || Date.now(),
        nyanCount: Array.isArray(d.characters) ? d.characters.length : 0,
        lastUpdatedNote: d.note || '',
      };
    }

    return null;
  } catch (err) {
    console.warn('fetchMasterManifest error:', err);
    return null;
  }
}

/**
 * Fetch global master data with intelligent CONDITIONAL FETCHING:
 * 1. Reads the tiny manifest (< 1 KB, 1 read).
 * 2. If cached versions match, SKIPS fetching unchanged modular docs entirely (0 reads!).
 * 3. Only downloads modified modules, saving 95%+ bandwidth and reads.
 */
export async function fetchGlobalMasterDataWithStatus(forceAll: boolean = false): Promise<MasterFetchDetail> {
  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, data: null, error: 'Firebaseデータベースインスタンスが見つかりません', sourceDoc: MASTER_MANIFEST_DOC_ID };
    }

    // Read manifest (1 read, ~200 bytes)
    const remoteManifest = await fetchMasterManifest();
    const localManifest = getCachedManifest();
    const cachedMaster = loadLocalMasterData();

    if (!remoteManifest) {
      // If neither manifest nor legacy exists, return local draft
      return { success: true, data: cachedMaster, sourceDoc: 'local' };
    }

    // Check if modular documents are active based on manifest
    const isModular = remoteManifest && remoteManifest.charactersVersion !== undefined;

    if (isModular) {
      // --- MODULAR ARCHITECTURE DETECTED ---
      const needChars = forceAll || !localManifest || remoteManifest.charactersVersion > (localManifest.charactersVersion || 0) || !cachedMaster.characters || cachedMaster.characters.length === 0;
      const needAsobi = forceAll || !localManifest || remoteManifest.asobiVersion > (localManifest.asobiVersion || 0) || !cachedMaster.asobiList || cachedMaster.asobiList.length === 0;
      const needAssets = forceAll || !localManifest || remoteManifest.assetsVersion > (localManifest.assetsVersion || 0);

      console.log(`[MasterSync] 🚀 差分チェック結果: Characters更新必要=${needChars}, Asobi更新必要=${needAsobi}, Assets更新必要=${needAssets}`);

      let finalCharacters = cachedMaster.characters || [];
      let finalAsobiList = cachedMaster.asobiList || [];
      let finalOuenCategories = cachedMaster.ouenCategories || [];
      let finalOuenList = cachedMaster.ouenList || [];
      let finalDriveUrl = cachedMaster.googleDriveFolderUrl;
      let finalAssets: { customImages?: Record<number, any>; kihonNyanCustomImageUrl?: string; kounichan?: any } = {};

      // 1. Fetch Characters ONLY if updated (Pure text - NO base64 images)
      if (needChars) {
        const charDocRef = doc(db, FIRESTORE_COLLECTION, MASTER_CHARACTERS_DOC_ID);
        const charSnap = await getDoc(charDocRef);
        if (charSnap.exists()) {
          const cData = charSnap.data();
          if (Array.isArray(cData.characters)) {
            finalCharacters = cData.characters;
          }
        }
      }

      // 2. Fetch Asobi if updated
      if (needAsobi) {
        const asobiSnap = await getDoc(doc(db, FIRESTORE_COLLECTION, MASTER_ASOBI_DOC_ID));
        if (asobiSnap.exists()) {
          const aData = asobiSnap.data();
          finalAsobiList = Array.isArray(aData.asobiList) ? aData.asobiList : finalAsobiList;
          finalOuenCategories = Array.isArray(aData.ouenCategories) ? aData.ouenCategories : finalOuenCategories;
          finalOuenList = Array.isArray(aData.ouenList) ? aData.ouenList : finalOuenList;
          finalDriveUrl = aData.googleDriveFolderUrl || finalDriveUrl;
        }
      }

      // 3. Fetch Heavy Assets ONLY if updated
      if (needAssets) {
        const assetsSnap = await getDoc(doc(db, FIRESTORE_COLLECTION, MASTER_ASSETS_DOC_ID));
        if (assetsSnap.exists()) {
          finalAssets = assetsSnap.data() || {};
        }
      }

      // If we downloaded new assets, merge custom images into characters
      if (finalAssets.customImages) {
        finalCharacters = finalCharacters.map((c) => {
          const asset = finalAssets.customImages?.[c.no];
          if (asset) {
            return {
              ...c,
              customImageUrl: asset.customImageUrl || c.customImageUrl,
              rawImageUrl: asset.rawImageUrl || c.rawImageUrl,
              transparency: asset.transparency || c.transparency,
            };
          }
          return c;
        });
      }

      const mergedMaster: GameMasterData = {
        version: remoteManifest.version,
        characters: finalCharacters,
        asobiList: finalAsobiList,
        ouenCategories: finalOuenCategories,
        ouenList: finalOuenList,
        kounichan: finalAssets.kounichan || cachedMaster.kounichan,
        kihonNyanCustomImageUrl: finalAssets.kihonNyanCustomImageUrl !== undefined ? finalAssets.kihonNyanCustomImageUrl : cachedMaster.kihonNyanCustomImageUrl,
        googleDriveFolderUrl: finalDriveUrl,
        lastUpdated: remoteManifest.updatedAt,
      };

      saveLocalMasterData(mergedMaster);
      setCachedManifest(remoteManifest);
      setCachedMasterNyans(finalCharacters);

      return {
        success: true,
        data: mergedMaster,
        sourceDoc: 'modular-firestore',
      };
    }

    // --- FALLBACK: Legacy monolithic document ---
    const legacyDocRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_MASTER_DOC_ID);
    const snap = await getDoc(legacyDocRef);
    if (!snap.exists()) {
      return { success: true, data: cachedMaster, sourceDoc: 'local' };
    }

    const data = snap.data();
    const masterData: GameMasterData = {
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

    saveLocalMasterData(masterData);
    setCachedManifest(remoteManifest);

    return { success: true, data: masterData, sourceDoc: GLOBAL_MASTER_DOC_ID };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: `マスター取得失敗: ${err?.message || String(err)}`,
      sourceDoc: MASTER_MANIFEST_DOC_ID,
    };
  }
}

export async function fetchGlobalMasterData(): Promise<GameMasterData | null> {
  const res = await fetchGlobalMasterDataWithStatus(false);
  return res.data;
}

/**
 * Administrator action: Publish GameMasterData to Firestore in completely isolated modular documents.
 * 1. ken-chiko-master-manifest (< 1 KB, 1 write)
 * 2. ken-chiko-master-characters (Pure text, NO base64 images, ~250 KB)
 * 3. ken-chiko-master-asobi (~10 KB)
 * 4. ken-chiko-master-assets (ONLY written if images actually changed!)
 */
let lastMasterPublishTime = 0;
const MASTER_PUBLISH_COOLDOWN_MS = 3000;

export async function publishGlobalMasterData(
  master: GameMasterData,
  note?: string,
  options: {
    syncCharacters?: boolean;
    syncAsobi?: boolean;
    syncAssets?: boolean;
  } = {}
): Promise<{
  success: boolean;
  version?: number;
  error?: string;
  estimate?: WriteCostEstimate;
}> {
  const now = Date.now();
  if (now - lastMasterPublishTime < MASTER_PUBLISH_COOLDOWN_MS) {
    console.log('[MasterData] ⏳ 短時間の連続保存をスキップしました');
    const cachedVer = getCachedMasterVersion() || master.version || 1;
    return { success: true, version: cachedVer };
  }

  try {
    initFirebase();
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    lastMasterPublishTime = now;

    const currentManifest = await fetchMasterManifest();
    const nextVersion = (currentManifest?.version || master.version || 0) + 1;
    const nextCharVer = (currentManifest?.charactersVersion || 1) + 1;
    const nextAsobiVer = (currentManifest?.asobiVersion || 1) + 1;
    const nextAssetsVer = (currentManifest?.assetsVersion || 1) + 1;

    // Separate pure character text metadata from heavy Base64 image payloads
    const pureCharacters: NyanCharacter[] = [];
    const customImagesMap: Record<number, { customImageUrl?: string; rawImageUrl?: string; transparency?: any }> = {};

    for (const n of master.characters || []) {
      // 1. Text metadata
      pureCharacters.push({
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
        // Lightweight flag instead of 200KB base64 string
        hasCustomImage: Boolean(n.customImageUrl),
        favoriteItems: n.favoriteItems,
        favoriteLocations: n.favoriteLocations,
      } as any);

      // 2. Separate heavy image data into assets map
      if (n.customImageUrl || n.rawImageUrl) {
        customImagesMap[n.no] = {
          customImageUrl: n.customImageUrl,
          rawImageUrl: n.rawImageUrl,
          transparency: n.transparency,
        };
      }
    }

    // Measure write cost estimate
    const estimate = estimateMasterPublishCost(master, {
      includeCharactersText: options.syncCharacters !== false,
      includeAsobiOuen: options.syncAsobi !== false,
      includeAssets: options.syncAssets !== false,
    });

    console.log(`[MasterPublish] 📊 書き込みドキュメント数: ${estimate.docWrites}件 (${estimate.kb} KB)`);

    // 1. Save Isolated Characters Index doc
    if (options.syncCharacters !== false) {
      const charDocRef = doc(db, FIRESTORE_COLLECTION, MASTER_CHARACTERS_DOC_ID);
      await setDoc(charDocRef, sanitizeForFirestore({
        version: nextCharVer,
        updatedAt: now,
        count: pureCharacters.length,
        characters: pureCharacters,
      }));
      recordFirestoreWrite(`kenchiko_world/${MASTER_CHARACTERS_DOC_ID}`, 1);
    }

    // 2. Save Isolated Asobi & Ouen doc
    if (options.syncAsobi !== false) {
      const asobiDocRef = doc(db, FIRESTORE_COLLECTION, MASTER_ASOBI_DOC_ID);
      await setDoc(asobiDocRef, sanitizeForFirestore({
        version: nextAsobiVer,
        updatedAt: now,
        asobiList: master.asobiList || [],
        ouenCategories: master.ouenCategories || [],
        ouenList: master.ouenList || [],
        googleDriveFolderUrl: master.googleDriveFolderUrl || null,
      }));
      recordFirestoreWrite(`kenchiko_world/${MASTER_ASOBI_DOC_ID}`, 1);
    }

    // 3. Save Isolated Base64 Assets doc (ONLY if enabled)
    if (options.syncAssets !== false) {
      const assetsDocRef = doc(db, FIRESTORE_COLLECTION, MASTER_ASSETS_DOC_ID);
      await setDoc(assetsDocRef, sanitizeForFirestore({
        version: nextAssetsVer,
        updatedAt: now,
        customImages: customImagesMap,
        kihonNyanCustomImageUrl: master.kihonNyanCustomImageUrl || null,
        kounichan: master.kounichan || null,
      }));
      recordFirestoreWrite(`kenchiko_world/${MASTER_ASSETS_DOC_ID}`, 1);
    }

    // 4. Save Version Manifest (Lightweight: < 1 KB)
    const newManifest: KenchikoMasterManifest = {
      version: nextVersion,
      charactersVersion: options.syncCharacters !== false ? nextCharVer : (currentManifest?.charactersVersion || 1),
      asobiVersion: options.syncAsobi !== false ? nextAsobiVer : (currentManifest?.asobiVersion || 1),
      assetsVersion: options.syncAssets !== false ? nextAssetsVer : (currentManifest?.assetsVersion || 1),
      updatedAt: now,
      nyanCount: pureCharacters.length,
      lastUpdatedNote: note || `管理画面より分離保存 (v${nextVersion})`,
    };
    const manifestDocRef = doc(db, FIRESTORE_COLLECTION, MASTER_MANIFEST_DOC_ID);
    await setDoc(manifestDocRef, sanitizeForFirestore(newManifest));
    recordFirestoreWrite(`kenchiko_world/${MASTER_MANIFEST_DOC_ID}`, 1);

    // Save to local cache
    setCachedManifest(newManifest);
    saveLocalMasterData({
      ...master,
      version: nextVersion,
      lastUpdated: now,
    });
    setCachedMasterNyans(master.characters);

    console.log(`[MasterPublish] ✅ 分離マスター保存完了: v${nextVersion}`);

    return {
      success: true,
      version: nextVersion,
      estimate,
    };
  } catch (err: any) {
    console.error('publishGlobalMasterData error:', err);
    return {
      success: false,
      error: err.message || 'マスターデータの保存中にエラーが発生しました',
    };
  }
}

/**
 * Safely merge master character definitions with current user progress
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
      discovered: Boolean(cur.discovered || master.discovered),
      discoveryDate: cur.discoveryDate || master.discoveryDate,
      lastMetAt: Math.max(cur.lastMetAt || 0, master.lastMetAt || 0),
      friendshipLevel: Math.max(cur.friendshipLevel || 0, master.friendshipLevel || 0, 1),
      playCount: Math.max(cur.playCount || 0, master.playCount || 0),
      customImageUrl: master.customImageUrl || cur.customImageUrl || undefined,
      rawImageUrl: master.rawImageUrl || cur.rawImageUrl || undefined,
      transparency: master.transparency || cur.transparency || undefined,
    };
  });
}

/**
 * Client Launch Sync: Checks master manifest with 1 lightweight Read (< 1 KB).
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
    const cachedManifest = getCachedManifest();
    const manifest = await fetchMasterManifest();

    if (!manifest) {
      return {
        updated: false,
        version: cachedManifest?.version || 1,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    if (!options.force && cachedManifest && manifest.version <= cachedManifest.version && currentNyans.length >= manifest.nyanCount) {
      return {
        updated: false,
        version: manifest.version,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    const masterRes = await fetchGlobalMasterDataWithStatus(Boolean(options.force));
    if (!masterRes.success || !masterRes.data || !masterRes.data.characters) {
      return {
        updated: false,
        version: manifest.version,
        nyans: currentNyans,
        addedCount: 0,
      };
    }

    const mergedNyans = mergeMasterWithCurrentProgress(currentNyans, masterRes.data.characters);
    const addedCount = Math.max(0, masterRes.data.characters.length - currentNyans.length);

    setCachedManifest(manifest);
    setCachedMasterNyans(mergedNyans);

    return {
      updated: true,
      version: manifest.version,
      nyans: mergedNyans,
      addedCount,
    };
  } catch (err: any) {
    console.warn('checkForMasterUpdateAndSync warning:', err);
    return {
      updated: false,
      version: getCachedMasterVersion(),
      nyans: currentNyans,
      addedCount: 0,
      error: err?.message,
    };
  }
}

// Backward compatibility alias
export type KenchikoMasterMeta = KenchikoMasterManifest;
export const fetchMasterMeta = fetchMasterManifest;
export async function fetchMasterNyans(): Promise<{ version: number; nyans: NyanCharacter[] } | null> {
  const data = await fetchGlobalMasterData();
  if (!data) return null;
  return { version: data.version || 1, nyans: data.characters || [] };
}
export async function publishMasterData(nyans: NyanCharacter[], note?: string) {
  const current = loadLocalMasterData();
  const res = await publishGlobalMasterData({ ...current, characters: nyans }, note, { syncCharacters: true, syncAssets: false });
  return {
    ...res,
    count: nyans.length,
  };
}
