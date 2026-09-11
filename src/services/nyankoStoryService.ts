import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { getFirestoreDbInstance } from './firebaseSync';
import { NyankoStory } from '../types';

export interface StoryIndexItem {
  id: number;
  name: string;
  kana?: string;
  motif?: string;
  week_title?: string;
  daysCount: number;
  updatedAt?: string;
}

export interface NyankoStoriesMeta {
  version: number;
  updatedAt: number;
  storyCount: number;
  stories: Record<string, StoryIndexItem>; // Key is String(nyanId)
}

// In-memory runtime cache: prevents duplicate Firestore reads during the session
const storyMemoryCache = new Map<number, NyankoStory>();
let cachedStoriesMeta: NyankoStoriesMeta | null = null;

// Storage key prefixes
const SESSION_CACHE_KEY_PREFIX = 'kenchiko_story_cache_v2_';
const LOCAL_STORIES_META_KEY = 'kenchiko_stories_meta_v1';
const FIRESTORE_COLLECTION = 'kenchiko_world';
const STORIES_META_DOC_ID = 'nyanko_stories_meta';
export const GLOBAL_STORIES_DOC_ID = 'ken-chiko-global-stories';
export const GLOBAL_UNMAPPED_DOC_ID = 'ken-chiko-global-unmapped-stories';

/**
 * Retrieves cached story from memory or sessionStorage
 */
function getFromLocalCache(nyanId: number): NyankoStory | null {
  if (storyMemoryCache.has(nyanId)) {
    return storyMemoryCache.get(nyanId)!;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as NyankoStory;
        storyMemoryCache.set(nyanId, parsed);
        return parsed;
      }
    } catch {}
  }
  return null;
}

/**
 * Saves story to memory and sessionStorage
 */
