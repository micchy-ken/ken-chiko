/**
 * Data Separation & Transformation Utilities
 * 
 * けんちこワールドの「公式マスターデータ」と「ユーザー固有進行度データ」を
 * 構造的・論理的に完全分離し、安全に合成・変換するためのユーティリティです。
 * 
 * 4重セーフティネット原則:
 * 1. 公式マスターデータにはユーザー進行度（発見・親密度など）を1ミリも混入させない
 * 2. ユーザー個別データにはマスター定義（セリフ・画像など）を混入させない
 * 3. 常に「ユーザーに有利なマージ（進行度が高い方を絶対採用）」を適用する
 * 4. 寛容な抽出（旧形式や破損形式のデータからも進行度を100%救出する）
 */

import {
  MasterNyanCharacter,
  UserNyanProgress,
  NyanCharacter,
  GameMasterData,
  UserProgressData,
  GameSaveData,
} from '../types';

/**
 * 任意のキャラクターオブジェクトからマスター定義のみを抽出・クレンジングする。
 * ユーザー進行度（discovered, friendshipLevel, playCount, lastMetAt など）は
 * 完全に削除されます。
 */
export function cleanseMasterCharacter(raw: any): MasterNyanCharacter {
  if (!raw || typeof raw !== 'object') {
    return {
      no: 0,
      name: '不明なにゃんこ',
      reading: 'ふめいなにゃんこ',
      motif: '',
      firstAppeared: '',
      episode: '',
      promptJa: '',
      promptEn: '',
    };
  }

  const clean: MasterNyanCharacter = {
    no: Number(raw.no) || 0,
    name: String(raw.name || '').trim() || `にゃんこ No.${raw.no}`,
    reading: String(raw.reading || raw.name || '').trim(),
    motif: String(raw.motif || '').trim(),
    firstAppeared: String(raw.firstAppeared || '').trim(),
    episode: String(raw.episode || '').trim(),
    promptJa: String(raw.promptJa || '').trim(),
    promptEn: String(raw.promptEn || '').trim(),
  };

  if (raw.dialogue) clean.dialogue = String(raw.dialogue).trim();
  if (raw.dialogueMeaning) clean.dialogueMeaning = String(raw.dialogueMeaning).trim();
  if (typeof raw.hasStory === 'boolean') clean.hasStory = raw.hasStory;
  if (raw.customImageUrl) clean.customImageUrl = String(raw.customImageUrl);
  if (raw.rawImageUrl) clean.rawImageUrl = String(raw.rawImageUrl);
  if (typeof raw.hasCustomImage === 'boolean') clean.hasCustomImage = raw.hasCustomImage;
  if (raw.transparency && typeof raw.transparency === 'object') {
    clean.transparency = {
      enableTransparency: Boolean(raw.transparency.enableTransparency),
      tolerance: Math.max(5, Math.min(80, Number(raw.transparency.tolerance) || 30)),
      trimPadding: Boolean(raw.transparency.trimPadding),
    };
  }
  if (Array.isArray(raw.favoriteItems)) {
    clean.favoriteItems = raw.favoriteItems.map(String);
  }
  if (Array.isArray(raw.favoriteLocations)) {
    clean.favoriteLocations = raw.favoriteLocations as any[];
  }

  return clean;
}

/**
 * マスターキャラクター配列を一括クレンジング・整列する。
 */
