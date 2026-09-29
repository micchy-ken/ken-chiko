import { NyankoStory } from '../types';
import {
  fetchStoryFromPostgrest,
  fetchStoriesMetaFromPostgrest,
  saveSingleStoryToPostgrest,
  saveStoriesToPostgrest,
  deleteStoryFromPostgrest,
} from './postgrestMasterService';
import { isPostgrestEnabled } from './postgrestConfig';

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

// In-memory runtime cache: prevents duplicate network calls during the session
const storyMemoryCache = new Map<number, NyankoStory>();
let cachedStoriesMeta: NyankoStoriesMeta | null = null;

// Storage key prefixes
const LOCAL_STORY_KEY_PREFIX = 'kenchiko_story_data_v1_';
const SESSION_CACHE_KEY_PREFIX = 'kenchiko_story_cache_v2_';
const LOCAL_STORIES_META_KEY = 'kenchiko_stories_meta_v1';
export const GLOBAL_UNMAPPED_STORAGE_KEY = 'kenchiko_unmapped_stories_v1';

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
        const item = window.localStorage.getItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`);
        if (item) {
          const parsed = JSON.parse(item);
          storyMemoryCache.set(nyanId, parsed);
          return parsed;
        }
      } catch {}
    }

    // 2. Check sessionStorage
    if (window.sessionStorage) {
      try {
        const item = window.sessionStorage.getItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
        if (item) {
          const parsed = JSON.parse(item);
          storyMemoryCache.set(nyanId, parsed);
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Saves a story to memory, sessionStorage, and localStorage (persistent)
 */
export function saveToLocalCache(nyanId: number, story: NyankoStory): void {
  storyMemoryCache.set(nyanId, story);
  if (typeof window !== 'undefined') {
    if (window.sessionStorage) {
      try {
        window.sessionStorage.setItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`, JSON.stringify(story));
      } catch {}
    }
    if (window.localStorage) {
      try {
        window.localStorage.setItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`, JSON.stringify(story));
      } catch {}
    }
  }
}

/**
 * Removes a story from memory, sessionStorage, and localStorage
 */
export function removeFromLocalCache(nyanId: number): void {
  storyMemoryCache.delete(nyanId);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.removeItem(`${SESSION_CACHE_KEY_PREFIX}${nyanId}`);
      window.localStorage?.removeItem(`${LOCAL_STORY_KEY_PREFIX}${nyanId}`);
    } catch {}
  }
}

/**
 * Gets cached stories metadata index from localStorage
 */
export function getLocalStoriesMeta(): NyankoStoriesMeta | null {
  if (cachedStoriesMeta) return cachedStoriesMeta;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORIES_META_KEY);
      if (raw) {
        cachedStoriesMeta = JSON.parse(raw);
        return cachedStoriesMeta;
      }
    } catch {}
  }
  return null;
}

/**
 * Sets cached stories metadata index to localStorage and memory
 */
export function setLocalStoriesMeta(meta: NyankoStoriesMeta): void {
  cachedStoriesMeta = meta;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_STORIES_META_KEY, JSON.stringify(meta));
    } catch {}
  }
}

let lastStoryMetaFetchTime = 0;
const STORY_META_CACHE_TTL = 300000; // 5 minutes cache

/**
 * Fetches stories metadata index from Synology PostgREST (or local cache).
 */
export async function fetchStoriesMeta(force: boolean = false): Promise<NyankoStoriesMeta | null> {
  const now = Date.now();
  if (!force) {
    const local = getLocalStoriesMeta();
    if (local && (now - lastStoryMetaFetchTime < STORY_META_CACHE_TTL || (local.storyCount > 0 && Object.keys(local.stories || {}).length > 0))) {
      return local;
    }
  }

  // 1. 🐘 Primary Source: Synology PostgreSQL (master_stories table)
  if (isPostgrestEnabled()) {
    try {
      const pgMeta = await fetchStoriesMetaFromPostgrest();
      if (pgMeta && pgMeta.storyCount > 0) {
        lastStoryMetaFetchTime = Date.now();
        setLocalStoriesMeta(pgMeta);
        return pgMeta;
      }
    } catch (err) {
      console.warn('[Synology] Failed to fetch stories meta from PostgREST:', err);
    }
  }

  // 2. Local cache fallback
  return getLocalStoriesMeta();
}

/**
 * Parse input string or object into a verified list of NyankoStory objects.
 */
export function parseStoryInputJson(raw: any): { valid: boolean; stories: NyankoStory[]; error?: string } {
  try {
    let data = raw;
    if (typeof raw === 'string') {
      data = JSON.parse(raw);
    }

    if (!data) {
      return { valid: false, stories: [], error: 'データが空です' };
    }

    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === 'object') {
      if (Array.isArray((data as any).stories)) {
        items = (data as any).stories;
      } else {
        items = Object.entries(data).map(([key, val]: [string, any]) => {
          if (val && typeof val === 'object') {
            return {
              ...val,
              name: val.name || key,
            };
          }
          return val;
        });
      }
    }

    const result: NyankoStory[] = [];
    for (const item of items) {
      const normalized = normalizeStoryItem(item);
      if (normalized) {
        result.push(normalized);
      }
    }

    return { valid: result.length > 0, stories: result };
  } catch (err: any) {
    return { valid: false, stories: [], error: err?.message || 'JSONの解析に失敗しました' };
  }
}

/**
 * Normalizes an arbitrary object to conform to NyankoStory interface
 */
export function normalizeStoryItem(raw: any): NyankoStory | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = Number(raw.id || raw.character_id || raw.no || raw.nyanId || raw.code || 9999);
  const name = String(raw.name || raw.character_name || raw.nyan_name || raw.title || '').trim();

  if (!name && id === 9999) return null;

  const kana = raw.kana || raw.reading || raw.yomi || '';
  const motif = raw.motif || raw.theme || '';
  const debut_date = raw.debut_date || raw.firstAppeared || raw.debut || '';
  const voice = raw.voice || raw.dialogue || '';
  const translation = raw.translation || raw.dialogueMeaning || raw.dialogue_meaning || '';
  const episode_summary = raw.episode_summary || raw.episode || raw.summary || '';
  const prompt_ja = raw.prompt_ja || raw.promptJa || '';
  const prompt_en = raw.prompt_en || raw.promptEn || '';
  const doc_link = raw.doc_link || raw.docLink || raw.url || '';

  let week_info = raw.week_info;
  if (!week_info && raw.week) {
    week_info = raw.week;
  }
  if (!week_info) {
    week_info = {
      week_title: raw.week_title || raw.title || '',
      days: Array.isArray(raw.days) ? raw.days : [],
    };
  }

  return {
    id,
    name,
    kana,
    motif,
    debut_date,
    voice,
    translation,
    episode_summary,
    prompt_ja,
    prompt_en,
    doc_link,
    week_info,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * Compares two story objects to determine if their content is identical.
 */
function isStoryContentEqual(a: NyankoStory, b: NyankoStory): boolean {
  if (a.id !== b.id) return false;
  if (a.name !== b.name) return false;
  if ((a.kana || '') !== (b.kana || '')) return false;
  if ((a.motif || '') !== (b.motif || '')) return false;
  if ((a.debut_date || '') !== (b.debut_date || '')) return false;
  if ((a.voice || '') !== (b.voice || '')) return false;
  if ((a.translation || '') !== (b.translation || '')) return false;
  if ((a.episode_summary || '') !== (b.episode_summary || '')) return false;
  if ((a.prompt_ja || '') !== (b.prompt_ja || '')) return false;
  if ((a.prompt_en || '') !== (b.prompt_en || '')) return false;
  if ((a.doc_link || '') !== (b.doc_link || '')) return false;

  const aDays = a.week_info?.days || [];
  const bDays = b.week_info?.days || [];
  if (aDays.length !== bDays.length) return false;
  if ((a.week_info?.week_title || '') !== (b.week_info?.week_title || '')) return false;

  return JSON.stringify(a.week_info) === JSON.stringify(b.week_info);
}

/**
 * Fetches the weekly story and dialogue for a specific nyan from Synology PostgREST.
 */
export async function fetchStoryById(
  nyanId: number,
  forceRefresh: boolean = false
): Promise<{ story: NyankoStory | null; fromCache: boolean; error?: string }> {
  // 1. Check local cache
  if (!forceRefresh) {
    const cached = getFromLocalCache(nyanId);
    if (cached) {
      return { story: cached, fromCache: true };
    }
  }

  // 2. Fetch from Synology PostgreSQL
  let errorDetail: string | undefined = undefined;
  if (isPostgrestEnabled()) {
    try {
      const postgrestStory = await fetchStoryFromPostgrest(nyanId);
      if (postgrestStory) {
        saveToLocalCache(nyanId, postgrestStory);
        return { story: postgrestStory, fromCache: false };
      }
    } catch (pgErr: any) {
      errorDetail = pgErr?.message || String(pgErr);
      console.warn(`[Synology] Failed to fetch story for nyan #${nyanId}:`, pgErr);
    }
  }

  const cached = getFromLocalCache(nyanId);
  return { story: cached, fromCache: Boolean(cached), error: errorDetail };
}

