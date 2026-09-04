import { NyanCharacter } from '../types';
import { mergeImportedCsv, normalizeImageUrl } from '../utils/csvParser';

const GOOGLE_DOC_CONFIG_KEY = 'kenchiko_google_doc_url_v1';
const GOOGLE_DOC_LAST_SYNC_KEY = 'kenchiko_google_doc_last_sync_v1';

export interface GoogleDocSyncInfo {
  timestamp: number;
  success: boolean;
  addedCount: number;
  updatedCount: number;
  totalCount: number;
  error?: string;
}

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

export function getLastGoogleDocSyncInfo(): GoogleDocSyncInfo | null {
  try {
    const raw = localStorage.getItem(GOOGLE_DOC_LAST_SYNC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLastGoogleDocSyncInfo(info: GoogleDocSyncInfo): void {
  try {
    localStorage.setItem(GOOGLE_DOC_LAST_SYNC_KEY, JSON.stringify(info));
  } catch {}
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
 * Helper to identify column mapping dynamically from headers or fallback
 */
function resolveColumnIndices(headers: string[]) {
  let noIdx = -1;
  let nameIdx = -1;
  let readingIdx = -1;
  let motifIdx = -1;
  let firstAppearedIdx = -1;
  let episodeIdx = -1;
  let promptJaIdx = -1;
  let promptEnIdx = -1;
  let dialogueIdx = -1;
  let dialogueMeaningIdx = -1;
  let imageIdx = -1;

  headers.forEach((header, idx) => {
    const h = header.toLowerCase().replace(/\s+/g, '');
    if (h.includes('no') || h.includes('番号') || h.includes('id')) {
      if (noIdx === -1) noIdx = idx;
    } else if (h.includes('キャラクター名') || h.includes('名前') || h.includes('キャラ名')) {
      if (nameIdx === -1) nameIdx = idx;
    } else if (h.includes('よみ') || h.includes('読み') || h.includes('フリガナ') || h.includes('ふりがな')) {
      if (readingIdx === -1) readingIdx = idx;
    } else if (h.includes('モチーフ') || h.includes('元ネタ')) {
      if (motifIdx === -1) motifIdx = idx;
    } else if (h.includes('初登場') || h.includes('登場時期')) {
      if (firstAppearedIdx === -1) firstAppearedIdx = idx;
    } else if (h.includes('設定') || h.includes('エピソード') || h.includes('主なエピソード')) {
      if (episodeIdx === -1) episodeIdx = idx;
    } else if (h.includes('日本語') || (h.includes('プロンプト') && h.includes('日'))) {
      if (promptJaIdx === -1) promptJaIdx = idx;
    } else if (h.includes('英語') || (h.includes('プロンプト') && (h.includes('英') || h.includes('imagefx')))) {
      if (promptEnIdx === -1) promptEnIdx = idx;
    } else if (h.includes('意味') || h.includes('セリフの意味') || h.includes('セリフ解説')) {
      if (dialogueMeaningIdx === -1) dialogueMeaningIdx = idx;
    } else if (h.includes('セリフ') || h.includes('台詞') || h.includes('ねこのセリフ')) {
      if (dialogueIdx === -1) dialogueIdx = idx;
    } else if (h.includes('画像') || h.includes('url') || h.includes('ドライブ') || h.includes('リンク')) {
      if (imageIdx === -1) imageIdx = idx;
    }
  });

  return {
    noIdx: noIdx >= 0 ? noIdx : 0,
    nameIdx: nameIdx >= 0 ? nameIdx : 1,
    readingIdx: readingIdx >= 0 ? readingIdx : 2,
    motifIdx: motifIdx >= 0 ? motifIdx : 3,
    firstAppearedIdx: firstAppearedIdx >= 0 ? firstAppearedIdx : 4,
    episodeIdx: episodeIdx >= 0 ? episodeIdx : 5,
    promptJaIdx: promptJaIdx >= 0 ? promptJaIdx : 6,
    promptEnIdx: promptEnIdx >= 0 ? promptEnIdx : 7,
    dialogueIdx: dialogueIdx >= 0 ? dialogueIdx : 8,
    dialogueMeaningIdx: dialogueMeaningIdx >= 0 ? dialogueMeaningIdx : 9,
    imageIdx: imageIdx >= 0 ? imageIdx : -1,
  };
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

  // Attempt header column detection if cols exist
  const headerLabels: string[] = [];
  if (Array.isArray(data.table.cols)) {
    data.table.cols.forEach((col: any) => {
      headerLabels.push(col && col.label ? String(col.label).trim() : '');
    });
  }

  const colMap = resolveColumnIndices(headerLabels);

  for (const row of rows) {
    if (!row || !Array.isArray(row.c)) continue;

    const cells = row.c.map((cell: any) =>
      cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : ''
    );

    // Skip empty rows
    if (cells.length === 0 || !cells[0]) continue;

    // Check if first cell or noIdx cell is a number (No.)
    const rawNo = cells[colMap.noIdx] || cells[0];
    const no = parseInt(rawNo, 10);
    if (isNaN(no) || no <= 0) {
      // Header row or non-numeric label, skip
      continue;
    }

    const name = cells[colMap.nameIdx] || `にゃん #${no}`;
    const reading = cells[colMap.readingIdx] || name;
    const motif = cells[colMap.motifIdx] || '';
    const firstAppeared = cells[colMap.firstAppearedIdx] || '';
    const episode = cells[colMap.episodeIdx] || '';
    const promptJa = cells[colMap.promptJaIdx] || '';
    const promptEn = cells[colMap.promptEnIdx] || '';

    const isUrl = (s: string) =>
      s && (s.includes('http://') || s.includes('https://') || s.includes('drive.google.com') || s.startsWith('data:image'));

    let dialogue = cells[colMap.dialogueIdx] || '';
    let dialogueMeaning = cells[colMap.dialogueMeaningIdx] || '';
    let rawImageUrl = colMap.imageIdx >= 0 ? cells[colMap.imageIdx] || '' : '';

    // If dialogue happens to contain an image URL or vice versa, reconcile
    if (isUrl(dialogue) && !rawImageUrl) {
      rawImageUrl = dialogue;
      dialogue = cells[9] || '';
      dialogueMeaning = cells[10] || '';
    } else if (!rawImageUrl) {
      const urlCandidate = cells.find((t: string) => isUrl(t));
      if (urlCandidate) rawImageUrl = urlCandidate;
    }

    const importedImageUrl = normalizeImageUrl(rawImageUrl);
    const existing = existingMap.get(no);

    if (existing) {
      existingMap.set(no, {
        ...existing,
        name: name || existing.name,
        reading: reading || existing.reading,
        motif: motif || existing.motif,
        firstAppeared: firstAppeared || existing.firstAppeared,
        episode: episode || existing.episode,
        promptJa: promptJa || existing.promptJa,
        promptEn: promptEn || existing.promptEn,
        dialogue: dialogue || existing.dialogue || undefined,
        dialogueMeaning: dialogueMeaning || existing.dialogueMeaning || undefined,
        customImageUrl: importedImageUrl ? importedImageUrl : existing.customImageUrl,
      });
      updatedCount++;
    } else {
      // Newly added character in spreadsheet!
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
      if (text && text.trim().length > 0 && !text.includes('<!DOCTYPE html>')) return text;
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
      if (text && text.trim().length > 0 && !text.includes('<!DOCTYPE html>')) return text;
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
      if (text && text.trim().length > 0 && !text.includes('<!DOCTYPE html>')) return text;
    }
  } catch {
    // Silently continue
  }

  throw new Error('Googleドキュメントの取得に失敗しました。スプレッドシートの共有設定（リンクを知っている全員が閲覧可）をご確認ください。');
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
            saveLastGoogleDocSyncInfo({
              timestamp: Date.now(),
              success: true,
              addedCount,
              updatedCount,
              totalCount: updatedNyans.length,
            });
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
    saveLastGoogleDocSyncInfo({
      timestamp: Date.now(),
      success: true,
      addedCount,
      updatedCount,
      totalCount: updatedNyans.length,
    });
    return {
      success: true,
      updatedNyans,
      addedCount,
      updatedCount,
    };
  } catch (err: any) {
    saveLastGoogleDocSyncInfo({
      timestamp: Date.now(),
      success: false,
      addedCount: 0,
      updatedCount: 0,
      totalCount: currentNyans.length,
      error: err.message || 'データ同期エラー',
    });
    return {
      success: false,
      updatedNyans: currentNyans,
      addedCount: 0,
      updatedCount: 0,
      error: err.message || 'データ同期エラーが発生しました',
    };
  }
}