function saveToLocalCache(nyanId: number, story: NyankoStory): void {
  storyMemoryCache.set(nyanId, story);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`, JSON.stringify(story));
    } catch {}
  }
}

/**
 * Removes story from local caches
 */
function removeFromLocalCache(nyanId: number): void {
  storyMemoryCache.delete(nyanId);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.removeItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
    } catch {}
  }
}

/**
 * Retrieves cached stories metadata (synchronous fast access)
 */
export function getLocalStoriesMeta(): NyankoStoriesMeta | null {
  if (cachedStoriesMeta) return cachedStoriesMeta;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_STORIES_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NyankoStoriesMeta;
        cachedStoriesMeta = parsed;
        return parsed;
      }
    } catch {}
  }
  return null;
}

/**
 * Sets local stories metadata
 */
export function setLocalStoriesMeta(meta: NyankoStoriesMeta): void {
  cachedStoriesMeta = meta;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(LOCAL_STORIES_META_KEY, JSON.stringify(meta));
    } catch {}
  }
}

/**
 * Fetches the lightweight stories metadata index from Firestore (1 Read operation).
 * Tells the app exactly which nyans have registered stories across the entire roster.
 */
export async function fetchStoriesMeta(force: boolean = false): Promise<NyankoStoriesMeta | null> {
  if (!force) {
    const local = getLocalStoriesMeta();
    // If we have a valid cache with actual registered stories, return it instantly
    if (local && local.storyCount > 0 && Object.keys(local.stories || {}).length > 0) {
      return local;
    }
  }

  try {
    const db = getFirestoreDbInstance();
    if (!db) return getLocalStoriesMeta();

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    const snap = await getDoc(metaRef);
    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    const meta: NyankoStoriesMeta = {
      version: data.version || 1,
      updatedAt: data.updatedAt || Date.now(),
      storyCount: data.storyCount || 0,
      stories: data.stories || {},
    };

    setLocalStoriesMeta(meta);
    return meta;
  } catch (err) {
    console.warn('fetchStoriesMeta warning:', err);
    return getLocalStoriesMeta();
  }
}

/**
 * Parse input string or object into a verified list of NyankoStory objects.
 * Supports:
 * 1. Keyed object format: { "ほむらにゃん": { character_id: 176, ... } }
 * 2. Array format: [ { character_id: 176, ... }, ... ]
 * 3. Single object format: { character_name: "...", ... }
 * 4. Multi-object text format: { "ほむらにゃん": {...} }, { "まどかにゃん": {...} }
 */
export function parseStoryInputJson(input: string | any): {
  valid: boolean;
  stories: NyankoStory[];
  error?: string;
} {
  try {
    let parsed: any = input;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return { valid: false, stories: [], error: 'JSONデータが入力されていません' };
      }
      try {
        parsed = JSON.parse(trimmed);
      } catch (firstErr) {
        // Try wrapping comma-separated objects in array brackets: [ { ... }, { ... } ]
        try {
          parsed = JSON.parse(`[${trimmed.replace(/,\s*$/, '')}]`);
        } catch {
          throw firstErr;
        }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, stories: [], error: '無効なJSONオブジェクトです' };
    }

    const result: NyankoStory[] = [];

    const processObject = (obj: any, fallbackName?: string) => {
      if (!obj || typeof obj !== 'object') return;

      // If it's a wrapper with nyan name as key: { "ほむらにゃん": { character_id: 176, ... } }
      const keys = Object.keys(obj);
      const isInnerStoryObject =
        obj.id !== undefined ||
        obj.no !== undefined ||
        obj.character_id !== undefined ||
        obj.name !== undefined ||
        obj.character_name !== undefined ||
        obj.week_info !== undefined ||
        obj.week_period !== undefined ||
        obj.weekly_dialogue_records !== undefined;

      if (isInnerStoryObject) {
        const itemWithFallback = {
          ...obj,
          name: obj.name || obj.character_name || fallbackName || '',
        };
        const validItem = normalizeStoryItem(itemWithFallback);
        if (validItem) result.push(validItem);
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (val && typeof val === 'object') {
            const itemWithFallback = {
              ...(val as any),
              name: (val as any).name || (val as any).character_name || key,
            };
            const validItem = normalizeStoryItem(itemWithFallback);
            if (validItem) result.push(validItem);
          }
        }
      }
    };

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        processObject(item);
      }
    } else {
      processObject(parsed);
    }

    if (result.length === 0) {
      return {
        valid: false,
        stories: [],
        error: '有効な物語データ（名前やセリフデータを含むデータ）が見つかりませんでした',
      };
    }

    // Sort by id ascending
    result.sort((a, b) => a.id - b.id);
    return { valid: true, stories: result };
  } catch (err: any) {
    return {
      valid: false,
      stories: [],
      error: `JSONの構文エラー: ${err?.message || '正しく解析できませんでした'}`,
    };
  }
}

/**
 * Helper to normalize and validate a single story item across multiple schema formats.
 */
function normalizeStoryItem(raw: any): NyankoStory | null {
  const rawId = raw.id ?? raw.no ?? raw.character_id ?? raw.oldId;
  const numId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
  const finalId = !isNaN(numId) && numId > 0 ? numId : 9999;

  const name = String(raw.name || raw.character_name || '').trim();
  if (!name) return null;

  const days: any[] = Array.isArray(raw.week_info?.days)
    ? raw.week_info.days
    : Array.isArray(raw.days)
    ? raw.days
    : Array.isArray(raw.weekly_dialogue_records)
    ? raw.weekly_dialogue_records
    : [];

  const weekTitle =
    raw.week_info?.week_title ||
    raw.week_title ||
    raw.week_period?.title ||
    raw.title ||
    '';
  const weekStart =
    raw.week_info?.week_start ||
    raw.week_start ||
    raw.week_period?.start_date ||
    '';
  const weekEnd =
    raw.week_info?.week_end ||
    raw.week_end ||
    raw.week_period?.end_date ||
    '';

  return {
    id: finalId,
    name,
    kana: raw.kana || undefined,
    motif: raw.motif || undefined,
    debut_date: raw.debut_date || undefined,
    voice: raw.voice || raw.representative_cat_speech || undefined,
    translation: raw.translation || raw.representative_translation || undefined,
    episode_summary: raw.episode_summary || raw.summary || undefined,
    prompt_ja: raw.prompt_ja || raw.image_prompt_ja || undefined,
    prompt_en: raw.prompt_en || raw.image_prompt_en || undefined,
    doc_link: raw.doc_link || undefined,
    week_info: {
      week_title: weekTitle,
      week_start: weekStart,
      week_end: weekEnd,
      days: days.map((d: any) => ({
        date_header: String(d.date_header || d.date || ''),
        messages: Array.isArray(d.messages)
          ? d.messages.map((m: any) => ({
              time: String(m.time || ''),
              sender: String(m.sender || ''),
              body: String(m.body || m.content || ''),
            }))
          : [],
      })),
    },
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetches the weekly story and dialogue for a specific nyan from Firestore.
 * Utilizes multi-layer caching (Memory -> SessionStorage -> Firestore)
 * so each story is read at most once per session (reducing network traffic by 99%+).
 */
export async function fetchNyankoStory(nyanId: number): Promise<{
  story: NyankoStory | null;
  fromCache: boolean;
  error?: string;
}> {
  // 1. Check local caches first
  const cached = getFromLocalCache(nyanId);
  if (cached) {
    return { story: cached, fromCache: true };
  }

  // 2. Fetch on-demand from Firestore
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { story: null, fromCache: false, error: 'Firebaseデータベースに接続できません' };
    }

    // A. Check consolidated global stories document first (1 single read loads all stories into memory)
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    const globalSnap = await getDoc(globalStoriesRef);
    if (globalSnap.exists()) {
      const gData = globalSnap.data();
      const storiesMap = gData.stories || {};
      // Populate memory cache for all loaded stories to eliminate future Firestore reads
      for (const [key, val] of Object.entries(storiesMap)) {
        const idNum = Number(key);
        if (!isNaN(idNum) && val) {
          saveToLocalCache(idNum, val as NyankoStory);
        }
      }

      if (storiesMap[String(nyanId)]) {
        const story = storiesMap[String(nyanId)] as NyankoStory;
        saveToLocalCache(nyanId, story);
        return { story, fromCache: false };
      }
    }

    // B. Fallback to legacy single document if not found in consolidated master
    const legacyDocRef = doc(db, 'nyanko_stories', String(nyanId));
    const snap = await getDoc(legacyDocRef);

    if (!snap.exists()) {
      return { story: null, fromCache: false, error: 'このにゃんこの物語はまだ登録されていません' };
    }

    const data = snap.data() as NyankoStory;
    saveToLocalCache(nyanId, data);
    return { story: data, fromCache: false };
  } catch (err: any) {
    console.error(`Failed to fetch story for nyan #${nyanId}:`, err);
    return {
      story: null,
      fromCache: false,
      error: err?.message || '物語の取得に失敗しました',
    };
  }
}

