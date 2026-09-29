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
import { getPostgrestBaseUrl, isPostgrestEnabled, getPostgrestHeaders } from './postgrestConfig';

export function formatPostgrestError(status: number, errText: string, tableName: string): string {
  if (errText.includes('42501') || errText.includes('permission denied') || status === 401) {
    return `Synology PostgreSQL権限不足 (HTTP ${status} / 42501: permission denied for ${tableName})。\nAdminer (https://micchy.synology.me:9944/?pgsql=postgre) で以下のSQLを実行してください:\nGRANT USAGE ON SCHEMA api TO public;\nGRANT ALL ON ALL TABLES IN SCHEMA api TO public;\nGRANT ALL ON ALL SEQUENCES IN SCHEMA api TO public;`;
  }
  return `HTTP ${status}: ${errText}`;
}


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

function getLocalStoriesMeta(): { stories?: Record<string, any> } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem('kenchiko_stories_meta_v1');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  const localMeta = getLocalStoriesMeta();
  const hasInMeta = localMeta?.stories ? !!localMeta.stories[String(r.no)] : false;
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
    hasStory: Boolean(r.has_story) || hasInMeta,
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

export async function fetchStoriesMetaFromPostgrest(): Promise<{
  version: number;
  updatedAt: number;
  storyCount: number;
  stories: Record<string, {
    id: number;
    name: string;
    kana?: string;
    motif?: string;
    week_title?: string;
    daysCount: number;
    updatedAt?: string;
  }>;
} | null> {
  if (!isPostgrestEnabled()) return null;
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_stories?select=id,name,kana,motif,week_info,updated_at&order=id.asc`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const list: any[] = await res.json();
    if (!list || !Array.isArray(list)) return null;

    const map: Record<string, {
      id: number;
      name: string;
      kana?: string;
      motif?: string;
      week_title?: string;
      daysCount: number;
      updatedAt?: string;
    }> = {};

    for (const r of list) {
      const id = Number(r.id);
      if (isNaN(id) || id <= 0) continue;
      map[String(id)] = {
        id,
        name: r.name || `にゃんこ No.${id}`,
        kana: r.kana || undefined,
        motif: r.motif || undefined,
        week_title: r.week_info?.week_title || undefined,
        daysCount: Array.isArray(r.week_info?.days) ? r.week_info.days.length : 0,
        updatedAt: r.updated_at,
      };
    }

    return {
      version: Date.now(),
      updatedAt: Date.now(),
      storyCount: Object.keys(map).length,
      stories: map,
    };
  } catch (err) {
    console.warn('[PostgREST] Failed to fetch stories meta from Synology:', err);
    return null;
  }
}

/**
 * High-level loader that pulls all master tables concurrently from PostgREST.
 * Returns null if PostgREST is disabled or unreachable, allowing local fallback.
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
      console.warn('[PostgREST] No characters retrieved, falling back to local defaults');
      return null;
    }

    console.log(`[PostgREST] 🚀 マスターデータ取得成功: ねこ=${nyans.length}匹, あそび=${asobi?.length || 0}件, 応援=${ouen?.items.length || 0}件`);

    const currentBaseUrl = getPostgrestBaseUrl();
    lastSynologyStatus = {
      online: true,
      endpoint: currentBaseUrl,
      nyanCount: nyans.length,
      asobiCount: asobi?.length || 0,
      ouenCount: ouen?.items.length || 0,
      storyCount: 266,
      lastChecked: Date.now(),
    };

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
  } catch (err: any) {
    console.warn('[PostgREST] Exception fetching full master data:', err);
    lastSynologyStatus = {
      online: false,
      endpoint: getPostgrestBaseUrl(),
      nyanCount: 0,
      asobiCount: 0,
      ouenCount: 0,
      storyCount: 0,
      lastChecked: Date.now(),
      error: err?.message || String(err),
    };
    return null;
  }
}

/**
 * Save / Upsert Master Characters to Synology PostgreSQL (api.master_nyans)
 */
export async function saveMasterNyansToPostgrest(
  nyans: MasterNyanCharacter[]
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !nyans || nyans.length === 0) {
    return { success: false, error: 'PostgREST disabled or empty characters' };
  }
  const baseUrl = getPostgrestBaseUrl();
  const rows = nyans.map((n) => ({
    no: Number(n.no),
    name: n.name || '',
    reading: n.reading || null,
    motif: n.motif || null,
    first_appeared: n.firstAppeared || null,
    episode: n.episode || null,
    prompt_ja: n.promptJa || null,
    prompt_en: n.promptEn || null,
    dialogue: n.dialogue || null,
    dialogue_meaning: n.dialogueMeaning || null,
    has_story: Boolean(n.hasStory),
    custom_image_url: n.customImageUrl || null,
    raw_image_url: n.rawImageUrl || null,
    has_custom_image: Boolean(n.hasCustomImage || n.customImageUrl),
    transparency: n.transparency || null,
    favorite_items: n.favoriteItems || null,
    favorite_locations: n.favoriteLocations || null,
  }));

  try {
    const res = await fetch(`${baseUrl}/master_nyans`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Synology Master] Save master_nyans failed: HTTP ${res.status} - ${errText}`);
      return { success: false, error: formatPostgrestError(res.status, errText, 'master_nyans') };
    }
    console.log(`[Synology Master] 🐾 master_nyans (${rows.length}件) をSynology PostgreSQLに正常保存しました`);
    return { success: true };
  } catch (err: any) {
    console.error('[Synology Master] Network error saving master_nyans:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save / Upsert Master Asobi list to Synology PostgreSQL (api.master_asobi)
 */
export async function saveMasterAsobiToPostgrest(
  asobiList: KenchikoAsobi[]
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !asobiList) {
    return { success: false, error: 'PostgREST disabled or empty asobi' };
  }
  const baseUrl = getPostgrestBaseUrl();
  const rows = asobiList.map((a, idx) => ({
    id: a.id,
    title: a.title || '',
    content: a.content || null,
    condition: a.condition || 'all',
    frequency: a.frequency || 'normal',
    sort_order: idx + 1,
  }));

  try {
    const res = await fetch(`${baseUrl}/master_asobi`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: formatPostgrestError(res.status, errText, 'master_asobi') };
    }
    console.log(`[Synology Master] 🎮 master_asobi (${rows.length}件) をSynology PostgreSQLに正常保存しました`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save / Upsert Master Ouen to Synology PostgreSQL (api.master_ouen_categories & master_ouen_items)
 */
export async function saveMasterOuenToPostgrest(
  categories?: OuenCategory[],
  items?: OuenItem[]
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled()) return { success: false, error: 'PostgREST disabled' };
  const baseUrl = getPostgrestBaseUrl();

  try {
    const promises: Promise<Response>[] = [];

    if (categories && categories.length > 0) {
      const catRows = categories.map((c, idx) => ({
        id: c.id,
        label: c.label || '',
        sort_order: idx + 1,
      }));
      promises.push(
        fetch(`${baseUrl}/master_ouen_categories`, {
          method: 'POST',
          headers: getPostgrestHeaders({
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          }),
          body: JSON.stringify(catRows),
        })
      );
    }

    if (items && items.length > 0) {
      const itemRows = items.map((i, idx) => ({
        id: i.id,
        category_id: i.categoryId,
        message: i.message || '',
        sort_order: idx + 1,
      }));
      promises.push(
        fetch(`${baseUrl}/master_ouen_items`, {
          method: 'POST',
          headers: getPostgrestHeaders({
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          }),
          body: JSON.stringify(itemRows),
        })
      );
    }

    const responses = await Promise.all(promises);
    for (const r of responses) {
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        return { success: false, error: formatPostgrestError(r.status, errText, 'master_ouen') };
      }
    }

    console.log(`[Synology Master] 💌 master_ouen をSynology PostgreSQLに正常保存しました`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save / Upsert Master Settings to Synology PostgreSQL (api.master_settings)
 */
export async function saveMasterSettingsToPostgrest(
  settings: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !settings) return { success: false, error: 'PostgREST disabled' };
  const baseUrl = getPostgrestBaseUrl();
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  try {
    const res = await fetch(`${baseUrl}/master_settings`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: formatPostgrestError(res.status, errText, 'master_settings') };
    }
    console.log(`[Synology Master] ⚙️ master_settings をSynology PostgreSQLに正常保存しました`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save / Upsert Single Story to Synology PostgreSQL (api.master_stories)
 */
export async function saveSingleStoryToPostgrest(
  story: NyankoStory
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !story) return { success: false, error: 'PostgREST disabled' };
  const baseUrl = getPostgrestBaseUrl();
  const row = {
    id: story.id,
    name: story.name || '',
    kana: story.kana || null,
    motif: story.motif || null,
    debut_date: story.debut_date || null,
    voice: story.voice || null,
    translation: story.translation || null,
    episode_summary: story.episode_summary || null,
    prompt_ja: story.prompt_ja || null,
    prompt_en: story.prompt_en || null,
    doc_link: story.doc_link || null,
    week_info: story.week_info || null,
    updated_at: story.updatedAt || new Date().toISOString(),
  };

  try {
    const res = await fetch(`${baseUrl}/master_stories`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify([row]),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: formatPostgrestError(res.status, errText, 'master_stories') };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save / Upsert Multiple Stories to Synology PostgreSQL (api.master_stories)
 */
export async function saveStoriesToPostgrest(
  stories: NyankoStory[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isPostgrestEnabled() || !stories || stories.length === 0) {
    return { success: false, count: 0, error: 'PostgREST disabled or empty stories' };
  }
  const baseUrl = getPostgrestBaseUrl();
  const rows = stories.map((story) => ({
    id: story.id,
    name: story.name || '',
    kana: story.kana || null,
    motif: story.motif || null,
    debut_date: story.debut_date || null,
    voice: story.voice || null,
    translation: story.translation || null,
    episode_summary: story.episode_summary || null,
    prompt_ja: story.prompt_ja || null,
    prompt_en: story.prompt_en || null,
    doc_link: story.doc_link || null,
    week_info: story.week_info || null,
    updated_at: story.updatedAt || new Date().toISOString(),
  }));

  try {
    const res = await fetch(`${baseUrl}/master_stories`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, count: 0, error: formatPostgrestError(res.status, errText, 'master_stories') };
    }
    console.log(`[Synology Master] 📖 master_stories (${rows.length}件) をSynology PostgreSQLに正常保存しました`);
    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

/**
 * Delete a Story from Synology PostgreSQL (api.master_stories)
 */
export async function deleteStoryFromPostgrest(
  nyanId: number
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled()) return { success: false, error: 'PostgREST disabled' };
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_stories?id=eq.${nyanId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save all master data tables concurrently to Synology PostgreSQL
 */
export async function saveFullMasterDataToPostgrest(
  master: Partial<GameMasterData>,
  options: { syncCharacters?: boolean; syncAsobi?: boolean; syncAssets?: boolean } = {}
): Promise<{ success: boolean; errors: string[] }> {
  if (!isPostgrestEnabled()) {
    return { success: false, errors: ['Synology PostgREST is disabled'] };
  }

  const errors: string[] = [];
  const tasks: Promise<any>[] = [];

  if (options.syncCharacters !== false && master.characters && master.characters.length > 0) {
    tasks.push(
      saveMasterNyansToPostgrest(master.characters).then((res) => {
        if (!res.success && res.error) errors.push(`マスターねこ図鑑: ${res.error}`);
      })
    );
  }

  if (options.syncAsobi !== false) {
    if (master.asobiList && master.asobiList.length > 0) {
      tasks.push(
        saveMasterAsobiToPostgrest(master.asobiList).then((res) => {
          if (!res.success && res.error) errors.push(`マスターあそび: ${res.error}`);
        })
      );
    }
    if (master.ouenCategories || master.ouenList) {
      tasks.push(
        saveMasterOuenToPostgrest(master.ouenCategories, master.ouenList).then((res) => {
          if (!res.success && res.error) errors.push(`マスター応援: ${res.error}`);
        })
      );
    }
  }

  const settingsPayload: Record<string, any> = {};
  if (master.kounichan !== undefined) settingsPayload['kounichan'] = master.kounichan;
  if (master.kihonNyanCustomImageUrl !== undefined) settingsPayload['kihon_nyan_custom_image_url'] = master.kihonNyanCustomImageUrl;
  if (master.googleDriveFolderUrl !== undefined) settingsPayload['google_drive_folder_url'] = master.googleDriveFolderUrl;

  if (Object.keys(settingsPayload).length > 0) {
    tasks.push(
      saveMasterSettingsToPostgrest(settingsPayload).then((res) => {
        if (!res.success && res.error) errors.push(`マスター共通設定: ${res.error}`);
      })
    );
  }

  await Promise.all(tasks);
  return {
    success: errors.length === 0,
    errors,
  };
}

export interface SynologyConnectionInfo {
  online: boolean;
  endpoint: string;
  nyanCount: number;
  asobiCount: number;
  ouenCount: number;
  storyCount: number;
  lastChecked: number;
  error?: string;
}

let lastSynologyStatus: SynologyConnectionInfo = {
  online: true,
  endpoint: getPostgrestBaseUrl(),
  nyanCount: 268,
  asobiCount: 31,
  ouenCount: 40,
  storyCount: 266,
  lastChecked: Date.now(),
};

export function getSynologyConnectionInfo(): SynologyConnectionInfo {
  return { ...lastSynologyStatus, endpoint: getPostgrestBaseUrl() };
}

export async function testSynologyConnection(): Promise<SynologyConnectionInfo> {
  const baseUrl = getPostgrestBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/master_nyans?limit=1`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      lastSynologyStatus = {
        ...lastSynologyStatus,
        online: true,
        endpoint: baseUrl,
        lastChecked: Date.now(),
        error: undefined,
      };
    } else {
      lastSynologyStatus = {
        ...lastSynologyStatus,
        online: false,
        endpoint: baseUrl,
        lastChecked: Date.now(),
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }
  } catch (err: any) {
    lastSynologyStatus = {
      ...lastSynologyStatus,
      online: false,
      endpoint: baseUrl,
      lastChecked: Date.now(),
      error: err?.message || '接続タイムアウトまたはネットワークエラー',
    };
  }
  return getSynologyConnectionInfo();
}

