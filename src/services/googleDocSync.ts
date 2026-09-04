import { NyanCharacter } from '../types';
import { mergeImportedCsv, normalizeImageUrl } from '../utils/csvParser';

const GOOGLE_DOC_CONFIG_KEY = 'kenchiko_google_doc_url_v1';

// Default provided Google Docs / Sheets URL
export const DEFAULT_GOOGLE_DOC_URL =
  'https://docs.google.com/spreadsheets/d/1EVgPLTVb22a4ZUPVaQxbjP7IFnknBVWAYRynDixNvCA/edit?usp=sharing';

export function getSavedGoogleDocUrl(): string {
  try {
    return (
      localStorage.getItem(GOOGLE_DOC_CONFIG_KEY) || DEFAULT_GOOGLE_DOC_URL
    );
  } catch {
    return DEFAULT_GOOGLE_DOC_URL;
  }
}

export function saveGoogleDocUrl(url: string): void {
  try {
    localStorage.setItem(GOOGLE_DOC_CONFIG_KEY, url.trim());
  } catch (err) {
    console.error('Failed to save Google Doc URL', err);
  }
}

/**
 * Extracts Google Spreadsheet ID and GID from sharing URL
 */
export function extractSpreadsheetInfo(inputUrl: string): { sheetId: string; gid?: string } | null {
  const url = inputUrl.trim();
  if (!url) return null;

  if (url.includes('docs.google.com/spreadsheets')) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      return {
        sheetId,
        gid: gidMatch && gidMatch[1] ? gidMatch[1] : undefined,
      };
    }
  }
  return null;
}

/**
 * Converts a Google Spreadsheet URL into the direct Google Visualization API endpoint (/gviz/tq).
 * This endpoint has open CORS headers (Access-Control-Allow-Origin: *) allowing direct browser fetch
 * without needing an API key or proxy.
 */
export function convertToGvizUrl(inputUrl: string): string | null {
  const info = extractSpreadsheetInfo(inputUrl);
  if (!info) return null;

  const gidParam = info.gid ? `&gid=${info.gid}` : '';
  return `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:json${gidParam}`;
}

/**
 * Transforms various Google Doc / Sheet sharing URLs into downloadable text/csv endpoints (fallback).
 */
export function convertToExportUrl(inputUrl: string): string {
  const url = inputUrl.trim();
  if (!url) return '';

  const info = extractSpreadsheetInfo(url);
  if (info) {
    const gidParam = info.gid ? `&gid=${info.gid}` : '';
    return `https://docs.google.com/spreadsheets/d/${info.sheetId}/export?format=csv${gidParam}`;
  }

  // Google Spreadsheets published to web (pub?output=csv or pubhtml)
  if (url.includes('docs.google.com/spreadsheets') && url.includes('/pub')) {
    if (url.includes('output=csv')) return url;
    return url.replace(/\/pubhtml.*/, '/pub?output=csv').replace(/\/pub.*/, '/pub?output=csv');
  }

  // Google Documents
  if (url.includes('docs.google.com/document/d/')) {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const docId = match[1];
      return `https://docs.google.com/document/d/${docId}/export?format=txt`;
    }
  }

  // Direct CSV or other raw link
  return url;
}

/**
 * Parses Google Visualization API response format and merges into NyanCharacter array.
 */
