import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { getFirestoreDbInstance } from './firebaseSync';
import { NyankoStory } from '../types';

// In-memory runtime cache: prevents duplicate Firestore reads during the session
const storyMemoryCache = new Map<number, NyankoStory>();

// Storage key prefix for session storage
const SESSION_CACHE_KEY_PREFIX = 'kenchiko_story_cache_v2_';

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
    } catch {
      // Ignore session storage errors
    }
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
    } catch {
      // Ignore quota exceeded in session storage
    }
  }
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
 */
export async function uploadStoriesJsonToFirestore(
  jsonData: Record<string, any> | any[],
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
  try {
    const db = getFirestoreDbInstance();
    if (!db) {
      return { success: false, totalUploaded: 0, error: 'Firebase is not initialized' };
    }

    const entries: any[] = Array.isArray(jsonData) ? jsonData : Object.values(jsonData);
    const total = entries.length;
    if (total === 0) {
      return { success: false, totalUploaded: 0, error: 'データが空です' };
    }

    const BATCH_SIZE = 40;
    let uploaded = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item || !item.id) continue;
        const docRef = doc(db, 'nyanko_stories', String(item.id));
        const cleanPayload = JSON.parse(JSON.stringify({
          ...item,
          updatedAt: new Date().toISOString(),
        }));
        batch.set(docRef, cleanPayload);
      }

      await batch.commit();
      uploaded += chunk.length;

      // Update in-memory cache
      for (const item of chunk) {
        if (item && item.id) {
          saveToLocalCache(item.id, item as NyankoStory);
        }
      }

      if (onProgress) {
        onProgress({
          current: Math.min(uploaded, total),
          total,
          percent: Math.round((Math.min(uploaded, total) / total) * 100),
        });
      }
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: any) {
    console.error('Failed to upload stories JSON:', err);
    return { success: false, totalUploaded: 0, error: err?.message || 'アップロードに失敗しました' };
  }
}
