import { NyanCharacter } from '../types';

export function exportNyansToCsv(nyans: NyanCharacter[]): string {
  const header = 'No.,キャラクター名,よみ,モチーフ・元ネタ,初登場時期,設定・主なエピソード,画像生成プロンプト（日本語：B-1 ゆるかわ脱力ペン画風）,画像生成プロンプト（英語：ImageFX / Midjourney等）\n';

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

      const existing = existingMap.get(no);
      if (existing) {
        // Keep progress & custom image, update lore/prompts
        existingMap.set(no, {
          ...existing,
          name,
          reading,
          motif,
          firstAppeared: firstAppeared || existing.firstAppeared,
          episode: episode || existing.episode,
          promptJa: promptJa || existing.promptJa,
          promptEn: promptEn || existing.promptEn,
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
          discovered: false,
          playCount: 0,
          friendshipLevel: 0,
        });
        addedCount++;
      }
    }
  }

  const updatedNyans = Array.from(existingMap.values()).sort((a, b) => a.no - b.no);
  return { updatedNyans, addedCount, updatedCount };
}