export function parseGvizAndMergeNyans(
  rawText: string,
  currentNyans: NyanCharacter[]
): { updatedNyans: NyanCharacter[]; addedCount: number; updatedCount: number } {
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Google Visualization APIのデータ形式を解析できませんでした');
  }

  const jsonStr = rawText.substring(startIdx, endIdx + 1);
  const data = JSON.parse(jsonStr);

  if (!data.table || !Array.isArray(data.table.rows)) {
    throw new Error('スプレッドシートのテーブルデータが見つかりませんでした');
  }

  const existingMap = new Map<number, NyanCharacter>();
  currentNyans.forEach((n) => existingMap.set(n.no, n));

  let addedCount = 0;
  let updatedCount = 0;

  const rows = data.table.rows;

  for (const row of rows) {
    if (!row || !Array.isArray(row.c)) continue;

    const cells = row.c.map((cell: any) =>
      cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : ''
    );

    // Skip empty rows
    if (cells.length === 0 || !cells[0]) continue;

    // Check if first cell is a number (No.)
    const no = parseInt(cells[0], 10);
    if (isNaN(no) || no <= 0) {
      // Header row or non-numeric label, skip
      continue;
    }

    const name = cells[1] || `にゃん #${no}`;
    const reading = cells[2] || name;
    const motif = cells[3] || '';
    const firstAppeared = cells[4] || '';
    const episode = cells[5] || '';
    const promptJa = cells[6] || '';
    const promptEn = cells[7] || '';

    const val8 = cells[8] || '';
    const val9 = cells[9] || '';
    const val10 = cells[10] || '';

    const isUrl = (s: string) =>
      s && (s.includes('http://') || s.includes('https://') || s.includes('drive.google.com') || s.startsWith('data:image'));

    let dialogue = '';
    let dialogueMeaning = '';
    let rawImageUrl = '';

    if (isUrl(val8)) {
      // Legacy format: Col 8 was Image URL
      rawImageUrl = val8;
      dialogue = val9;
      dialogueMeaning = val10;
    } else {
      // New format: Col 8 (I列) is ねこのセリフ, Col 9 (J列) is セリフの意味
      dialogue = val8;
      dialogueMeaning = val9;
      // Search for image URL in remaining columns
      const urlCandidate = cells.slice(8).find((t: string) => isUrl(t));
      if (urlCandidate) rawImageUrl = urlCandidate;
    }

    const importedImageUrl = normalizeImageUrl(rawImageUrl);
    const existing = existingMap.get(no);

    if (existing) {
      existingMap.set(no, {
        ...existing,
        name,
        reading,
        motif,
        firstAppeared,
        episode,
        promptJa,
        promptEn,
        dialogue: dialogue || existing.dialogue || undefined,
        dialogueMeaning: dialogueMeaning || existing.dialogueMeaning || undefined,
        customImageUrl: importedImageUrl ? importedImageUrl : existing.customImageUrl,
      });
      updatedCount++;
    } else {
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
        customImageUrl: importedImageUrl ? importedImageUrl : undefined,
        discovered: false,
        friendshipLevel: 1,
        playCount: 0,
      });
      addedCount++;
    }
  }

  const updatedNyans = Array.from(existingMap.values()).sort((a, b) => a.no - b.no);
  return { updatedNyans, addedCount, updatedCount };
}

/**
 * Attempts to fetch content from Google Docs/Sheets URL using CORS-safe fetch
 * with Google Visualization API direct fetch as first-class, and public proxy fallbacks.
 */
export async function fetchGoogleDocContent(docUrl: string): Promise<string> {
  const exportUrl = convertToExportUrl(docUrl);
  if (!exportUrl) throw new Error('URLが指定されていません');

  // Try direct fetch first
  try {
    const res = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/plain, text/csv, */*',
      },
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) return text;
    }
  } catch {
    // If direct CORS fetch is blocked, fallback to CORS proxies
  }

  // Fallback 1: allorigins proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const text = await proxyRes.text();
      if (text && text.trim().length > 0) return text;
    }
  } catch {
    // Silently continue to next fallback
  }

  // Fallback 2: corsproxy.io
  try {
    const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(exportUrl)}`;
    const proxyRes2 = await fetch(proxyUrl2);
    if (proxyRes2.ok) {
      const text = await proxyRes2.text();
      if (text && text.trim().length > 0) return text;
    }
  } catch {
    // Silently continue
  }

  throw new Error('Googleドキュメントの取得に失敗しました。URLの公開設定（リンクを知っている全員が閲覧可）をご確認ください。');
}

/**
 * Fetches latest spreadsheet / doc content and merges it with existing character progress.
 * Uses Google Visualization API (/gviz/tq) directly for fast, seamless, zero-CORS sync.
 */
export async function syncNyansFromGoogleDoc(
  docUrl: string,
  currentNyans: NyanCharacter[]
): Promise<{
  success: boolean;
  updatedNyans: NyanCharacter[];
  addedCount: number;
  updatedCount: number;
  error?: string;
}> {
  try {
    const gvizUrl = convertToGvizUrl(docUrl);

    // 1. Primary Method: Google Visualization API (/gviz/tq) direct fetch
    if (gvizUrl) {
      try {
        const res = await fetch(gvizUrl, {
          method: 'GET',
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('google.visualization.Query.setResponse')) {
            const { updatedNyans, addedCount, updatedCount } = parseGvizAndMergeNyans(
              text,
              currentNyans
            );
            return {
              success: true,
              updatedNyans,
              addedCount,
              updatedCount,
            };
          }
        }
      } catch (gvizErr) {
        console.warn('GViz fetch failed, trying CSV export fallback...', gvizErr);
      }
    }

    // 2. Secondary Method: CSV / Text Export fetch fallback
    const text = await fetchGoogleDocContent(docUrl);
    const { updatedNyans, addedCount, updatedCount } = mergeImportedCsv(text, currentNyans);
    return {
      success: true,
      updatedNyans,
      addedCount,
      updatedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      updatedNyans: currentNyans,
      addedCount: 0,
      updatedCount: 0,
      error: err.message || 'データ同期エラーが発生しました',
    };
  }
}