/**
 * Preload a story in the background without blocking the UI
 */
export function preloadNyankoStory(nyanId: number): void {
  if (getFromLocalCache(nyanId)) return;
  fetchNyankoStory(nyanId).catch(() => {});
}

/**
 * Uploads or updates stories from a raw JSON object to Firestore in a SINGLE atomic write operation.
 * Consolidates all stories into the global master document (exactly 1 Write, preventing hundreds of writes).
 */
export async function uploadStoriesJsonToFirestore(
  jsonData: Record<string, any> | any[] | string,
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
  try {
    const parseRes = parseStoryInputJson(jsonData);
    if (!parseRes.valid || parseRes.stories.length === 0) {
      return { success: false, totalUploaded: 0, error: parseRes.error || 'データが空です' };
    }

    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, totalUploaded: 0, error: 'Firebase is not initialized' };
    }

    const stories = parseRes.stories;
    const total = stories.length;

    // Fetch or prepare current metadata
    const currentMeta = (await fetchStoriesMeta(true)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    // Prepare dictionary map of all stories
    const storiesMap: Record<string, NyankoStory> = {};
    for (let i = 0; i < total; i++) {
      const item = stories[i];
      const cleanPayload: NyankoStory = JSON.parse(JSON.stringify({
        ...item,
        updatedAt: new Date().toISOString(),
      }));
      storiesMap[String(item.id)] = cleanPayload;

      // Update meta map
      currentMeta.stories[String(item.id)] = {
        id: item.id,
        name: item.name,
        kana: item.kana,
        motif: item.motif,
        week_title: item.week_info?.week_title,
        daysCount: item.week_info?.days?.length || 0,
        updatedAt: new Date().toISOString(),
      };

      // Update local memory cache immediately
      saveToLocalCache(item.id, cleanPayload);

      if (onProgress && (i % 10 === 0 || i === total - 1)) {
        onProgress({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
        });
      }
    }

    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    currentMeta.version = (currentMeta.version || 1) + 1;

    // 1. Write consolidated stories document (EXACTLY 1 single document write in Firestore for all stories!)
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    await setDoc(globalStoriesRef, {
      version: currentMeta.version,
      updatedAt: new Date().toISOString(),
      storyCount: currentMeta.storyCount,
      stories: storiesMap,
    }, { merge: true });

    // 2. Write metadata document (1 Write)
    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    await setDoc(metaRef, currentMeta);
    setLocalStoriesMeta(currentMeta);

    console.log(`[NyankoStory] 💾 全物語を一括保存完了 [わずか1回書き込み]: ${total}件の物語を ${GLOBAL_STORIES_DOC_ID} に統合`);

    return { success: true, totalUploaded: total };
  } catch (err: any) {
    console.error('Failed to upload stories JSON:', err);
    return { success: false, totalUploaded: 0, error: err?.message || 'アップロードに失敗しました' };
  }
}