export function cleanseMasterCharacters(rawList: any[]): MasterNyanCharacter[] {
  if (!Array.isArray(rawList)) return [];
  const map = new Map<number, MasterNyanCharacter>();

  for (const item of rawList) {
    const cleansed = cleanseMasterCharacter(item);
    if (cleansed.no > 0) {
      // 既存定義があれば上書き（後勝ち）、または保持
      map.set(cleansed.no, cleansed);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.no - b.no);
}

/**
 * 任意のオブジェクトからユーザー進行度のみを安全に抽出する。
 */
export function extractUserNyanProgress(raw: any): UserNyanProgress {
  if (!raw || typeof raw !== 'object') {
    return {
      discovered: false,
      playCount: 0,
      friendshipLevel: 1,
    };
  }

  const isDiscovered = Boolean(raw.discovered || raw.discoveryDate);
  const friendshipLevel = Math.max(1, Number(raw.friendshipLevel) || 1);
  const playCount = Math.max(0, Number(raw.playCount) || 0);
  const lastMetAt = Number(raw.lastMetAt) || undefined;
  const discoveryDate = raw.discoveryDate ? String(raw.discoveryDate) : undefined;

  const progress: UserNyanProgress = {
    discovered: isDiscovered,
    playCount,
    friendshipLevel,
  };

  if (discoveryDate) progress.discoveryDate = discoveryDate;
  if (lastMetAt && lastMetAt > 0) progress.lastMetAt = lastMetAt;

  return progress;
}

/**
 * キャラクターリストまたは旧形式オブジェクトから進行度マップを作成する。
 */
export function extractProgressMap(
  charactersOrProgress: any
): Record<number, UserNyanProgress> {
  const result: Record<number, UserNyanProgress> = {};
  if (!charactersOrProgress) return result;

  // 1. すでにマップ形式 (nyanProgress: Record<number, ...>) の場合
  if (!Array.isArray(charactersOrProgress) && typeof charactersOrProgress === 'object') {
    for (const [key, val] of Object.entries(charactersOrProgress)) {
      const no = Number(key);
      if (no > 0 && val) {
        const p = extractUserNyanProgress(val);
        // 意味のある進行度がある場合のみ保持
        if (p.discovered || p.friendshipLevel > 1 || p.playCount > 0 || p.lastMetAt) {
          result[no] = p;
        }
      }
    }
    return result;
  }

  // 2. 配列形式 (characters: NyanCharacter[]) の場合
  if (Array.isArray(charactersOrProgress)) {
    for (const item of charactersOrProgress) {
      if (item && typeof item === 'object') {
        const no = Number(item.no);
        if (no > 0) {
          const p = extractUserNyanProgress(item);
          if (p.discovered || p.friendshipLevel > 1 || p.playCount > 0 || p.lastMetAt) {
            result[no] = p;
          }
        }
      }
    }
  }

  return result;
}

/**
 * 2つのユーザー進行度マップを「ユーザー有利マージ（Advantageous Merge）」で統合する。
 * - 発見済み (discovered) は true が絶対優先
 * - 親密度 (friendshipLevel) は大きい方が優先
 * - 遊び回数 (playCount) は大きい方が優先
 * - 最終遭遇時刻 (lastMetAt) は新しい方が優先
 * - 発見日 (discoveryDate) はすでにある方が優先（古い初遭遇日を保護）
 */
export function mergeUserProgressSafely(
  base: Record<number, UserNyanProgress> = {},
  incoming: Record<number, UserNyanProgress> = {}
): Record<number, UserNyanProgress> {
  const merged: Record<number, UserNyanProgress> = { ...base };

  for (const [key, incVal] of Object.entries(incoming)) {
    const no = Number(key);
    if (!no || !incVal) continue;

    const baseVal = merged[no];
    if (!baseVal) {
      merged[no] = { ...incVal };
      continue;
    }

    // 有利マージロジック
    const isDiscovered = Boolean(baseVal.discovered || incVal.discovered);
    const discoveryDate = baseVal.discoveryDate || incVal.discoveryDate;
    const friendshipLevel = Math.max(baseVal.friendshipLevel || 1, incVal.friendshipLevel || 1);
    const playCount = Math.max(baseVal.playCount || 0, incVal.playCount || 0);
    const lastMetAt = Math.max(baseVal.lastMetAt || 0, incVal.lastMetAt || 0);

    merged[no] = {
      discovered: isDiscovered,
      friendshipLevel,
      playCount,
      ...(discoveryDate ? { discoveryDate } : {}),
      ...(lastMetAt > 0 ? { lastMetAt } : {}),
    };
  }

  return merged;
}

/**
 * 公式マスター定義とユーザー進行度を安全に合成し、UIコンポーネント用の
 * NyanCharacter[] を生成する。
 * 
 * 整合性保証:
 * - キャラの名前・画像・セリフ・設定などは100%公式マスターの値を使用
 * - 発見状態・親密度・遭遇日は100%ユーザー進行度の値を使用
 */
export function composeCharacters(
  masterNyans: MasterNyanCharacter[],
  progressMap: Record<number, UserNyanProgress> = {}
): NyanCharacter[] {
  if (!Array.isArray(masterNyans)) return [];

  return masterNyans.map((master) => {
    const progress = progressMap[master.no];

    return {
      ...master,
      discovered: Boolean(progress?.discovered),
      discoveryDate: progress?.discoveryDate,
      lastMetAt: progress?.lastMetAt || 0,
      friendshipLevel: Math.max(progress?.friendshipLevel || 1, 1),
      playCount: progress?.playCount || 0,
    };
  });
}

/**
 * 統合GameSaveDataから純粋なUserProgressDataを抽出する。
 */
export function extractUserProgressFromSaveData(
  saveData: GameSaveData,
  userId?: string
): UserProgressData {
  const progressMap = extractProgressMap(saveData.characters);
  const discoveredNos = Object.entries(progressMap)
    .filter(([_, p]) => p.discovered)
    .map(([no]) => Number(no))
    .sort((a, b) => a - b);

  return {
    version: saveData.version || 1,
    userId: userId || undefined,
    kenchiko: { ...saveData.kenchiko },
    discoveredNyanNos: discoveredNos,
    nyanProgress: progressMap,
    inventory: Array.isArray(saveData.inventory) ? [...saveData.inventory] : [],
    diary: Array.isArray(saveData.diary) ? [...saveData.diary] : [],
    stats: {
      totalEncounters: saveData.stats?.totalEncounters || 0,
      totalSnacksEaten: saveData.stats?.totalSnacksEaten || 0,
      totalNapMinutes: saveData.stats?.totalNapMinutes || 0,
      totalTrips: saveData.stats?.totalTrips || 0,
    },
    rewards: saveData.rewards ? { ...saveData.rewards } : undefined,
    lastSaved: saveData.lastSaved || Date.now(),
  };
}

/**
 * 公式マスターとユーザー進行度から、React state用のGameSaveDataを合成する。
 */
export function composeGameSaveData(
  master: GameMasterData,
  progress: UserProgressData,
  extra?: Partial<GameSaveData>
): GameSaveData {
  const characters = composeCharacters(master.characters, progress.nyanProgress);

  return {
    version: master.version || 1,
    kenchiko: { ...progress.kenchiko },
    characters,
    inventory: progress.inventory ? [...progress.inventory] : [],
    diary: progress.diary ? [...progress.diary] : [],
    asobiList: master.asobiList ? [...master.asobiList] : [],
    ouenCategories: master.ouenCategories ? [...master.ouenCategories] : [],
    ouenList: master.ouenList ? [...master.ouenList] : [],
    kihonNyanCustomImageUrl: master.kihonNyanCustomImageUrl,
    googleDriveFolderUrl: master.googleDriveFolderUrl,
    stats: { ...progress.stats },
    rewards: progress.rewards ? { ...progress.rewards } : undefined,
    kounichan: master.kounichan,
    lastSaved: progress.lastSaved || Date.now(),
    githubRepo: extra?.githubRepo || 'ken-chiko',
    autoSyncGithub: extra?.autoSyncGithub ?? true,
  };
}
