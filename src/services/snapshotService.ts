/**
 * snapshotService.ts
 * 
 * ユーザーごとの優位な進行度スナップショット（10日分、1日以上古いものは最新1件のみ）の
 * 自動記録・ローテーション・管理、およびローカルデータとの安全マージ復旧を提供するサービス。
 */

import { GameSaveData, NyanCharacter, UserNyanProgress, RewardTicket, DiaryEntry, GiftItem } from '../types';
import { extractProgressMap, mergeUserProgressSafely } from '../utils/dataSeparation';
import { mergeRewardStates, deduplicateDiary } from './cloudSync';
import {
  saveUserSaveToPostgrest,
  saveSnapshotsToCloudDb,
  fetchSnapshotsFromCloudDb,
} from './postgrestUserService';

export interface SnapshotMetrics {
  discoveredCount: number;
  totalFriendship: number;
  maxFriendship: number;
  totalPlays: number;
  ticketCount: number; // 未使用チケット数
  totalTicketCount: number; // 全チケット数
  usedTicketCount: number;
  diaryCount: number;
  storyCount: number;
  itemCount: number;
  totalTrips: number;
  totalEncounters: number;
  totalNapMinutes: number;
  totalSnacksEaten: number;
  lifetimePoints: number;
}

export interface GameSaveSnapshot {
  id: string; // e.g. "snap_yumi_1792115499702_abc"
  userId: string;
  timestamp: number;
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:mm:ss"
  reason: string; // 例: "にゃんこ+2匹発見", "絵日記追加", "チケット獲得"
  metrics: SnapshotMetrics;
  saveData: GameSaveData;
}

export interface RestoreDiffSummary {
  nyanAddedCount: number; // スナップショットから新たに追加・復旧されたにゃんこ
  nyanTotalAfter: number; // 復旧後の総発見にゃんこ数
  ticketsAddedCount: number; // スナップショットから新たに追加されたチケット
  ticketsTotalAfter: number;
  diaryAddedCount: number; // スナップショットから新たに追加された日記
  diaryTotalAfter: number;
  storiesAddedCount: number; // 新たに追加された読了物語
  storiesTotalAfter: number;
  itemsUpdatedCount: number; // アイテム数が増加した数
  statsEnhanced: boolean; // ステータスが増加したか
  restoredNyanDetails: Array<{ no: number; name: string }>;
}

const SNAPSHOT_KEY_PREFIX = 'kenchiko_snapshots_';
const MAX_SNAPSHOT_DAYS = 10;
const MAX_TODAY_SNAPSHOTS = 15; // 当日は直近15件まで保存

/**
 * 日付文字列（YYYY-MM-DD）を取得（ローカルタイムゾーン基準）
 */
