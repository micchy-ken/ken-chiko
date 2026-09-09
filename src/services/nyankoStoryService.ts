import { doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
    if (local) return local;
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
 * 1. Keyed object format: { "かがみもちにゃん": { id: 1, ... } }
 * 2. Array format: [ { id: 1, ... }, ... ]
 * 3. Single object format: { id: 1, ... }
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
      parsed = JSON.parse(trimmed);
    }

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, stories: [], error: '無効なJSONオブジェクトです' };
    }

    const result: NyankoStory[] = [];

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') {
          const validItem = normalizeStoryItem(item);
          if (validItem) result.push(validItem);
        }
      }
    } else if (parsed.id !== undefined && parsed.name) {
      // Single story object
      const validItem = normalizeStoryItem(parsed);
      if (validItem) result.push(validItem);
    } else {
      // Keyed dictionary: { "名前": { id: 1, ... } }
      for (const [key, val] of Object.entries(parsed)) {
        if (val && typeof val === 'object') {
          const itemWithFallback = {
            ...(val as any),
            name: (val as any).name || key,
          };
          const validItem = normalizeStoryItem(itemWithFallback);
          if (validItem) result.push(validItem);
        }
      }
    }

    if (result.length === 0) {
      return {
        valid: false,
        stories: [],
        error: '有効な物語データ（idとnameを含むデータ）が見つかりませんでした',
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
 * Helper to normalize and validate a single story item
 */
function normalizeStoryItem(raw: any): NyankoStory | null {
  const rawId = raw.id ?? raw.no;
  const numId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
  if (isNaN(numId) || numId <= 0) return null;

  const name = String(raw.name || raw.character_name || '').trim();
  if (!name) return null;

  const days: any[] = Array.isArray(raw.week_info?.days)
    ? raw.week_info.days
    : Array.isArray(raw.days)
    ? raw.days
    : [];

  return {
    id: numId,
    name,
    kana: raw.kana || undefined,
    motif: raw.motif || undefined,
    debut_date: raw.debut_date || undefined,
    voice: raw.voice || undefined,
    translation: raw.translation || undefined,
    episode_summary: raw.episode_summary || raw.summary || undefined,
    prompt_ja: raw.prompt_ja || undefined,
    prompt_en: raw.prompt_en || undefined,
    doc_link: raw.doc_link || undefined,
    week_info: {
      week_title: raw.week_info?.week_title || raw.week_title || '',
      week_start: raw.week_info?.week_start || raw.week_start || '',
      week_end: raw.week_info?.week_end || raw.week_end || '',
      days: days.map((d: any) => ({
        date_header: String(d.date_header || d.date || ''),
        messages: Array.isArray(d.messages)
          ? d.messages.map((m: any) => ({
              time: String(m.time || ''),
              sender: String(m.sender || ''),
              body: String(m.body || ''),
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

    const docRef = doc(db, 'nyanko_stories', String(nyanId));
    const snap = await getDoc(docRef);

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
 * Uploads or updates stories from a raw JSON object to Firestore in batches.
 * Automatically synchronizes the nyanko_stories_meta index document.
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
    const BATCH_SIZE = 40;
    let uploaded = 0;

    // Fetch or prepare current metadata
    const currentMeta = (await fetchStoriesMeta(true)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = stories.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const docRef = doc(db, 'nyanko_stories', String(item.id));
        const cleanPayload = JSON.parse(JSON.stringify({
          ...item,
          updatedAt: new Date().toISOString(),
        }));
        batch.set(docRef, cleanPayload);

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
      }

      await batch.commit();
      uploaded += chunk.length;

      // Update in-memory cache
      for (const item of chunk) {
        saveToLocalCache(item.id, item);
      }

      if (onProgress) {
        onProgress({
          current: Math.min(uploaded, total),
          total,
          percent: Math.round((Math.min(uploaded, total) / total) * 100),
        });
      }
    }

    // Update metadata document in Firestore
    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    currentMeta.version = (currentMeta.version || 1) + 1;

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    await setDoc(metaRef, currentMeta);
    setLocalStoriesMeta(currentMeta);

    return { success: true, totalUploaded: uploaded };
  } catch (err: any) {
    console.error('Failed to upload stories JSON:', err);
    return { success: false, totalUploaded: 0, error: err?.message || 'アップロードに失敗しました' };
  }
}

/**
 * Saves a single story to Firestore and updates the metadata index.
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

    const docRef = doc(db, 'nyanko_stories', String(story.id));
    const cleanPayload = JSON.parse(JSON.stringify({
      ...story,
      updatedAt: new Date().toISOString(),
    }));
    await setDoc(docRef, cleanPayload);

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

    const metaRef = doc(db, FIRESTORE_COLLECTION, STORIES_META_DOC_ID);
    await setDoc(metaRef, currentMeta);
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