/**
 * Saves a single story to Firestore and updates the metadata index.
 * Writes to consolidated global document (1 Write).
 */
export async function saveSingleStoryToFirestore(story: NyankoStory): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    const cleanPayload = JSON.parse(JSON.stringify({
      ...story,
      updatedAt: new Date().toISOString(),
    }));

    // Write to consolidated global document in Firestore (1 Write)
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    await setDoc(globalStoriesRef, {
      updatedAt: new Date().toISOString(),
      stories: {
        [String(story.id)]: cleanPayload,
      },
    }, { merge: true });

    // Save to memory cache
    saveToLocalCache(story.id, story);

    // Update metadata
    const currentMeta = (await fetchStoriesMeta(true)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    currentMeta.stories[String(story.id)] = {
      id: story.id,
      name: story.name,
      kana: story.kana,
      motif: story.motif,
      week_title: story.week_info?.week_title,
      daysCount: story.week_info?.days?.length || 0,
      updatedAt: new Date().toISOString(),
    };
    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    currentMeta.version = (currentMeta.version || 1) + 1;

    setLocalStoriesMeta(currentMeta);

    return { success: true };
  } catch (err: any) {
    console.error('Failed to save single story:', err);
    return { success: false, error: err?.message || '保存に失敗しました' };
  }
}

/**
 * Deletes a story from Firestore and updates the metadata index.
 */
export async function deleteStoryFromFirestore(nyanId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    const docRef = doc(db, 'nyanko_stories', String(nyanId));
    await deleteDoc(docRef);

    removeFromLocalCache(nyanId);

    // Update metadata
    const currentMeta = await fetchStoriesMeta(true);
    if (currentMeta && currentMeta.stories) {
      delete currentMeta.stories[String(nyanId)];
      currentMeta.storyCount = Object.keys(currentMeta.stories).length;
      currentMeta.updatedAt = Date.now();
      currentMeta.version = (currentMeta.version || 1) + 1;

      const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
      await setDoc(metaRef, currentMeta);
      setLocalStoriesMeta(currentMeta);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete story:', err);
    return { success: false, error: err?.message || '削除に失敗しました' };
  }
}

export interface RebuildProgress {
  id: number;
  name: string;
  current: number;
  total: number;
}

export interface RebuildResult {
  success: boolean;
  totalCount: number;
  syncedNyans: { id: number; name: string; title: string; daysCount: number }[];
  meta?: NyankoStoriesMeta;
  error?: string;
}

/**
 * Re-scans all existing stories in Firestore collection `nyanko_stories`,
 * rebuilds the `nyanko_stories_meta` lightweight index document, and saves it.
 * Calls `onProgress` for each synced nyan to support live UI updates.
 */