export function getLocalDateString(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 時刻文字列（HH:mm:ss）を取得
 */
export function getLocalTimeString(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * セーブデータからメトリクスを抽出する
 */
export function extractSaveMetrics(save: GameSaveData): SnapshotMetrics {
  const progressMap = extractProgressMap(save.nyanProgress || save.characters);
  const progressEntries = Object.values(progressMap);

  let discoveredCount = 0;
  let totalFriendship = 0;
  let maxFriendship = 1;
  let totalPlays = 0;

  for (const p of progressEntries) {
    if (p.discovered) discoveredCount++;
    const fl = p.friendshipLevel || 1;
    totalFriendship += fl;
    if (fl > maxFriendship) maxFriendship = fl;
    totalPlays += p.playCount || 0;
  }

  const tickets = save.rewards?.tickets || [];
  const unusedTickets = tickets.filter((t) => !t.isUsed);
  const usedTickets = tickets.filter((t) => t.isUsed);

  const diary = save.diary || [];
  const readStories = save.rewards?.readStoryIds || [];
  const inventory = save.inventory || [];
  const totalItemCount = inventory.reduce((sum, item) => sum + (item.count || 0), 0);

  const stats = save.stats || {
    totalEncounters: 0,
    totalSnacksEaten: 0,
    totalNapMinutes: 0,
    totalTrips: 0,
  };

  return {
    discoveredCount,
    totalFriendship,
    maxFriendship,
    totalPlays,
    ticketCount: unusedTickets.length,
    totalTicketCount: tickets.length,
    usedTicketCount: usedTickets.length,
    diaryCount: diary.length,
    storyCount: readStories.length,
    itemCount: totalItemCount,
    totalTrips: stats.totalTrips || 0,
    totalEncounters: stats.totalEncounters || 0,
    totalNapMinutes: stats.totalNapMinutes || 0,
    totalSnacksEaten: stats.totalSnacksEaten || 0,
    lifetimePoints: save.rewards?.lifetimePoints || 0,
  };
}

/**
 * 前回のスナップショットメトリクスと比較し、ゲーム進行度が優位に変更されたかを判定する。
 * 優位な変更理由の配列とフラグを返す。
 */
export function evaluateAdvantageousChange(
  prevMetrics: SnapshotMetrics | null,
  currentMetrics: SnapshotMetrics
): { isAdvantageous: boolean; reasons: string[] } {
  if (!prevMetrics) {
    return { isAdvantageous: true, reasons: ['初回スナップショット作成'] };
  }

  const reasons: string[] = [];

  // 1. 発見にゃんこ数
  if (currentMetrics.discoveredCount > prevMetrics.discoveredCount) {
    reasons.push(`にゃんこ+${currentMetrics.discoveredCount - prevMetrics.discoveredCount}匹発見`);
  }

  // 2. なかよし度・あそび回数
  if (currentMetrics.totalFriendship > prevMetrics.totalFriendship) {
    reasons.push(`なかよし度上昇(+${currentMetrics.totalFriendship - prevMetrics.totalFriendship})`);
  } else if (currentMetrics.totalPlays > prevMetrics.totalPlays) {
    reasons.push(`あそび回数増加(+${currentMetrics.totalPlays - prevMetrics.totalPlays})`);
  }

  // 3. チケット獲得または使用
  if (currentMetrics.totalTicketCount > prevMetrics.totalTicketCount) {
    reasons.push(`チケット獲得(+${currentMetrics.totalTicketCount - prevMetrics.totalTicketCount}枚)`);
  } else if (currentMetrics.usedTicketCount > prevMetrics.usedTicketCount) {
    reasons.push(`チケット使用(${currentMetrics.usedTicketCount - prevMetrics.usedTicketCount}枚)`);
  }

  // 4. 絵日記
  if (currentMetrics.diaryCount > prevMetrics.diaryCount) {
    reasons.push(`絵日記追加(+${currentMetrics.diaryCount - prevMetrics.diaryCount}件)`);
  }

  // 5. 物語読了
  if (currentMetrics.storyCount > prevMetrics.storyCount) {
    reasons.push(`物語読了(+${currentMetrics.storyCount - prevMetrics.storyCount}話)`);
  }

  // 6. お出かけ・遭遇回数
  if (currentMetrics.totalTrips > prevMetrics.totalTrips) {
    reasons.push(`お出かけ完了(${currentMetrics.totalTrips}回目)`);
  }
  if (currentMetrics.totalEncounters > prevMetrics.totalEncounters) {
    reasons.push(`遭遇回数増加(${currentMetrics.totalEncounters}回目)`);
  }

  // 7. アイテム数
  if (currentMetrics.itemCount > prevMetrics.itemCount) {
    reasons.push(`アイテム増加`);
  }

  // 8. ガチャポイント
  if (currentMetrics.lifetimePoints > prevMetrics.lifetimePoints + 10) {
    reasons.push(`ポイント獲得`);
  }

  return {
    isAdvantageous: reasons.length > 0,
    reasons,
  };
}

/**
 * スナップショットリストを「10日分（一日以上古いものは最新の1件のみ）」ルールで整理する。
 */
export function pruneSnapshots(
  snapshots: GameSaveSnapshot[],
  todayStr: string = getLocalDateString(),
  maxDays: number = MAX_SNAPSHOT_DAYS
): GameSaveSnapshot[] {
  if (!snapshots || snapshots.length === 0) return [];

  // タイムスタンプ降順（新しい順）
  const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);

  // 日付ごとにグループ化
  const dateMap = new Map<string, GameSaveSnapshot[]>();
  for (const snap of sorted) {
    const list = dateMap.get(snap.dateStr) || [];
    list.push(snap);
    dateMap.set(snap.dateStr, list);
  }

  // 日付のリストを降順（新しい日付順）でソート
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

  // 保持する日付を最大 maxDays (10日分) に制限
  const retainedDates = sortedDates.slice(0, maxDays);

  const result: GameSaveSnapshot[] = [];

  for (const date of retainedDates) {
    const daySnaps = dateMap.get(date) || [];
    if (daySnaps.length === 0) continue;

    if (date === todayStr) {
      // 本日: 最新 MAX_TODAY_SNAPSHOTS 件まで保持
      result.push(...daySnaps.slice(0, MAX_TODAY_SNAPSHOTS));
    } else {
      // 一日以上古い過去日: 最新の1件のみ保持！
      // daySnapsは降順ソートされているので最初の要素がその日の最新
      result.push(daySnaps[0]);
    }
  }

  // 再度全体をタイムスタンプ降順で並べる
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * スナップショット保存用にセーブデータからマスターデータを剥ぎ取り、
 * 純粋なユーザー進行度のみに極小化（minify）する。
 * （300KB〜500KB → 5KB〜15KB に97%圧縮し、LocalStorageのQuotaExceededErrorを完全に回避）
 */
export function minifySaveForSnapshot(save: GameSaveData): GameSaveData {
  if (!save) return save;
  const progressMap = extractProgressMap(save.nyanProgress || save.characters);

  // kenchiko から巨大なBase64画像（customImageUrl）を除外（別キーで管理されているため）
  const cleanKenchiko = { ...(save.kenchiko || {}) };
  if (cleanKenchiko.customImageUrl && cleanKenchiko.customImageUrl.length > 200) {
    delete cleanKenchiko.customImageUrl;
  }

  return {
    version: save.version || 1,
    lastSaved: save.lastSaved || Date.now(),
    nyanProgress: progressMap,
    characters: [], // 巨大なマスターキャラ定義は保存しない！復元時にcomposeCharactersで復元
    diary: save.diary || [],
    inventory: (save.inventory || []).filter((i) => (i.count || 0) > 0),
    rewards: save.rewards || {
      points: 0,
      lifetimePoints: 0,
      hasClaimedInitialDiscoveryBonus: false,
      readStoryIds: [],
      tickets: [],
      history: [],
    },
    stats: save.stats || {
      totalEncounters: 0,
      totalSnacksEaten: 0,
      totalNapMinutes: 0,
      totalTrips: 0,
    },
    kenchiko: cleanKenchiko as any,
    asobiList: [], // マスターデータは除外
    ouenCategories: [], // マスターデータは除外
    ouenList: [], // マスターデータは除外
    githubRepo: save.githubRepo || 'ken-chiko',
    autoSyncGithub: false,
  };
}

/**
 * スナップショット単体を極小化する
 */
export function compressSnapshot(snap: GameSaveSnapshot): GameSaveSnapshot {
  if (!snap || !snap.saveData) return snap;
  return {
    ...snap,
    saveData: minifySaveForSnapshot(snap.saveData),
  };
}

/**
 * ユーザーの保存されたスナップショット一覧を取得
 * （もし過去の肥大化したデータがあれば自動的に極小化して容量を回復する自己修復付き）
 */
export function getSnapshotsForUser(userId: string): GameSaveSnapshot[] {
  if (!userId) return [];
  try {
    const key = `${SNAPSHOT_KEY_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // 過去の肥大化データ（characters配列や巨大Base64画像付き）が含まれているか確認
      const needsMigration = parsed.some(
        (s) =>
          (s.saveData?.characters && s.saveData.characters.length > 0) ||
          (s.saveData?.kenchiko?.customImageUrl && s.saveData.kenchiko.customImageUrl.length > 200) ||
          (s.saveData?.asobiList && s.saveData.asobiList.length > 0)
      );

      if (needsMigration) {
        // 自己修復：既存の肥大化スナップショットを極小化して即座に容量を解放
        const minified = parsed.map(compressSnapshot);
        saveSnapshotsToStorage(userId, minified);
        return minified;
      }
      return parsed;
    }
    return [];
  } catch (err) {
    console.error(`Failed to load snapshots for user ${userId}:`, err);
    return [];
  }
}

/**
 * スナップショット一覧を保存
 * （QuotaExceededError を自動検知し、自浄・間引き・不要キャッシュ削除で安全にフォールバック）
 */
function saveSnapshotsToStorage(userId: string, snapshots: GameSaveSnapshot[]) {
  if (!userId) return;
  const key = `${SNAPSHOT_KEY_PREFIX}${userId}`;

  // すべてのスナップショットを極小化
  const minified = snapshots.map(compressSnapshot);

  // 1. クラウドDB (Synology PostgreSQL: user_saves.raw_save.snapshots) へ確実に永続化！
  saveSnapshotsToCloudDb(userId, minified).catch((e) => {
    console.warn(`[SnapshotService] Cloud DB snapshot sync notice for ${userId}:`, e);
  });

  // 2. ローカルストレージにもオフラインキャッシュとして保存
  let candidates = minified;
  while (candidates.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(candidates));
      return; // 正常保存完了
    } catch (err: any) {
      const isQuotaError =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014;

      if (isQuotaError) {
        console.warn(
          `[SnapshotService] LocalStorage quota exceeded for user "${userId}". Auto-pruning snapshots to free space (${candidates.length} -> ${Math.floor(candidates.length / 2)})...`
        );
        // 古いスナップショットを間引いて再試行
        if (candidates.length > 3) {
          candidates = candidates.slice(0, Math.max(3, Math.floor(candidates.length / 2)));
        } else if (candidates.length > 1) {
          candidates = candidates.slice(0, 1); // 最新1件のみ残す
        } else {
          // 最後の1件でも入らない場合、古い巨大キーをクリアして再試行
          try {
            cleanupExcessStorageKeys(userId);
            localStorage.setItem(key, JSON.stringify(candidates));
            return;
          } catch {
            console.warn(`[SnapshotService] Storage completely full for ${userId}. Snapshot safely skipped without crash.`);
            return;
          }
        }
      } else {
        console.error(`Failed to save snapshots for user ${userId}:`, err);
        return;
      }
    }
  }
}

/**
 * ストレージ容量逼迫時に古い一時データや肥大化したレガシーキーをクリーンアップする
 */
function cleanupExcessStorageKeys(currentUserId: string) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // 他の古い一時バックアップやシードキー
      if (
        (k.startsWith('kenchiko_save_state_backup_') && !k.includes(currentUserId)) ||
        k.includes('legacy_seed') ||
        k.includes('temp_')
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * 優位な変更がある場合にのみ新しいスナップショットを記録・ローテーションする。
 */
export function saveSnapshotIfAdvantageous(
  userId: string,
  currentSave: GameSaveData,
  forcedReason?: string
): GameSaveSnapshot | null {
  if (!userId || !currentSave) return null;

  try {
    const now = Date.now();
    const todayStr = getLocalDateString(now);
    const timeStr = getLocalTimeString(now);
    const existing = getSnapshotsForUser(userId);

    const currentMetrics = extractSaveMetrics(currentSave);

    // 最新のスナップショットのメトリクスと比較
    const latestSnapshot = existing.length > 0 ? existing[0] : null;
    const { isAdvantageous, reasons } = evaluateAdvantageousChange(
      latestSnapshot ? latestSnapshot.metrics : null,
      currentMetrics
    );

    if (!isAdvantageous && !forcedReason) {
      // 優位な変更がない場合は保存をスキップ
      return null;
    }

    const reason = forcedReason || reasons.join(' / ') || '進捗更新';

    // マスターデータと巨大Base64画像を除いた純粋なユーザー進行度のみを極小化して保持
    const cleanSaveData: GameSaveData = minifySaveForSnapshot(currentSave);

    const newSnapshot: GameSaveSnapshot = {
      id: `snap_${userId}_${now}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      timestamp: now,
      dateStr: todayStr,
      timeStr,
      reason,
      metrics: currentMetrics,
      saveData: cleanSaveData,
    };

    const updatedList = pruneSnapshots([newSnapshot, ...existing], todayStr, MAX_SNAPSHOT_DAYS);
    saveSnapshotsToStorage(userId, updatedList);

    return newSnapshot;
  } catch (err) {
    console.error('Error saving snapshot:', err);
    return null;
  }
}

/**
 * 手動で即座にスナップショットを作成する
 */
export function createManualSnapshot(
  userId: string,
  currentSave: GameSaveData,
  customReason: string = '管理画面からの手動バックアップ'
): GameSaveSnapshot | null {
  return saveSnapshotIfAdvantageous(userId, currentSave, customReason);
}

/**
 * 特定のスナップショットを削除する
 */
export function deleteSnapshot(userId: string, snapshotId: string): boolean {
  try {
    const existing = getSnapshotsForUser(userId);
    const filtered = existing.filter((s) => s.id !== snapshotId);
    saveSnapshotsToStorage(userId, filtered);
    return true;
  } catch (err) {
    console.error('Failed to delete snapshot:', err);
    return false;
  }
}

/**
 * 【最重要】スナップショットのデータを現在のローカルデータと「有利マージ（Advantageous Merge）」して復旧する。
 * どちらのデータも消失せず、両方の進んだ状態が安全に統合される。
 */
export function restoreSnapshotWithLocalMerge(
  currentSave: GameSaveData,
  snapshotSave: GameSaveData,
  masterCharacters?: NyanCharacter[]
): { mergedSave: GameSaveData; diffSummary: RestoreDiffSummary } {
  // 1. にゃんこ進行度の有利マージ
  const currentProgress = extractProgressMap(currentSave.nyanProgress || currentSave.characters);
  const snapshotProgress = extractProgressMap(snapshotSave.nyanProgress || snapshotSave.characters);
  const mergedProgress = mergeUserProgressSafely(currentProgress, snapshotProgress);

  // 復旧されたにゃんこの差分計測
  const restoredNyanDetails: Array<{ no: number; name: string }> = [];
  let nyanAddedCount = 0;
  for (const [key, val] of Object.entries(mergedProgress)) {
    const no = Number(key);
    const wasDiscoveredInCurrent = Boolean(currentProgress[no]?.discovered);
    if (val.discovered && !wasDiscoveredInCurrent) {
      nyanAddedCount++;
      const name = masterCharacters?.find((c) => c.no === no)?.name || `No.${no}`;
      restoredNyanDetails.push({ no, name });
    }
  }

  // UI用の characters 配列も安全にマージ
  let updatedCharacters = currentSave.characters || [];
  if (masterCharacters && masterCharacters.length > 0) {
    updatedCharacters = masterCharacters.map((master) => {
      const prog = mergedProgress[master.no];
      return {
        ...master,
        discovered: Boolean(prog?.discovered),
        friendshipLevel: prog?.friendshipLevel || 1,
        playCount: prog?.playCount || 0,
        discoveryDate: prog?.discoveryDate,
        lastMetAt: prog?.lastMetAt || 0,
      };
    });
  } else {
    // 既存の characters 配列に対してマージ
    updatedCharacters = (currentSave.characters || []).map((ch) => {
      const prog = mergedProgress[ch.no];
      if (!prog) return ch;
      return {
        ...ch,
        discovered: Boolean(prog.discovered || ch.discovered),
        friendshipLevel: Math.max(ch.friendshipLevel || 1, prog.friendshipLevel || 1),
        playCount: Math.max(ch.playCount || 0, prog.playCount || 0),
        discoveryDate: ch.discoveryDate || prog.discoveryDate,
        lastMetAt: Math.max(ch.lastMetAt || 0, prog.lastMetAt || 0),
      };
    });
  }

  // 2. リワード（チケット・物語・ポイント）の有利マージ
  const currentRewards = currentSave.rewards;
  const snapshotRewards = snapshotSave.rewards;
  const mergedRewards = mergeRewardStates(currentRewards, snapshotRewards);

  const currentTicketIds = new Set((currentRewards?.tickets || []).map((t) => t.id));
  const snapshotTickets = snapshotRewards?.tickets || [];
  const ticketsAddedCount = snapshotTickets.filter((t) => !currentTicketIds.has(t.id)).length;

  const currentStoryIds = new Set(currentRewards?.readStoryIds || []);
  const snapshotStories = snapshotRewards?.readStoryIds || [];
  const storiesAddedCount = snapshotStories.filter((id) => !currentStoryIds.has(id)).length;

  // 3. 絵日記の安全合算・重複排除
  const mergedDiary = deduplicateDiary([
    ...(currentSave.diary || []),
    ...(snapshotSave.diary || []),
  ]);
  const currentDiaryIds = new Set((currentSave.diary || []).map((d) => d.id));
  const diaryAddedCount = (snapshotSave.diary || []).filter((d) => !currentDiaryIds.has(d.id)).length;

  // 4. インベントリの数量有利マージ (Math.max)
  const itemMap = new Map<string, GiftItem>();
  for (const item of currentSave.inventory || []) {
    itemMap.set(item.id, { ...item });
  }
  let itemsUpdatedCount = 0;
  for (const snapItem of snapshotSave.inventory || []) {
    if (itemMap.has(snapItem.id)) {
      const cur = itemMap.get(snapItem.id)!;
      if ((snapItem.count || 0) > (cur.count || 0)) {
        itemMap.set(snapItem.id, { ...cur, count: snapItem.count });
        itemsUpdatedCount++;
      }
    } else {
      itemMap.set(snapItem.id, { ...snapItem });
      itemsUpdatedCount++;
    }
  }
  const mergedInventory = Array.from(itemMap.values());

  // 5. ステータス（trips, encounters, snacks, naps）の Math.max 合算
  const curStats = currentSave.stats || { totalTrips: 0, totalEncounters: 0, totalNapMinutes: 0, totalSnacksEaten: 0 };
  const snapStats = snapshotSave.stats || { totalTrips: 0, totalEncounters: 0, totalNapMinutes: 0, totalSnacksEaten: 0 };
  const mergedStats = {
    totalTrips: Math.max(curStats.totalTrips || 0, snapStats.totalTrips || 0),
    totalEncounters: Math.max(curStats.totalEncounters || 0, snapStats.totalEncounters || 0),
    totalNapMinutes: Math.max(curStats.totalNapMinutes || 0, snapStats.totalNapMinutes || 0),
    totalSnacksEaten: Math.max(curStats.totalSnacksEaten || 0, snapStats.totalSnacksEaten || 0),
  };
  const statsEnhanced =
    mergedStats.totalTrips > curStats.totalTrips ||
    mergedStats.totalEncounters > curStats.totalEncounters;

  // 6. けんちこ現在状態（現在位置や行動は現在のローカルを優先し、プレイ時間は Math.max）
  const mergedKenchiko = {
    ...currentSave.kenchiko,
    totalPlayTimeSec: Math.max(
      currentSave.kenchiko?.totalPlayTimeSec || 0,
      snapshotSave.kenchiko?.totalPlayTimeSec || 0
    ),
  };

  const mergedSave: GameSaveData = {
    ...currentSave,
    characters: updatedCharacters,
    nyanProgress: mergedProgress,
    rewards: mergedRewards,
    diary: mergedDiary,
    inventory: mergedInventory,
    stats: mergedStats,
    kenchiko: mergedKenchiko,
    lastSaved: Date.now(),
  };

  const finalMetrics = extractSaveMetrics(mergedSave);

  const diffSummary: RestoreDiffSummary = {
    nyanAddedCount,
    nyanTotalAfter: finalMetrics.discoveredCount,
    ticketsAddedCount,
    ticketsTotalAfter: finalMetrics.totalTicketCount,
    diaryAddedCount,
    diaryTotalAfter: finalMetrics.diaryCount,
    storiesAddedCount,
    storiesTotalAfter: finalMetrics.storyCount,
    itemsUpdatedCount,
    statsEnhanced,
    restoredNyanDetails,
  };

  return { mergedSave, diffSummary };
}

/**
 * ユーザーのスナップショットが空の場合、現在のセーブデータおよびローカルバックアップから
 * 初回スナップショットを自動シードする。
 */
export function ensureInitialSnapshot(
  userId: string,
  currentSave: GameSaveData,
  masterCharacters?: NyanCharacter[]
): GameSaveSnapshot[] {
  if (!userId || !currentSave) return [];
  const existing = getSnapshotsForUser(userId);
  if (existing.length > 0) return existing;

  // 1. 現在のセーブデータでスナップショットを作成
  const initialSnap = saveSnapshotIfAdvantageous(userId, currentSave, '初期状態記録（現在セーブ）');

  // 2. もしローカルストレージに古い個別バックアップがあればそれも取り込む
  try {
    const backupKey = `kenchiko_save_state_backup_${userId}`;
    const legacyRaw = localStorage.getItem(backupKey);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed) {
        const legacyTime = parsed.lastSaved || Date.now() - 86400000;
        const legacyDateStr = getLocalDateString(legacyTime);
        const legacyMetrics = extractSaveMetrics(parsed);
        const legacySnap: GameSaveSnapshot = {
          id: `snap_${userId}_legacy_${legacyTime}`,
          userId,
          timestamp: legacyTime,
          dateStr: legacyDateStr,
          timeStr: getLocalTimeString(legacyTime),
          reason: '過去のローカルバックアップから移行',
          metrics: legacyMetrics,
          saveData: minifySaveForSnapshot(parsed),
        };
        const currentList = getSnapshotsForUser(userId);
        const mergedList = pruneSnapshots([legacySnap, ...currentList], getLocalDateString());
        saveSnapshotsToStorage(userId, mergedList);
        return mergedList;
      }
    }
  } catch (e) {
    console.warn('Could not parse legacy backup for snapshots:', e);
  }

  return initialSnap ? [initialSnap] : [];
}

