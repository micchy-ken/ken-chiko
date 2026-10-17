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

  // Load snapshots to persist to Synology PostgreSQL alongside the user save
  let localSnapshots: any[] = [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`kenchiko_snapshots_${cleanId}`) : null;
    if (raw) localSnapshots = JSON.parse(raw);
  } catch {}

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
      snapshots: (saveData as any).snapshots || (localSnapshots.length > 0 ? localSnapshots : undefined),
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

/**
 * Fetch all registered users from Synology PostgreSQL
 */
export async function fetchAllUsersFromPostgrest(): Promise<UserSaveRecord[]> {
  if (!isPostgrestEnabled()) return [];
  const baseUrl = getPostgrestBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/user_saves?order=updated_at.desc`, {
      method: 'GET',
      headers: getPostgrestHeaders({
        'Accept': 'application/json',
      }),
    });

    if (!res.ok) {
      console.warn(`[Synology] Failed to fetch all user saves: HTTP ${res.status}`);
      return [];
    }

    const rows: UserSaveRecord[] = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn('[Synology] Error fetching all user saves:', err);
    return [];
  }
}

/**
 * Delete a user save record from Synology PostgreSQL
 */
export async function deleteUserFromPostgrest(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPostgrestEnabled() || !userId) {
    return { success: false, error: 'PostgREST disabled or invalid user ID' };
  }

  const baseUrl = getPostgrestBaseUrl();
  const cleanId = encodeURIComponent(userId.trim().toLowerCase());

  try {
    const res = await fetch(`${baseUrl}/user_saves?user_id=eq.${cleanId}`, {
      method: 'DELETE',
      headers: getPostgrestHeaders({
        'Accept': 'application/json',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: formatPostgrestError(res.status, errText, 'user_saves') };
    }

    console.log(`[Synology] 🗑️ ユーザー "${userId}" をSynology PostgreSQLから削除しました`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Synology] Error deleting user ${userId}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save user snapshots directly into Synology PostgreSQL (user_saves.raw_save.snapshots)
 */
export async function saveSnapshotsToCloudDb(
  userId: string,
  snapshots: any[]
): Promise<boolean> {
  if (!isPostgrestEnabled() || !userId || !Array.isArray(snapshots)) return false;
  const baseUrl = getPostgrestBaseUrl();
  const cleanId = encodeURIComponent(userId.trim().toLowerCase());

  try {
    const current = await fetchUserSaveFromPostgrest(userId);
    if (!current) return false;

    const updatedRawSave = {
      ...(current.raw_save || {}),
      snapshots,
      lastSaved: Date.now(),
    };

    const res = await fetch(`${baseUrl}/user_saves?user_id=eq.${cleanId}`, {
      method: 'PATCH',
      headers: getPostgrestHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }),
      body: JSON.stringify({
        raw_save: updatedRawSave,
        updated_at: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      console.log(`[Synology] 📸 スナップショット ${snapshots.length}件をSynology PostgreSQLに永続化しました`);
      return true;
    }
  } catch (err) {
    console.warn(`[Synology] Error saving snapshots to cloud DB for ${userId}:`, err);
  }
  return false;
}

/**
 * Fetch snapshots directly from Synology PostgreSQL (user_saves.raw_save.snapshots)
 */
export async function fetchSnapshotsFromCloudDb(userId: string): Promise<any[] | null> {
  if (!isPostgrestEnabled() || !userId) return null;
  try {
    const record = await fetchUserSaveFromPostgrest(userId);
    if (record && record.raw_save && Array.isArray(record.raw_save.snapshots)) {
      return record.raw_save.snapshots;
    }
  } catch (err) {
    console.warn(`[Synology] Error fetching snapshots from cloud DB for ${userId}:`, err);
  }
  return null;
}
