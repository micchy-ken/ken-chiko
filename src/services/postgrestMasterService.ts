/**
 * postgrestMasterService: Fetches official master data from Synology PostgREST.
 */
import {
  GameMasterData,
  MasterNyanCharacter,
  KenchikoAsobi,
  OuenCategory,
  OuenItem,
  NyankoStory,
} from '../types';
import { getPostgrestBaseUrl, isPostgrestEnabled } from './postgrestConfig';

interface RawPostgrestNyan {
  no: number;
  name: string;
  reading?: string;
  motif?: string;
  first_appeared?: string;
  episode?: string;
  prompt_ja?: string;
  prompt_en?: string;
  dialogue?: string;
  dialogue_meaning?: string;
  has_story?: boolean;
  custom_image_url?: string;
  raw_image_url?: string;
  has_custom_image?: boolean;
  transparency?: any;
  favorite_items?: any;
  favorite_locations?: any;
}

interface RawPostgrestAsobi {
  id: string;
  title: string;
  content?: string;
  condition?: string;
  frequency?: string;
  sort_order?: number;
}

interface RawPostgrestOuenCategory {
  id: string;
  label: string;
  sort_order?: number;
}

interface RawPostgrestOuenItem {
  id: string;
  category_id: string;
  message: string;
  sort_order?: number;
}

interface RawPostgrestStory {
  id: number;
  name: string;
  kana?: string;
  motif?: string;
  week_title?: string;
  debut_date?: string;
  voice?: string;
  translation?: string;
  episode_summary?: string;
  prompt_ja?: string;
  prompt_en?: string;
  doc_link?: string;
  week_info?: any;
  updated_at?: string;
}

function mapRawNyanToMaster(r: RawPostgrestNyan): MasterNyanCharacter {
  return {
    no: Number(r.no),
    name: r.name || '',
    reading: r.reading || '',
    motif: r.motif || '',
    firstAppeared: r.first_appeared || '',
    episode: r.episode || '',
    promptJa: r.prompt_ja || '',
    promptEn: r.prompt_en || '',
    dialogue: r.dialogue || undefined,
    dialogueMeaning: r.dialogue_meaning || undefined,
    hasStory: Boolean(r.has_story),
    customImageUrl: r.custom_image_url || undefined,
    rawImageUrl: r.raw_image_url || undefined,
    hasCustomImage: Boolean(r.has_custom_image),
    transparency: r.transparency || undefined,
    favoriteItems: Array.isArray(r.favorite_items) ? r.favorite_items : undefined,
    favoriteLocations: Array.isArray(r.favorite_locations) ? r.favorite_locations : undefined,
  };
}

export async function fetchMasterNyansFromPostgrest(): Promise<MasterNyanCharacter[] | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_nyans?order=no.asc`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[PostgREST] Failed to fetch master_nyans: HTTP ${res.status}`);
      return null;
    }
    const data: RawPostgrestNyan[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data.map(mapRawNyanToMaster);
  } catch (err) {
    console.warn('[PostgREST] Network error fetching master_nyans:', err);
    return null;
  }
}

export async function fetchMasterAsobiFromPostgrest(): Promise<KenchikoAsobi[] | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_asobi?order=sort_order.asc`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data: RawPostgrestAsobi[] = await res.json();
    if (!Array.isArray(data)) return null;
    return data.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content || '',
      condition: (a.condition as any) || 'all',
      frequency: (a.frequency as any) || 'normal',
      createdAt: Date.now(),
    }));
  } catch {
    return null;
  }
}

export async function fetchMasterOuenFromPostgrest(): Promise<{
  categories: OuenCategory[];
  items: OuenItem[];
} | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const [catRes, itemRes] = await Promise.all([
      fetch(`${baseUrl}/master_ouen_categories?order=sort_order.asc`, { headers: { 'Accept': 'application/json' } }),
      fetch(`${baseUrl}/master_ouen_items?order=sort_order.asc`, { headers: { 'Accept': 'application/json' } }),
    ]);

    if (!catRes.ok || !itemRes.ok) return null;

    const cats: RawPostgrestOuenCategory[] = await catRes.json();
    const items: RawPostgrestOuenItem[] = await itemRes.json();

    return {
      categories: cats.map((c) => ({ id: c.id, label: c.label })),
      items: items.map((i) => ({ id: i.id, categoryId: i.category_id, message: i.message, createdAt: Date.now() })),
    };
  } catch {
    return null;
  }
}

export async function fetchMasterSettingsFromPostgrest(): Promise<Record<string, any> | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_settings`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const list: { key: string; value: any }[] = await res.json();
    const map: Record<string, any> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return map;
  } catch {
    return null;
  }
}

export async function fetchStoryFromPostgrest(nyanId: number): Promise<NyankoStory | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_stories?id=eq.${nyanId}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const list: RawPostgrestStory[] = await res.json();
    if (!list || list.length === 0) return null;
    const r = list[0];
    return {
      id: r.id,
      name: r.name,
      kana: r.kana,
      motif: r.motif,
      debut_date: r.debut_date,
      voice: r.voice,
      translation: r.translation,
      episode_summary: r.episode_summary,
      prompt_ja: r.prompt_ja,
      prompt_en: r.prompt_en,
      doc_link: r.doc_link,
      week_info: r.week_info,
      updatedAt: r.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * High-level loader that pulls all master tables concurrently from PostgREST.
 * Returns null if PostgREST is disabled or unreachable, allowing transparent Firestore fallback.
 */
export async function fetchFullMasterDataFromPostgrest(): Promise<GameMasterData | null> {
  if (!isPostgrestEnabled()) return null;
  try {
    const [nyans, asobi, ouen, settings] = await Promise.all([
      fetchMasterNyansFromPostgrest(),
      fetchMasterAsobiFromPostgrest(),
      fetchMasterOuenFromPostgrest(),
      fetchMasterSettingsFromPostgrest(),
    ]);

    if (!nyans || nyans.length === 0) {
      console.warn('[PostgREST] No characters retrieved, falling back to Firestore');
      return null;
    }

    console.log(`[PostgREST] 🚀 マスターデータ取得成功: ねこ=${nyans.length}匹, あそび=${asobi?.length || 0}件, 応援=${ouen?.items.length || 0}件`);

    return {
      version: Date.now(),
      characters: nyans,
      asobiList: asobi || [],
      ouenCategories: ouen?.categories || [],
      ouenList: ouen?.items || [],
      kounichan: settings?.kounichan,
      kihonNyanCustomImageUrl: settings?.kihon_nyan_custom_image_url,
      googleDriveFolderUrl: settings?.google_drive_folder_url,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    console.warn('[PostgREST] Exception fetching full master data:', err);
    return null;
  }
}