export async function rebuildStoriesMetaFromFirestore(
  onProgress?: (progress: RebuildProgress) => void
): Promise<RebuildResult> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return {
        success: false,
        totalCount: 0,
        syncedNyans: [],
        error: 'Firebaseデータベースに接続できません',
      };
    }

    const storiesCol = collection(db, 'nyanko_stories');
    const snapshot = await getDocs(storiesCol);

    if (snapshot.empty) {
      return {
        success: true,
        totalCount: 0,
        syncedNyans: [],
      };
    }

    const total = snapshot.size;
    const storiesMap: Record<string, StoryIndexItem> = {};
    const syncedNyans: { id: number; name: string; title: string; daysCount: number }[] = [];

    let current = 0;
    for (const docSnap of snapshot.docs) {
      current++;
      const data = docSnap.data();
      const id = Number(data.id || docSnap.id);
      const name = data.name || `にゃんこ No.${id}`;
      const title = data.week_info?.week_title || data.title || '';
      const daysCount = Array.isArray(data.week_info?.days) ? data.week_info.days.length : 0;

      storiesMap[String(id)] = {
        id,
        name,
        kana: data.kana,
        motif: data.motif,
        week_title: title,
        daysCount,
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      syncedNyans.push({ id, name, title, daysCount });

      if (onProgress) {
        onProgress({ id, name, current, total });
      }
    }

    // Sort syncedNyans by id ascending
    syncedNyans.sort((a, b) => a.id - b.id);

    const meta: NyankoStoriesMeta = {
      version: Date.now(),
      updatedAt: Date.now(),
      storyCount: Object.keys(storiesMap).length,
      stories: storiesMap,
    };

    // Save to Firestore kenchiko_world/nyanko_stories_meta
    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    await setDoc(metaRef, meta);

    // Save to local cache
    setLocalStoriesMeta(meta);

    return {
      success: true,
      totalCount: syncedNyans.length,
      syncedNyans,
      meta,
    };
  } catch (err: any) {
    console.error('Failed to rebuild stories meta:', err);
    return {
      success: false,
      totalCount: 0,
      syncedNyans: [],
      error: err?.message || '目録の再構築に失敗しました',
    };
  }
}

/**
 * Fetches archived stories that were not matched to the current master nyans (legacy list).
 */
export async function fetchUnmappedStoriesArchive(): Promise<{
  success: boolean;
  stories: { oldId: string; name: string; motif?: string; title?: string; daysCount: number }[];
  error?: string;
}> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, stories: [], error: 'Firebaseデータベースに接続できません' };
    }

    // Check consolidated unmapped document first (1 single Read)
    const docRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_UNMAPPED_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const storiesMap = data.stories || {};
      const list = Object.entries(storiesMap).map(([idKey, raw]: [string, any]) => ({
        oldId: idKey,
        name: raw.name || '',
        motif: raw.motif || '',
        title: raw.week_info?.week_title || raw.title || '',
        daysCount: Array.isArray(raw.week_info?.days) ? raw.week_info.days.length : 0,
      }));
      list.sort((a, b) => (Number(a.oldId) || 0) - (Number(b.oldId) || 0));
      return { success: true, stories: list };
    }

    // Fallback to legacy collection if consolidated doc does not exist yet
    const colRef = collection(db, 'nyanko_stories_unmapped');
    const legacySnap = await getDocs(colRef);
    const list = legacySnap.docs.map((d) => {
      const data = d.data();
      return {
        oldId: d.id,
        name: data.name || '',
        motif: data.motif || '',
        title: data.week_info?.week_title || data.title || '',
        daysCount: Array.isArray(data.week_info?.days) ? data.week_info.days.length : 0,
      };
    });

    list.sort((a, b) => Number(a.oldId) - Number(b.oldId));
    return { success: true, stories: list };
  } catch (err: any) {
    console.error('Failed to fetch unmapped stories archive:', err);
    return { success: false, stories: [], error: err?.message || '取得に失敗しました' };
  }
}

/**
 * Fetches full story detail from the unmapped stories archive.
 */
export async function fetchUnmappedStoryFull(oldId: string): Promise<NyankoStory | null> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) return null;
    const snap = await getDoc(doc(db, 'nyanko_stories_unmapped', oldId));
    if (snap.exists()) {
      return snap.data() as NyankoStory;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch unmapped story detail:', err);
    return null;
  }
}

/**
 * Saves current metadata to Firestore once (1 write operation).
 */
export async function saveStoriesMetaDoc(meta: NyankoStoriesMeta): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) return { success: false, error: 'Firebaseデータベースに接続できません' };

    const metaPayload = {
      ...meta,
      updatedAt: Date.now(),
      version: (meta.version || 1) + 1,
    };

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    await setDoc(metaRef, metaPayload);
    setLocalStoriesMeta(metaPayload);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save stories meta doc:', err);
    return { success: false, error: err?.message || '目録の保存に失敗しました' };
  }
}

/**
 * Assigns an archived unmapped story directly to a target master nyan,
 * saves it into nyanko_stories, removes it from archive, and updates metadata.
 * Set syncMetaToFirestore: false during batch or continuous single edits to save writes!
 */