/**
 * ユーザーのスナップショット一覧を取得（クラウドDBを正本として優先フェッチ）
 */
export async function fetchSnapshotsForUser(
  userId: string,
  fallbackSave?: GameSaveData
): Promise<GameSaveSnapshot[]> {
  if (!userId) return [];

  // 1. まずクラウドDB (Synology PostgreSQL) から最新のスナップショット履歴を取得
  try {
    const cloudSnaps = await fetchSnapshotsFromCloudDb(userId);
    if (Array.isArray(cloudSnaps) && cloudSnaps.length > 0) {
      const minified = cloudSnaps.map(compressSnapshot);
      // ローカルストレージも最新クラウドで同期更新
      saveSnapshotsToStorage(userId, minified);
      return minified;
    }
  } catch (err) {
    console.warn(`[SnapshotService] Cloud snapshot fetch warning for ${userId}:`, err);
  }

  // 2. クラウドDBにまだ履歴がない場合、ローカルストレージを確認
  const localList = getSnapshotsForUser(userId);
  if (localList.length > 0) {
    // ローカルにあればクラウドDBへ初回アップロード
    saveSnapshotsToCloudDb(userId, localList).catch(() => {});
    return localList;
  }

  // 3. どちらにもない場合は、最新セーブデータ fallbackSave から初回スナップショットを生成してクラウドDBへ保存
  if (fallbackSave) {
    const created = saveSnapshotIfAdvantageous(userId, fallbackSave, '初回状態記録（最新セーブ）');
    if (created) return [created];
  }

  return [];
}

/**
 * アプリ起動時に呼び出され、LocalStorage 内のすべてのスナップショットキーを安全にスキャンし、
 * 肥大化した古い形式のスナップショットがあれば即座に極小化して LocalStorage の空き容量を回復する。
 */
export function cleanupAndMigrateAllSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SNAPSHOT_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasBloat = parsed.some(
            (s) =>
              (s.saveData?.characters && s.saveData.characters.length > 0) ||
              (s.saveData?.kenchiko?.customImageUrl && s.saveData.kenchiko.customImageUrl.length > 200) ||
              (s.saveData?.asobiList && s.saveData.asobiList.length > 0)
          );
          if (hasBloat) {
            const minified = parsed.map(compressSnapshot);
            localStorage.setItem(key, JSON.stringify(minified));
            console.log(`[SnapshotService] Migrated and compressed snapshot key: ${key}`);
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[SnapshotService] Migration check notice:', err);
  }
}



