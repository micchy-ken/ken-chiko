import { NyanCharacter, GameMasterData } from '../types';

/**
 * Payload size & write count estimation helper
 */
export interface WriteCostEstimate {
  bytes: number;
  kb: number;
  estimatedWrites: number;
  breakdown: {
    name: string;
    bytes: number;
    kb: number;
    estimatedWrites: number;
  }[];
}

/**
 * Calculates byte size and estimated Firestore write units for any object
 * Firestore Standard billing: 1 write per 1 KB + index entries overhead
 */
export function estimateObjectWriteCost(name: string, obj: any): { name: string; bytes: number; kb: number; estimatedWrites: number } {
  try {
    const json = JSON.stringify(obj || {});
    // UTF-8 byte length
    const bytes = new TextEncoder().encode(json).length;
    const kb = parseFloat((bytes / 1024).toFixed(1));
    // Firestore write units: 1 unit per 1 KB (minimum 1)
    const estimatedWrites = Math.max(1, Math.ceil(bytes / 1024));
    return { name, bytes, kb, estimatedWrites };
  } catch {
    return { name, bytes: 0, kb: 0, estimatedWrites: 1 };
  }
}

/**
 * Estimate the Firestore write cost for publishing master data split into modular documents
 */
export function estimateMasterPublishCost(
  master: GameMasterData,
  options: {
    includeCharactersText?: boolean;
    includeAsobiOuen?: boolean;
    includeAssets?: boolean;
  } = {}
): WriteCostEstimate {
  const {
    includeCharactersText = true,
    includeAsobiOuen = true,
    includeAssets = true,
  } = options;

  const breakdown: { name: string; bytes: number; kb: number; estimatedWrites: number }[] = [];

  // 1. Manifest / Version ledger (< 1 KB, exactly 1 write)
  breakdown.push(estimateObjectWriteCost('バージョン台帳 (マニフェスト)', {
    version: master.version || 1,
    charactersVersion: 1,
    asobiVersion: 1,
    assetsVersion: 1,
    updatedAt: Date.now(),
  }));

  // 2. Characters Index (Pure text only - NO base64 images)
  if (includeCharactersText) {
    const lightCharacters = (master.characters || []).map((n) => ({
      no: n.no,
      name: n.name,
      reading: n.reading,
      motif: n.motif,
      firstAppeared: n.firstAppeared,
      episode: n.episode,
      promptJa: n.promptJa,
      promptEn: n.promptEn,
      dialogue: n.dialogue,
      dialogueMeaning: n.dialogueMeaning,
      favoriteItems: n.favoriteItems,
      favoriteLocations: n.favoriteLocations,
      // External URLs are fine (< 100 bytes), but huge Base64 strings are isolated to assets doc
      hasCustomImage: Boolean(n.customImageUrl),
    }));
    breakdown.push(estimateObjectWriteCost('図鑑名簿テキスト (264体)', {
      characters: lightCharacters,
    }));
  }

  // 3. Asobi & Ouen
  if (includeAsobiOuen) {
    breakdown.push(estimateObjectWriteCost('あそび・応援マスター', {
      asobiList: master.asobiList || [],
      ouenCategories: master.ouenCategories || [],
      ouenList: master.ouenList || [],
      googleDriveFolderUrl: master.googleDriveFolderUrl || null,
    }));
  }

  // 4. Large Base64 Assets
  if (includeAssets) {
    // Only includes images that actually exist
    const customImagesMap: Record<number, { customImageUrl?: string; rawImageUrl?: string; transparency?: any }> = {};
    for (const c of master.characters || []) {
      if (c.customImageUrl || c.rawImageUrl) {
        customImagesMap[c.no] = {
          customImageUrl: c.customImageUrl,
          rawImageUrl: c.rawImageUrl,
          transparency: c.transparency,
        };
      }
    }
    breakdown.push(estimateObjectWriteCost('画像・アセットマスター (Base64画像)', {
      customImages: customImagesMap,
      kihonNyanCustomImageUrl: master.kihonNyanCustomImageUrl || null,
      kounichan: master.kounichan || null,
    }));
  }

  const totalBytes = breakdown.reduce((acc, b) => acc + b.bytes, 0);
  const totalKb = parseFloat((totalBytes / 1024).toFixed(1));
  const totalWrites = breakdown.reduce((acc, b) => acc + b.estimatedWrites, 0);

  return {
    bytes: totalBytes,
    kb: totalKb,
    estimatedWrites: totalWrites,
    breakdown,
  };
}
