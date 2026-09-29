import { GameSaveData, DiaryEntry } from '../types';
import { getPostgrestBaseUrl, isPostgrestEnabled, getPostgrestHeaders } from './postgrestConfig';
import { formatPostgrestError } from './postgrestMasterService';

export interface UserSaveRecord {
  user_id: string;
  version: number;
  updated_at: string;
  stats: any;
  inventory: any;
  rewards: any;
  nyan_progress: Record<string, any>;
  diary: DiaryEntry[];
  raw_save?: any;
}

/**
 * Fetch user save progress from Synology PostgreSQL
 */
export async function fetchUserSaveFromPostgrest(userId: string): Promise<UserSaveRecord | null> {
  if (!isPostgrestEnabled() || !userId) return null;
  const baseUrl = getPostgrestBaseUrl();
  const cleanId = encodeURIComponent(userId.trim().toLowerCase());

  try {
    const res = await fetch(`${baseUrl}/user_saves?user_id=eq.${cleanId}&limit=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[Synology] Failed to fetch user save for ${userId}: HTTP ${res.status}`);
      return null;
    }

    const rows: UserSaveRecord[] = await res.json();
    if (!rows || rows.length === 0) {
      console.log(`[Synology] No existing save record found for user "${userId}".`);
      return null;
    }

    console.log(`[Synology] 🐾 ユーザー "${userId}" のセーブデータを取得しました (絵日記: ${rows[0].diary?.length || 0}件)`);
    return rows[0];
  } catch (err) {
    console.warn(`[Synology] Network error fetching user save for ${userId}:`, err);
    return null;
  }
}

/**
 * Save user save progress to Synology PostgreSQL (UPSERT)
 */
export async function saveUserSaveToPostgrest(
  userId: string,
  saveData: GameSaveData
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !userId) {
    return { success: false, error: 'PostgREST disabled or invalid user ID' };
  }

  const baseUrl = getPostgrestBaseUrl();
  const cleanId = userId.trim().toLowerCase();

  // Extract individual nyan progress into dictionary
  const nyanProgressMap: Record<string, any> = {};
  if (Array.isArray(saveData.characters)) {
    for (const c of saveData.characters) {
      if (c && c.no) {
        nyanProgressMap[String(c.no)] = {
          discovered: Boolean(c.discovered),
          friendshipLevel: c.friendshipLevel || 1,
          lastMetAt: c.lastMetAt || 0,
          playCount: c.playCount || 0,
          memo: (c as any).memo || '',
        };
      }
    }
  }

  const payload = {
    user_id: cleanId,
    version: saveData.version || 1,
    updated_at: new Date().toISOString(),
    stats: saveData.stats || {},
    inventory: saveData.inventory || {},
    rewards: saveData.rewards || {},
    nyan_progress: nyanProgressMap,
    diary: saveData.diary || [],
    raw_save: {
      kenchiko: saveData.kenchiko || {},
      lastSaved: Date.now(),
    },
  };

  try {
    const res = await fetch(`${baseUrl}/user_saves`, {
      method: 'POST',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Synology] Save failed for ${userId}: HTTP ${res.status} - ${errText}`);
      return { success: false, error: formatPostgrestError(res.status, errText, 'user_saves') };
    }

    console.log(`[Synology] 💾 ユーザー "${userId}" のセーブデータをSynology PostgreSQLに正常保存しました`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Synology] Error saving user data for ${userId}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}
