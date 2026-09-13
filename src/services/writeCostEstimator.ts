import { NyanCharacter, GameMasterData } from '../types';

/**
 * Payload size & write count estimation helper
 */
export interface WriteCostEstimate {
  bytes: number;
  kb: number;
  docWrites: number;
  breakdown: {
    name: string;
    docId: string;
    bytes: number;
    kb: number;
    docWrites: number;
  }[];
}

/**
 * Calculates byte size and actual Firestore document write units for an operation
 * Firestore Billing Rule: 1 document written = exactly 1 Write (regardless of document size up to 1MB).
 * The byte size represents network payload (Egress/Ingress bandwidth).
 */
export function estimateObjectWriteCost(name: string, docId: string, obj: any): { name: string; docId: string; bytes: number; kb: number; docWrites: number } {
  try {
    const json = JSON.stringify(obj || {});
    // UTF-8 byte length
    const bytes = new TextEncoder().encode(json).length;
    const kb = parseFloat((bytes / 1024).toFixed(1));
    // Firestore write units: 1 document written = exactly 1 Write
    const docWrites = 1;
    return { name, docId, bytes, kb, docWrites };
  } catch {
    return { name, docId, bytes: 0, kb: 0, docWrites: 1 };
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

  const breakdown: { name: string; docId: string; bytes: number; kb: number; docWrites: number }[] = [];

  // 1. Manifest / Version ledger (< 1 KB, exactly 1 document write)
  breakdown.push(estimateObjectWriteCost('バージョン台帳', 'ken-chiko-master-manifest', {
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
      hasCustomImage: Boolean(n.customImageUrl),
    }));
    breakdown.push(estimateObjectWriteCost('図鑑名簿テキスト (264体)', 'ken-chiko-master-characters', {
      characters: lightCharacters,
    }));
  }

  // 3. Asobi & Ouen
  if (includeAsobiOuen) {
    breakdown.push(estimateObjectWriteCost('あそび・応援マスター', 'ken-chiko-master-asobi', {
      asobiList: master.asobiList || [],
      ouenCategories: master.ouenCategories || [],
      ouenList: master.ouenList || [],
      googleDriveFolderUrl: master.googleDriveFolderUrl || null,
    }));
  }

  // 4. Large Base64 Assets
  if (includeAssets) {
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
    breakdown.push(estimateObjectWriteCost('画像アセット (Base64)', 'ken-chiko-master-assets', {
      customImages: customImagesMap,
      kihonNyanCustomImageUrl: master.kihonNyanCustomImageUrl || null,
      kounichan: master.kounichan || null,
    }));
  }

  const totalBytes = breakdown.reduce((acc, b) => acc + b.bytes, 0);
  const totalKb = parseFloat((totalBytes / 1024).toFixed(1));
  const totalWrites = breakdown.reduce((acc, b) => acc + b.docWrites, 0);

  return {
    bytes: totalBytes,
    kb: totalKb,
    docWrites: totalWrites,
    breakdown,
  };
}
