import { doc, collection, deleteField } from 'firebase/firestore';
import {
  auditedGetDoc as getDoc,
  auditedSetDoc as setDoc,
  auditedDeleteDoc as deleteDoc,
  auditedWriteBatch as writeBatch,
  isFirestoreQuotaExhausted,
} from './firestoreTrafficLogger';
import { getFirestoreDbInstance, recordFirestoreWrite } from './firebaseSync';
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
const LOCAL_STORY_KEY_PREFIX = 'kenchiko_story_data_v1_';
const SESSION_CACHE_KEY_PREFIX = 'kenchiko_story_cache_v2_';
const LOCAL_STORIES_META_KEY = 'kenchiko_stories_meta_v1';
const FIRESTORE_COLLECTION = 'kenchiko_world';
const STORIES_META_DOC_ID = 'nyanko_stories_meta';
export const GLOBAL_STORIES_DOC_ID = 'ken-chiko-global-stories';
export const GLOBAL_UNMAPPED_DOC_ID = 'ken-chiko-global-unmapped-stories';

/**
 * Retrieves cached story from memory, sessionStorage, or localStorage (persistent)
 */
export function getFromLocalCache(nyanId: number): NyankoStory | null {
  if (storyMemoryCache.has(nyanId)) {
    return storyMemoryCache.get(nyanId)!;
  }
  if (typeof window !== 'undefined') {
    // 1. Check persistent localStorage
    if (window.localStorage) {
      try {
        const raw = localStorage.getItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as NyankoStory;
          storyMemoryCache.set(nyanId, parsed);
          return parsed;
        }
      } catch {}
    }
    // 2. Check sessionStorage
    if (window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as NyankoStory;
          storyMemoryCache.set(nyanId, parsed);
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Saves story to memory, sessionStorage, and persistent localStorage
 */
export function saveToLocalCache(nyanId: number, story: NyankoStory): void {
  storyMemoryCache.set(nyanId, story);
  if (typeof window !== 'undefined') {
    if (window.localStorage) {
      try {
        localStorage.setItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`, JSON.stringify(story));
      } catch {}
    }
    if (window.sessionStorage) {
      try {
        sessionStorage.setItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`, JSON.stringify(story));
      } catch {}
    }
  }
}

/**
 * Removes story from all local caches
 */
export function removeFromLocalCache(nyanId: number): void {
  storyMemoryCache.delete(nyanId);
  if (typeof window !== 'undefined') {
    if (window.localStorage) {
      try {
        localStorage.removeItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`);
      } catch {}
    }
    if (window.sessionStorage) {
      try {
        sessionStorage.removeItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
      } catch {}
    }
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

let lastStoryMetaFetchTime = 0;
const STORY_META_CACHE_TTL = 300000; // 5 minutes cache

/**
 * Fetches the lightweight stories metadata index from Firestore (1 Read operation).
 * Tells the app exactly which nyans have registered stories across the entire roster.
 */
export async function fetchStoriesMeta(force: boolean = false): Promise<NyankoStoriesMeta | null> {
  const now = Date.now();
  if (!force) {
    const local = getLocalStoriesMeta();
    if (local && (now - lastStoryMetaFetchTime < STORY_META_CACHE_TTL || (local.storyCount > 0 && Object.keys(local.stories || {}).length > 0))) {
      return local;
    }
  }

  if (isFirestoreQuotaExhausted()) {
    return getLocalStoriesMeta();
  }

  try {
    const db = getFirestoreDbInstance();
    if (!db) return getLocalStoriesMeta();

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    const snap = await getDoc(metaRef, 'fetchStoriesMeta');
    lastStoryMetaFetchTime = Date.now();
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

    // Case 0: GEMINI weekly format with shared week_info & characters dictionary or array
    const charactersMap = parsed.characters || parsed.character_list || parsed.cats;
    if (charactersMap && typeof charactersMap === 'object') {
      const sharedWeekInfo = parsed.week_info && typeof parsed.week_info === 'object' ? parsed.week_info : undefined;

      const charEntries: [string, any][] = Array.isArray(charactersMap)
        ? charactersMap.map((c: any, idx: number) => [c?.name || `character_${idx}`, c])
        : Object.entries(charactersMap);

      for (const [key, val] of charEntries) {
        if (!val || typeof val !== 'object') continue;
        const charObj: any = val;

        // If character's week_info is just a string (e.g. "9月 第2週..."), or missing/has no days, inherit sharedWeekInfo
        let resolvedWeekInfo = charObj.week_info;
        if (
          typeof resolvedWeekInfo === 'string' ||
          !resolvedWeekInfo ||
          !Array.isArray(resolvedWeekInfo.days) ||
          resolvedWeekInfo.days.length === 0
        ) {
          if (sharedWeekInfo) {
            resolvedWeekInfo = {
              ...sharedWeekInfo,
              week_title:
                typeof charObj.week_info === 'string'
                  ? charObj.week_info
                  : (sharedWeekInfo.week_title || ''),
            };
          }
        }

        const itemToNormalize = {
          ...charObj,
          name: charObj.name || charObj.character_name || key,
          week_info: resolvedWeekInfo,
        };

        const validItem = normalizeStoryItem(itemToNormalize);
        if (validItem) {
          result.push(validItem);
        }
      }

      if (result.length > 0) {
        result.sort((a, b) => a.id - b.id);
        return { valid: true, stories: result };
      }
    }

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
 * Helper to compute whether two story objects are content-identical (excluding timestamps)
 */
function isStoryContentEqual(a: NyankoStory, b: NyankoStory): boolean {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  if (a.name !== b.name) return false;
  if ((a.kana || '') !== (b.kana || '')) return false;
  if ((a.motif || '') !== (b.motif || '')) return false;
  if ((a.title || '') !== (b.title || '')) return false;
  if ((a.storyOriginalName || '') !== (b.storyOriginalName || '')) return false;

  const wA = a.week_info;
  const wB = b.week_info;
  if (!wA && !wB) return true;
  if (!wA || !wB) return false;

  if (wA.week_title !== wB.week_title) return false;
  if (wA.week_start !== wB.week_start) return false;
  if (wA.week_end !== wB.week_end) return false;

  const daysA = wA.days || [];
  const daysB = wB.days || [];
  if (daysA.length !== daysB.length) return false;

  for (let i = 0; i < daysA.length; i++) {
    const dA = daysA[i];
    const dB = daysB[i];
    if (dA.date_header !== dB.date_header) return false;
    const msgsA = dA.messages || [];
    const msgsB = dB.messages || [];
    if (msgsA.length !== msgsB.length) return false;
    for (let j = 0; j < msgsA.length; j++) {
      if (msgsA[j].time !== msgsB[j].time) return false;
      if (msgsA[j].sender !== msgsB[j].sender) return false;
      if (msgsA[j].body !== msgsB[j].body) return false;
    }
  }

  return true;
}

/**
 * Uploads or updates stories from a raw JSON object to Firestore.
 * Performs differential synchronization:
 *  - Compares against local cache or catalog to skip identical stories.
 *  - If all incoming stories are identical to cached versions, 0 Firestore writes occur.
 *  - Only altered or newly added stories are merged into the global document.
 */
export async function uploadStoriesJsonToFirestore(
  jsonData: Record<string, any> | any[] | string,
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<{ success: boolean; totalUploaded: number; skippedCount: number; writtenCount: number; error?: string }> {
  try {
    const parseRes = parseStoryInputJson(jsonData);
    if (!parseRes.valid || parseRes.stories.length === 0) {
      return { success: false, totalUploaded: 0, skippedCount: 0, writtenCount: 0, error: parseRes.error || 'データが空です' };
    }

    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, totalUploaded: 0, skippedCount: 0, writtenCount: 0, error: 'Firebase is not initialized' };
    }

    const stories = parseRes.stories;
    const total = stories.length;

    // Fetch or prepare current metadata
    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    // 1. Identify which stories actually need updating by checking cached story contents
    const changedStoriesMap: Record<string, NyankoStory> = {};
    let skippedCount = 0;

    for (let i = 0; i < total; i++) {
      const item = stories[i];
      const existingCached = getFromLocalCache(item.id);

      const isUnchanged = existingCached && isStoryContentEqual(existingCached, item);

      if (isUnchanged) {
        skippedCount++;
      } else {
        const cleanPayload: NyankoStory = JSON.parse(JSON.stringify({
          ...item,
          updatedAt: new Date().toISOString(),
        }));
        changedStoriesMap[String(item.id)] = cleanPayload;

        // Update local memory and persistent cache immediately
        saveToLocalCache(item.id, cleanPayload);

        // Update meta map for the changed story
        currentMeta.stories[String(item.id)] = {
          id: item.id,
          name: item.name,
          kana: item.kana,
          motif: item.motif,
          week_title: item.week_info?.week_title,
          daysCount: item.week_info?.days?.length || 0,
          updatedAt: new Date().toISOString(),
        };
      }

      if (onProgress && (i % 10 === 0 || i === total - 1)) {
        onProgress({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
        });
      }
    }

    const changedCount = Object.keys(changedStoriesMap).length;

    // If no stories were changed or added, completely skip Firestore write
    if (changedCount === 0) {
      console.log(`[NyankoStory] ⏭️ 全${total}件の物語データは変更なし（キャッシュと完全一致）。Firestore書込を0回でスキップしました。`);
      return {
        success: true,
        totalUploaded: total,
        skippedCount,
        writtenCount: 0,
      };
    }

    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    currentMeta.version = (currentMeta.version || 1) + 1;

    // Atomic Batch Write: commits only the differential changes and metadata in a single atomic operation
    const batch = writeBatch(db);
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    batch.set(globalStoriesRef, {
      version: currentMeta.version,
      updatedAt: new Date().toISOString(),
      storyCount: currentMeta.storyCount,
      stories: changedStoriesMap,
    }, { merge: true });

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    batch.set(metaRef, currentMeta);

    await batch.commit();
    recordFirestoreWrite('kenchiko_world/stories_batch_diff', 2);
    setLocalStoriesMeta(currentMeta);

    console.log(`[NyankoStory] 💾 差分物語保存完了: 全${total}件中 ${changedCount}件更新 / ${skippedCount}件スキップ (書き込み2回: データ統合+目録)`);

    return {
      success: true,
      totalUploaded: total,
      skippedCount,
      writtenCount: changedCount,
    };
  } catch (err: any) {
    console.error('Failed to upload stories JSON:', err);
    return { success: false, totalUploaded: 0, skippedCount: 0, writtenCount: 0, error: err?.message || 'アップロードに失敗しました' };
  }
}

/**
 * Saves a single story to Firestore and updates the metadata index with differential check.
 */
export async function saveSingleStoryToFirestore(story: NyankoStory): Promise<{
  success: boolean;
  skipped?: boolean;
  error?: string;
}> {
  try {
    // Check if unchanged
    const existing = getFromLocalCache(story.id);
    if (existing && isStoryContentEqual(existing, story)) {
      console.log(`[NyankoStory] ⏭️ No.${story.id}「${story.name}」は変更がないためFirestore書き込みをスキップ`);
      return { success: true, skipped: true };
    }

    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, error: 'Firebaseデータベースに接続できません' };
    }

    const cleanPayload = JSON.parse(JSON.stringify({
      ...story,
      updatedAt: new Date().toISOString(),
    }));

    // Update metadata
    const currentMeta = (await fetchStoriesMeta(false)) || {
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

    // Atomic write to global stories document & meta document in 1 batch
    const batch = writeBatch(db);
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    batch.set(globalStoriesRef, {
      updatedAt: new Date().toISOString(),
      stories: {
        [String(story.id)]: cleanPayload,
      },
    }, { merge: true });

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    batch.set(metaRef, currentMeta);

    await batch.commit();
    recordFirestoreWrite(`kenchiko_world/${GLOBAL_STORIES_DOC_ID}`, 2);

    // Save to local cache
    saveToLocalCache(story.id, story);
    setLocalStoriesMeta(currentMeta);

    return { success: true, skipped: false };
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

    const batch = writeBatch(db);

    // 1. Remove from global stories consolidated document using deleteField()
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    batch.update(globalStoriesRef, {
      updatedAt: new Date().toISOString(),
      [`stories.${nyanId}`]: deleteField(),
    });

    removeFromLocalCache(nyanId);

    // 2. Update metadata document in the same batch
    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };
    if (currentMeta && currentMeta.stories) {
      delete currentMeta.stories[String(nyanId)];
      currentMeta.storyCount = Object.keys(currentMeta.stories).length;
      currentMeta.updatedAt = Date.now();
      currentMeta.version = (currentMeta.version || 1) + 1;

      const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
      batch.set(metaRef, currentMeta);
      setLocalStoriesMeta(currentMeta);
    }

    await batch.commit();
    recordFirestoreWrite('kenchiko_world/stories_delete', 2);

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

    const storiesMap: Record<string, StoryIndexItem> = {};
    const syncedNyans: { id: number; name: string; title: string; daysCount: number }[] = [];

    // 1. Check consolidated global document first (1 single read)
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
    const globalSnap = await getDoc(globalStoriesRef);
    if (globalSnap.exists()) {
      const gData = globalSnap.data();
      const globalStories = (gData.stories || {}) as Record<string, NyankoStory>;
      const entries = Object.entries(globalStories);
      let current = 0;
      for (const [key, val] of entries) {
        current++;
        const id = Number(val.id || key);
        if (isNaN(id)) continue;
        const name = val.name || `にゃんこ No.${id}`;
        const title = val.week_info?.week_title || val.title || '';
        const daysCount = Array.isArray(val.week_info?.days) ? val.week_info.days.length : 0;

        storiesMap[String(id)] = {
          id,
          name,
          kana: val.kana,
          motif: val.motif,
          week_title: title,
          daysCount,
          updatedAt: val.updatedAt || new Date().toISOString(),
        };

        saveToLocalCache(id, val);
        syncedNyans.push({ id, name, title, daysCount });
        if (onProgress) {
          onProgress({ id, name, current, total: entries.length });
        }
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
    recordFirestoreWrite(`kenchiko_world/${STORIES_META_DOC_ID}`, 1);

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

    // If global unmapped index does not exist or is empty, return empty list.
    // Legacy collection fallback logic has been disabled to prevent runaway reads.
    return { success: true, stories: [] };
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
    recordFirestoreWrite(`kenchiko_world/${STORIES_META_DOC_ID}`, 1);
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

    let rawData: any = null;

    // 1. First check unmapped archive collection
    const unmappedRef = doc(db, 'nyanko_stories_unmapped', oldId);
    const unmappedSnap = await getDoc(unmappedRef);
    if (unmappedSnap.exists()) {
      rawData = unmappedSnap.data();
    } else {
      // 2. Check global stories document
      const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);
      const globalSnap = await getDoc(globalStoriesRef);
      if (globalSnap.exists()) {
        const storiesMap = globalSnap.data()?.stories || {};
        if (storiesMap[oldId]) {
          rawData = storiesMap[oldId];
        }
      }

      // 3. Check legacy collection
      if (!rawData) {
        const legacyRef = doc(db, 'nyanko_stories', oldId);
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          rawData = legacySnap.data();
        }
      }
    }

    if (!rawData) {
      return { success: false, error: `ID ${oldId} の物語データが見つかりませんでした` };
    }

    const finalName = options.renameToMasterName !== false ? targetNyan.name : (rawData.name || targetNyan.name);
    const updatedPayload: any = {
      ...rawData,
      id: targetNyan.no,
      name: finalName,
      storyOriginalName: rawData.name || rawData.storyOriginalName || '',
      motif: targetNyan.motif || rawData.motif || '',
      kana: targetNyan.reading || rawData.kana || '',
      updatedAt: new Date().toISOString(),
    };
    delete updatedPayload.oldDocId;
    delete updatedPayload.archivedAt;
    delete updatedPayload.reason;

    // Update global document atomically with writeBatch
    const batch = writeBatch(db);
    const globalStoriesRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_STORIES_DOC_ID);

    // Save to local cache
    saveToLocalCache(targetNyan.no, updatedPayload);

    // Update metadata index
    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    const title = updatedPayload.week_info?.week_title || updatedPayload.title || '';
    const daysCount = Array.isArray(updatedPayload.week_info?.days) ? updatedPayload.week_info.days.length : 0;

    // Remove oldId key if different from targetNyan.no
    if (String(oldId) !== String(targetNyan.no) && currentMeta.stories[oldId]) {
      delete currentMeta.stories[oldId];
    }

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

    // Save consolidated story update in batch
    batch.set(globalStoriesRef, {
      updatedAt: new Date().toISOString(),
      stories: {
        [String(targetNyan.no)]: updatedPayload,
      },
    }, { merge: true });

    // Save metadata in batch
    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    batch.set(metaRef, currentMeta);

    // If deleting from unmapped collection
    if (options.deleteFromArchive !== false) {
      if (unmappedSnap.exists()) {
        batch.delete(unmappedRef);
      }
      // Also remove from consolidated global unmapped document
      const globalUnmappedRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_UNMAPPED_DOC_ID);
      batch.set(globalUnmappedRef, {
        updatedAt: new Date().toISOString(),
        stories: {
          [oldId]: deleteField(),
        }
      }, { merge: true });
    }

    await batch.commit();
    recordFirestoreWrite('kenchiko_world/story_assign', 2);

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
      recordFirestoreWrite(`kenchiko_world/${GLOBAL_UNMAPPED_DOC_ID}`, 1);

      console.log(`[NyankoStory] 💾 未紐づけ保管庫への一括保存完了 [わずか1回書き込み]: ${savedIds.length}件を ${GLOBAL_UNMAPPED_DOC_ID} に統合`);
    }

    return { success: true, count: savedIds.length, savedIds };
  } catch (err: any) {
    console.error('Failed to save to unmapped archive batch:', err);
    return { success: false, count: 0, savedIds: [], error: err?.message || '未紐づけ保管庫への一括投入に失敗しました' };
  }
}

/**
 * Deletes a story from the unmapped archive consolidated document.
 */
export async function deleteFromUnmappedArchive(oldId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) return { success: false, error: 'Firebaseデータベースに接続できません' };

    const batch = writeBatch(db);
    const docRef = doc(db, FIRESTORE_COLLECTION, GLOBAL_UNMAPPED_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const storiesMap = { ...(data.stories || {}) };
      delete storiesMap[oldId];
      batch.set(docRef, {
        updatedAt: new Date().toISOString(),
        count: Object.keys(storiesMap).length,
        stories: storiesMap,
      });
    }

    // Also remove from legacy collection if it exists
    const legacyRef = doc(db, 'nyanko_stories_unmapped', oldId);
    batch.delete(legacyRef);

    await batch.commit();
    recordFirestoreWrite('kenchiko_world/unmapped_delete', 1);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete from unmapped archive:', err);
    return { success: false, error: err?.message || '削除に失敗しました' };
  }
}




