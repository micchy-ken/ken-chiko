import { NyanCharacter } from '../types';

/**
 * Normalizes Google Drive links or image URLs to direct-viewable image endpoints.
 * Handles:
 * - https://drive.google.com/file/d/{ID}/view -> https://lh3.googleusercontent.com/d/{ID}
 * - https://drive.google.com/open?id={ID} -> https://lh3.googleusercontent.com/d/{ID}
 * - https://drive.google.com/uc?id={ID} -> https://lh3.googleusercontent.com/d/{ID}
 * - Direct HTTP(S) image URLs or data URLs
 */
export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  if (!url) return '';

  // Google Drive file link match
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (idParamMatch && idParamMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
    }
  }

  // Already a direct lh3 or other image link
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
    return url;
  }

  return url;
}

export function exportNyansToCsv(nyans: NyanCharacter[]): string {
  const header = 'No.,キャラクター名,よみ,モチーフ・元ネタ,初登場時期,設定・主なエピソード,画像生成プロンプト（日本語：B-1 ゆるかわ脱力ペン画風）,画像生成プロンプト（英語：ImageFX / Midjourney等）,画像URL（Googleドライブ等のリンク）,ねこのセリフ,セリフの意味\n';

  const escapeCsv = (str: string) => {
    if (!str) return '""';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = nyans.map((n) => {
    return [
      n.no,
      escapeCsv(n.name),
      escapeCsv(n.reading),
      escapeCsv(n.motif),
      escapeCsv(n.firstAppeared),
      escapeCsv(n.episode),
      escapeCsv(n.promptJa),
      escapeCsv(n.promptEn),
      escapeCsv(n.customImageUrl || ''),
      escapeCsv(n.dialogue || ''),
      escapeCsv(n.dialogueMeaning || ''),
    ].join(',');
  });

  return header + rows.join('\n');
}

export function mergeImportedCsv(
  csvText: string,
  currentNyans: NyanCharacter[]
): { updatedNyans: NyanCharacter[]; addedCount: number; updatedCount: number } {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = '';
    } else if (char !== '\r') {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const existingMap = new Map<number, NyanCharacter>();
  currentNyans.forEach((n) => existingMap.set(n.no, n));

  let addedCount = 0;
  let updatedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens: string[] = [];
    let curToken = '';
    let inside = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inside = !inside;
      } else if (c === ',' && !inside) {
        tokens.push(curToken.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        curToken = '';
      } else {
        curToken += c;
      }
    }
    tokens.push(curToken.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    if (tokens.length >= 2) {
      const no = parseInt(tokens[0], 10);
      if (isNaN(no)) continue;

      const name = tokens[1] || `にゃん #${no}`;
      const reading = tokens[2] || name;
      const motif = tokens[3] || '';
      const firstAppeared = tokens[4] || '';
      const episode = tokens[5] || '';
      const promptJa = tokens[6] || '';
      const promptEn = tokens[7] || '';

      // Column I (Index 8): ねこのセリフ or image URL (if older 9-column CSV format)
      // Column J (Index 9): セリフの意味
      // Check if tokens[8] looks like an image URL or if it's a dialogue string
      let dialogue = '';
      let dialogueMeaning = '';
      let rawImageUrl = '';

      const token8 = tokens[8] || '';
      const token9 = tokens[9] || '';
      const token10 = tokens[10] || '';

      const isUrl = (s: string) => s && (s.includes('http://') || s.includes('https://') || s.includes('drive.google.com') || s.startsWith('data:image'));

      if (isUrl(token8)) {
        // Old layout where col 8 was image URL
        rawImageUrl = token8;
        dialogue = token9;
        dialogueMeaning = token10;
      } else {
        // New layout where col 8 (I列) is ねこのセリフ, col 9 (J列) is セリフの意味
        dialogue = token8;
        dialogueMeaning = token9;
        // Check if there is an image URL in token 10 or later
        const urlCandidate = tokens.slice(8).find((t) => isUrl(t));
        if (urlCandidate) rawImageUrl = urlCandidate;
      }

      const importedImageUrl = normalizeImageUrl(rawImageUrl);

      const existing = existingMap.get(no);
      if (existing) {
        // Keep progress & update custom image if provided, update lore/prompts/dialogue
        existingMap.set(no, {
          ...existing,
          name,
          reading,
          motif,
          firstAppeared: firstAppeared || existing.firstAppeared,
          episode: episode || existing.episode,
          promptJa: promptJa || existing.promptJa,
          promptEn: promptEn || existing.promptEn,
          dialogue: dialogue || existing.dialogue,
          dialogueMeaning: dialogueMeaning || existing.dialogueMeaning,
          customImageUrl: importedImageUrl || existing.customImageUrl,
        });
        updatedCount++;
      } else {
        // New character added in weekly update!
        existingMap.set(no, {
          no,
          name,
          reading,
          motif,
          firstAppeared,
          episode,
          promptJa,
          promptEn,
          dialogue: dialogue || undefined,
          dialogueMeaning: dialogueMeaning || undefined,
          discovered: false,
          playCount: 0,
          friendshipLevel: 0,
          customImageUrl: importedImageUrl || undefined,
        });
        addedCount++;
      }
    }
  }

  const updatedNyans = Array.from(existingMap.values()).sort((a, b) => a.no - b.no);
  return { updatedNyans, addedCount, updatedCount };
}