export async function assignUnmappedStoryToNyan(
  oldId: string,
  targetNyan: { no: number; name: string; reading?: string; motif?: string },
  options: {
    renameToMasterName?: boolean;
    deleteFromArchive?: boolean;
    syncMetaToFirestore?: boolean;
  } = { renameToMasterName: true, deleteFromArchive: true, syncMetaToFirestore: false }
): Promise<{ success: boolean; error?: string; updatedMeta?: NyankoStoriesMeta }> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    const unmappedRef = doc(db, 'nyanko_stories_unmapped', oldId);
    const unmappedSnap = await getDoc(unmappedRef);
    if (!unmappedSnap.exists()) {
      return { success: false, error: `保管庫にID ${oldId} の物語が見つかりません` };
    }
    const rawData = unmappedSnap.data();

    const finalName = options.renameToMasterName !== false ? targetNyan.name : (rawData.name || targetNyan.name);
    const updatedPayload: any = {
      ...rawData,
      id: targetNyan.no,
      name: finalName,
      storyOriginalName: rawData.name || '',
      motif: targetNyan.motif || rawData.motif || '',
      kana: targetNyan.reading || rawData.kana || '',
      updatedAt: new Date().toISOString(),
    };
    delete updatedPayload.oldDocId;
    delete updatedPayload.archivedAt;
    delete updatedPayload.reason;

    // Save to nyanko_stories (1 Write)
    const targetDocRef = doc(db, 'nyanko_stories', String(targetNyan.no));
    await setDoc(targetDocRef, updatedPayload);

    // Optionally delete from nyanko_stories_unmapped (1 Write)
    if (options.deleteFromArchive !== false) {
      await deleteDoc(unmappedRef);
    }

    // Save to local cache immediately
    saveToLocalCache(targetNyan.no, updatedPayload);

    // Update metadata index in memory & local storage
    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    const title = updatedPayload.week_info?.week_title || updatedPayload.title || '';
    const daysCount = Array.isArray(updatedPayload.week_info?.days) ? updatedPayload.week_info.days.length : 0;

    currentMeta.stories[String(targetNyan.no)] = {
      id: targetNyan.no,
      name: finalName,
      kana: updatedPayload.kana || '',
      motif: updatedPayload.motif || '',
      week_title: title,
      daysCount,
      updatedAt: updatedPayload.updatedAt,
    };
    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    currentMeta.version = (currentMeta.version || 1) + 1;

    setLocalStoriesMeta(currentMeta);

    // Only write to Firestore meta doc if explicitly requested (default is false to conserve quota)
    if (options.syncMetaToFirestore) {
      const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
      await setDoc(metaRef, currentMeta);
    }

    return { success: true, updatedMeta: currentMeta };
  } catch (err: any) {
    console.error('Failed to assign unmapped story:', err);
    return { success: false, error: err?.message || '割り付け登録に失敗しました' };
  }
}

/**
 * Saves one or multiple stories directly into the consolidated unmapped archive document in Firestore.
 * EXACTLY 1 Write operation regardless of how many stories are included.
 */
export async function saveStoriesToUnmappedArchive(
  stories: (NyankoStory | any)[]
): Promise<{ success: boolean; count: number; savedIds: string[]; error?: string }> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, count: 0, savedIds: [], error: 'Firebaseデータベースに接続できません' };
    }

    const savedIds: string[] = [];
    const storiesMap: Record<string, any> = {};

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      const validItem = normalizeStoryItem(story);
      if (!validItem) continue;

      const docId = String(story.oldId || (story.id && story.id !== 9999 ? story.id : `unmapped_${story.name || i}_${Date.now()}`));
      const payload = {
        ...validItem,
        oldDocId: docId,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storiesMap[docId] = payload;
      savedIds.push(docId);
    }

    if (savedIds.length > 0) {
      // Consolidated write to single global unmapped document (1 Write)
      const docRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_UNMAPPED_DOC_ID);
      await setDoc(docRef, {
        updatedAt: new Date().toISOString(),
        count: savedIds.length,
        stories: storiesMap,
      }, { merge: true });

      console.log(`[NyankoStory] 💾 未紐づけ保管庫への一括保存完了 [わずか1回書き込み]: ${savedIds.length}件を ${GLOBAL_UNMAPPED_DOC_ID} に統合`);
    }

    return { success: true, count: savedIds.length, savedIds };
  } catch (err: any) {
    console.error('Failed to save to unmapped archive batch:', err);
    return { success: false, count: 0, savedIds: [], error: err?.message || '未紐づけ保管庫への一括投入に失敗しました' };
  }
}



