import { NyanCharacter } from '../types';
import { mergeImportedCsv } from '../utils/csvParser';

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
 * Transforms various Google Doc / Sheet sharing URLs into downloadable text/csv endpoints.
 * Handles:
 * - Google Spreadsheets: /spreadsheets/d/{ID}/edit -> /spreadsheets/d/{ID}/export?format=csv
 * - Google Spreadsheets pubhtml: /pub?output=csv
 * - Google Documents: /document/d/{ID}/edit -> /document/d/{ID}/export?format=txt
 * - Plain published URLs
 */
export function convertToExportUrl(inputUrl: string): string {
  const url = inputUrl.trim();
  if (!url) return '';

  // 1. Google Spreadsheets
  if (url.includes('docs.google.com/spreadsheets/d/')) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      // Check if specific gid exists
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gidParam = gidMatch && gidMatch[1] ? `&gid=${gidParamFromGid(gidMatch[1])}` : '';
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
    }
  }

  // 2. Google Spreadsheets published to web (pub?output=csv or pubhtml)
  if (url.includes('docs.google.com/spreadsheets') && url.includes('/pub')) {
    if (url.includes('output=csv')) return url;
    return url.replace(/\/pubhtml.*/, '/pub?output=csv').replace(/\/pub.*/, '/pub?output=csv');
  }

  // 3. Google Documents
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

function gidParamFromGid(gid: string): string {
  return gid;
}

/**
 * Attempts to fetch content from Google Docs/Sheets URL using CORS-safe fetch
 * with public proxy fallbacks if direct CORS is restricted.
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
 * Fetches latest doc content and merges it with existing character progress
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
