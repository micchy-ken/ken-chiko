import { NyanCharacter } from '../types';
import { RAW_CSV_PART1 } from './rawCsvPart1';
import { RAW_CSV_PART2 } from './rawCsvPart2';
import { RAW_CSV_PART3 } from './rawCsvPart3';
import { getAssetUrl } from '../utils/assetPath';

export const RAW_DEFAULT_CSV = `${RAW_CSV_PART1.trim()}\n${RAW_CSV_PART2.trim()}\n${RAW_CSV_PART3.trim()}`;

export function parseCsvToNyans(csvText: string): NyanCharacter[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    } else if (char === '\r') {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  const result: NyanCharacter[] = [];

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

    if (tokens.length >= 6) {
      const no = parseInt(tokens[0], 10) || i;
      const name = tokens[1] || `にゃん #${no}`;
      const reading = tokens[2] || name;
      const motif = tokens[3] || '不明';
      const firstAppeared = tokens[4] || '';
      const episode = tokens[5] || '';
      const promptJa = tokens[6] || '';
      const promptEn = tokens[7] || '';

      // Column 8 (I列): ねこのセリフ or image URL
      // Column 9 (J列): セリフの意味
      let dialogue = '';
      let dialogueMeaning = '';
      let rawImageUrl = '';

      const token8 = tokens[8] || '';
      const token9 = tokens[9] || '';
      const isUrl = (s: string) => s && (s.includes('http://') || s.includes('https://') || s.includes('drive.google.com') || s.startsWith('data:image') || s.startsWith('images/'));

      if (isUrl(token8)) {
        rawImageUrl = token8;
        dialogue = token9;
        dialogueMeaning = tokens[10] || '';
      } else {
        dialogue = token8;
        dialogueMeaning = token9;
        const urlCandidate = tokens.slice(8).find((t) => isUrl(t));
        if (urlCandidate) rawImageUrl = urlCandidate;
      }

      // Initially unlock character 1, 4, 5, 53, 88 as discovered or start fresh with 1 discovered
      const isInitialDiscovered = no === 1 || no === 4 || no === 5 || no === 53 || no === 88;

      const customImageUrl = no === 88 ? getAssetUrl('images/homura-nyan-square.jpg') : (rawImageUrl ? getAssetUrl(rawImageUrl) : undefined);

      result.push({
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
        customImageUrl,
        discovered: isInitialDiscovered,
        discoveryDate: isInitialDiscovered ? '2026/08/31 12:00' : undefined,
        playCount: isInitialDiscovered ? 1 : 0,
        friendshipLevel: isInitialDiscovered ? 1 : 0,
      });
    }
  }

  return result;
}

export const INITIAL_NYANS: NyanCharacter[] = parseCsvToNyans(RAW_DEFAULT_CSV);