export const fetchNyankoStory = fetchStoryById;

/**
 * Uploads or updates stories from a raw JSON object to Synology PostgreSQL.
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

    const stories = parseRes.stories;
    const total = stories.length;

    // Fetch or prepare current metadata
    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

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
        saveToLocalCache(item.id, cleanPayload);

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

    if (changedCount === 0) {
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
    setLocalStoriesMeta(currentMeta);

    // Save to Synology PostgreSQL (api.master_stories)
    if (isPostgrestEnabled()) {
      const pgRes = await saveStoriesToPostgrest(Object.values(changedStoriesMap));
      if (!pgRes.success) {
        return {
          success: false,
          totalUploaded: total,
          skippedCount,
          writtenCount: 0,
          error: pgRes.error,
        };
      }
    }

    console.log(`[NyankoStory] 💾 差分物語保存完了: 全${total}件中 ${changedCount}件更新 / ${skippedCount}件スキップ`);

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
 * Saves a single story to Synology PostgreSQL and updates metadata index.
 */
export async function saveSingleStoryToFirestore(story: NyankoStory): Promise<{
  success: boolean;
  skipped?: boolean;
  error?: string;
}> {
  return saveSingleStoryToSynology(story);
}

export async function saveSingleStoryToSynology(story: NyankoStory): Promise<{
  success: boolean;
  skipped?: boolean;
  error?: string;
}> {
  try {
    const cleanPayload: NyankoStory = JSON.parse(JSON.stringify({
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

    // Save to local cache immediately
    saveToLocalCache(story.id, story);
    setLocalStoriesMeta(currentMeta);

    // Save to Synology PostgreSQL (master_stories)
    if (isPostgrestEnabled()) {
      const pgRes = await saveSingleStoryToPostgrest(cleanPayload);
      if (!pgRes.success) {
        console.warn('[Synology] PostgREST story save failed:', pgRes.error);
        return { success: false, error: pgRes.error };
      }
    }

    return { success: true, skipped: false };
  } catch (err: any) {
    console.error('Failed to save single story:', err);
    return { success: false, error: err?.message || '保存に失敗しました' };
  }
}

/**
 * Deletes a story from Synology PostgreSQL and updates the metadata index.
 */
export async function deleteStoryFromFirestore(nyanId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  return deleteStoryFromSynology(nyanId);
}

export async function deleteStoryFromSynology(nyanId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    removeFromLocalCache(nyanId);

    // 1. Delete from Synology PostgreSQL
    if (isPostgrestEnabled()) {
      const pgRes = await deleteStoryFromPostgrest(nyanId);
      if (!pgRes.success) {
        return { success: false, error: pgRes.error };
      }
    }

    // 2. Update local metadata
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
 * Rebuilds metadata from local storage & Synology.
 */
export async function rebuildStoriesMetaFromFirestore(
  onProgress?: (progress: RebuildProgress) => void
): Promise<RebuildResult> {
  const pgMeta = await fetchStoriesMeta(true);
  if (!pgMeta) {
    return {
      success: false,
      totalCount: 0,
      syncedNyans: [],
      error: '物語目録を取得できませんでした',
    };
  }

  const syncedNyans: { id: number; name: string; title: string; daysCount: number }[] = [];
  const entries = Object.entries(pgMeta.stories || {});
  let cur = 0;
  for (const [idStr, s] of entries) {
    cur++;
    syncedNyans.push({
      id: s.id,
      name: s.name,
      title: s.week_title || '',
      daysCount: s.daysCount || 0,
    });
    if (onProgress) {
      onProgress({ id: s.id, name: s.name, current: cur, total: entries.length });
    }
  }

  syncedNyans.sort((a, b) => a.id - b.id);
  return {
    success: true,
    totalCount: syncedNyans.length,
    syncedNyans,
    meta: pgMeta,
  };
}

/**
 * Fetches archived stories that were not matched to the current master nyans (local archive).
 */
export async function fetchUnmappedStoriesArchive(): Promise<{
  success: boolean;
  stories: { oldId: string; name: string; motif?: string; title?: string; daysCount: number }[];
  error?: string;
}> {
  try {
    const raw = localStorage.getItem(GLOBAL_UNMAPPED_STORAGE_KEY);
    if (!raw) return { success: true, stories: [] };
    const parsed = JSON.parse(raw);
    const list = Object.entries(parsed).map(([k, v]: [string, any]) => ({
      oldId: k,
      name: v.name || '',
      motif: v.motif || '',
      title: v.week_info?.week_title || v.title || '',
      daysCount: Array.isArray(v.week_info?.days) ? v.week_info.days.length : 0,
    }));
    return { success: true, stories: list };
  } catch (err: any) {
    return { success: false, stories: [], error: err?.message || '取得エラー' };
  }
}

/**
 * Fetches full story detail from the unmapped stories archive.
 */
export async function fetchUnmappedStoryFull(oldId: string): Promise<NyankoStory | null> {
  try {
    const raw = localStorage.getItem(GLOBAL_UNMAPPED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[oldId] || null;
  } catch {
    return null;
  }
}

/**
 * Saves current metadata to local storage.
 */
export async function saveStoriesMetaDoc(meta: NyankoStoriesMeta): Promise<{ success: boolean; error?: string }> {
  try {
    setLocalStoriesMeta(meta);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || '目録の保存に失敗しました' };
  }
}

/**
 * Assigns an archived unmapped story directly to a target master nyan,
 * and saves it into Synology PostgreSQL.
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
    const rawUnmapped = await fetchUnmappedStoryFull(oldId);
    if (!rawUnmapped) {
      return { success: false, error: `ID ${oldId} の物語データが見つかりませんでした` };
    }

    const finalName = options.renameToMasterName !== false ? targetNyan.name : (rawUnmapped.name || targetNyan.name);
    const updatedPayload: NyankoStory = {
      ...rawUnmapped,
      id: targetNyan.no,
      name: finalName,
      motif: targetNyan.motif || rawUnmapped.motif || '',
      kana: targetNyan.reading || rawUnmapped.kana || '',
      updatedAt: new Date().toISOString(),
    };

    saveToLocalCache(targetNyan.no, updatedPayload);

    const currentMeta = (await fetchStoriesMeta(false)) || {
      version: 1,
      updatedAt: Date.now(),
      storyCount: 0,
      stories: {},
    };

    currentMeta.stories[String(targetNyan.no)] = {
      id: targetNyan.no,
      name: finalName,
      kana: updatedPayload.kana || '',
      motif: updatedPayload.motif || '',
      week_title: updatedPayload.week_info?.week_title || '',
      daysCount: Array.isArray(updatedPayload.week_info?.days) ? updatedPayload.week_info.days.length : 0,
      updatedAt: updatedPayload.updatedAt,
    };
    currentMeta.storyCount = Object.keys(currentMeta.stories).length;
    currentMeta.updatedAt = Date.now();
    setLocalStoriesMeta(currentMeta);

    if (options.deleteFromArchive !== false) {
      await deleteFromUnmappedArchive(oldId);
    }

    if (isPostgrestEnabled()) {
      const pgRes = await saveSingleStoryToPostgrest(updatedPayload);
      if (!pgRes.success) {
        return { success: false, error: pgRes.error, updatedMeta: currentMeta };
      }
    }

    return { success: true, updatedMeta: currentMeta };
  } catch (err: any) {
    return { success: false, error: err?.message || '割り付け登録に失敗しました' };
  }
}

/**
 * Saves stories directly into the local unmapped archive storage.
 */
export async function saveStoriesToUnmappedArchive(
  stories: (NyankoStory | any)[]
): Promise<{ success: boolean; count: number; savedIds: string[]; error?: string }> {
  try {
    let existingMap: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(GLOBAL_UNMAPPED_STORAGE_KEY);
      if (raw) existingMap = JSON.parse(raw);
    } catch {}

    const savedIds: string[] = [];
    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      const validItem = normalizeStoryItem(story);
      if (!validItem) continue;

      const docId = String(story.oldId || (story.id && story.id !== 9999 ? story.id : `unmapped_${story.name || i}_${Date.now()}`));
      existingMap[docId] = {
        ...validItem,
        oldDocId: docId,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savedIds.push(docId);
    }

    localStorage.setItem(GLOBAL_UNMAPPED_STORAGE_KEY, JSON.stringify(existingMap));
    return { success: true, count: savedIds.length, savedIds };
  } catch (err: any) {
    return { success: false, count: 0, savedIds: [], error: err?.message || '未紐づけ保管庫への保存に失敗しました' };
  }
}

/**
 * Deletes a story from the unmapped archive storage.
 */
export async function deleteFromUnmappedArchive(oldId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const raw = localStorage.getItem(GLOBAL_UNMAPPED_STORAGE_KEY);
    if (!raw) return { success: true };
    const parsed = JSON.parse(raw);
    delete parsed[oldId];
    localStorage.setItem(GLOBAL_UNMAPPED_STORAGE_KEY, JSON.stringify(parsed));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || '削除に失敗しました' };
  }
}
