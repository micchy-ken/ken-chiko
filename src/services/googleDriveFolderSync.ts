import { NyanCharacter, NyanTransparencyOptions } from '../types';
import { compressAndResizeImage, TransparencyOptions } from './imageCompression';
import { normalizeImageUrl } from '../utils/csvParser';

const GOOGLE_DRIVE_FOLDER_CONFIG_KEY = 'kenchiko_google_drive_folder_url_v1';
export const DEFAULT_GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/12oZJR81BOONESN589upU32NylwCxmAwd?usp=sharing';

export interface DriveFileInfo {
  id: string;
  name: string;
  url: string; // direct lh3 viewable link
  size?: string;
  mimeType?: string;
}

export function getSavedGoogleDriveFolderUrl(): string {
  try {
    return (
      localStorage.getItem(GOOGLE_DRIVE_FOLDER_CONFIG_KEY) ||
      DEFAULT_GOOGLE_DRIVE_FOLDER_URL
    );
  } catch {
    return DEFAULT_GOOGLE_DRIVE_FOLDER_URL;
  }
}

export function saveGoogleDriveFolderUrl(url: string): void {
  try {
    localStorage.setItem(GOOGLE_DRIVE_FOLDER_CONFIG_KEY, url.trim());
  } catch (err) {
    console.error('Failed to save Google Drive folder URL', err);
  }
}

/**
 * Extracts Google Drive Folder ID from various URL formats:
 * - https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP
 * - https://drive.google.com/drive/u/0/folders/1aBcDeFgHiJkLmNoP
 * - https://drive.google.com/open?id=1aBcDeFgHiJkLmNoP
 * - https://drive.google.com/folderview?id=1aBcDeFgHiJkLmNoP
 * - 1aBcDeFgHiJkLmNoP (raw ID)
 */
export function extractFolderId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // /folders/ID
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
  if (matchFolders && matchFolders[1]) return matchFolders[1];

  // ?id=ID or &id=ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (matchId && matchId[1]) return matchId[1];

  // raw folder ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Normalizes character/file name for fuzzy matching.
 * e.g. "001_ほむらにゃん.png" -> "ほむらにゃん"
 * "No.1 ほむらにゃん" -> "ほむらにゃん"
 */
export function normalizeNameForMatch(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i, '')
    // remove leading number patterns: "01_", "No.1_", "No01_", "1-", "01."
    .replace(/^(no\.?|#)?\s*\d+[\s._\-ー]*/i, '')
    // remove trailing tags: "_透過", "_transparent", "_icon"
    .replace(/[._\-ー](透過|transparent|icon|trim|cut|bg).*$/i, '')
    .replace(/[\s\-_._・\u3000]/g, '')
    .trim();
}

/**
 * Fetches HTML/JSON from a public Google Drive folder and extracts file items.
 */
export async function fetchGoogleDriveFolderFiles(folderUrlOrId: string): Promise<DriveFileInfo[]> {
  const folderId = extractFolderId(folderUrlOrId);
  if (!folderId) {
    throw new Error('Google DriveのフォルダURLまたはフォルダIDが無効です。');
  }

  const fileMap = new Map<string, DriveFileInfo>();

  // Targets to try:
  // 1. Embedded folderview (HTML list)
  // 2. Drive folder web view (with initial data payload)
  const targets = [
    `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
    `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
    `https://drive.google.com/drive/folders/${folderId}`,
  ];

  let fetchErrors: string[] = [];

  for (const targetUrl of targets) {
    const proxies = [
      // Direct fetch
      async () => {
        const res = await fetch(targetUrl, { headers: { Accept: 'text/html,application/xhtml+xml,*/*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      },
      // allorigins proxy
      async () => {
        const pUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(pUrl);
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        return await res.text();
      },
      // corsproxy.io proxy
      async () => {
        const pUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const res = await fetch(pUrl);
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        return await res.text();
      },
    ];

    for (const fetcher of proxies) {
      try {
        const html = await fetcher();
        if (html && html.length > 200) {
          parseFilesFromDriveHtml(html, fileMap);
          if (fileMap.size > 0) {
            break; // found files!
          }
        }
      } catch (err: any) {
        fetchErrors.push(err.message || String(err));
      }
    }

    if (fileMap.size > 0) break;
  }

  if (fileMap.size === 0) {
    throw new Error(
      'Google Driveフォルダ内の画像一覧を取得できませんでした。フォルダの共有設定が「リンクを知っている全員（閲覧可）」になっているかご確認ください。'
    );
  }

  return Array.from(fileMap.values());
}

/**
 * Parses Google Drive embed HTML or full page JS payload for file IDs and filenames
 */
function parseFilesFromDriveHtml(html: string, fileMap: Map<string, DriveFileInfo>): void {
  // 1. Parse flip-entry (Classic Embedded folderview HTML)
  // e.g. <div class="flip-entry" id="entry-FILE_ID">...<div class="flip-entry-title">file.png</div>
  const entryRegex = /id="entry-([a-zA-Z0-9_-]{20,})"[^>]*>[\s\S]*?<div[^>]*class="[^"]*flip-entry-title[^"]*"[^>]*>([^<]+)<\/div>/g;
  let match;
  while ((match = entryRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();
    if (fileId && fileName) {
      fileMap.set(fileId, {
        id: fileId,
        name: fileName,
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
      });
    }
  }

  // 2. Parse direct file link patterns: href="https://drive.google.com/file/d/FILE_ID/view..." or thumbnail IDs
  const hrefRegex = /\/file\/d\/([a-zA-Z0-9_-]{25,})\/view[^"]*"[^>]*>([^<]+)<\/a>/g;
  while ((match = hrefRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();
    if (fileId && fileName && !fileMap.has(fileId)) {
      fileMap.set(fileId, {
        id: fileId,
        name: fileName,
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
      });
    }
  }

  // 3. Parse JSON array patterns inside Google Drive payload:
  // e.g. ["FILE_ID", "fileName.png", "image/png", ...] or [null, "fileName.png", ..., "FILE_ID"]
  const jsonFileRegex = /\["([a-zA-Z0-9_-]{25,})",\s*"([^"]+\.(?:png|jpg|jpeg|webp|gif|bmp|svg))"/gi;
  while ((match = jsonFileRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();
    if (fileId && fileName) {
      fileMap.set(fileId, {
        id: fileId,
        name: fileName,
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
      });
    }
  }

  // 4. Parse reverse JSON pattern: ["fileName.png", ..., "FILE_ID"]
  const reverseRegex = /"([^"]+\.(?:png|jpg|jpeg|webp|gif|bmp|svg))"[\s\S]{1,120}?"([a-zA-Z0-9_-]{28,})"/gi;
  while ((match = reverseRegex.exec(html)) !== null) {
    const fileName = match[1].trim();
    const fileId = match[2].trim();
    if (fileId && fileName && !fileMap.has(fileId)) {
      fileMap.set(fileId, {
        id: fileId,
        name: fileName,
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
      });
    }
  }
}

/**
 * Finds a matching Drive file for a character based on name, reading, aliases, or No.
 */
export function findMatchingDriveFile(
  nyan: NyanCharacter,
  files: DriveFileInfo[]
): DriveFileInfo | null {
  const normNyanName = normalizeNameForMatch(nyan.name);
  const normNyanReading = normalizeNameForMatch(nyan.reading || '');
  const nyanNoStr = String(nyan.no);

  // Split name parts if there are slashes or alternate names (e.g. "ほむらにゃん / ほむら")
  const nameParts = nyan.name
    .split(/[/／,、|]/)
    .map((p) => normalizeNameForMatch(p.trim()))
    .filter((p) => p.length > 0);

  // Check 1: Exact normalized name match
  for (const file of files) {
    const normFileName = normalizeNameForMatch(file.name);
    if (normFileName && (normFileName === normNyanName || nameParts.includes(normFileName))) {
      return file;
    }
  }

  // Check 2: Raw file name starts with or contains character name (e.g. "ほむらにゃん.png")
  for (const file of files) {
    const rawBaseName = file.name.replace(/\.[^/.]+$/, '').trim();
    if (rawBaseName === nyan.name || rawBaseName === nyan.reading) {
      return file;
    }
    for (const part of nameParts) {
      if (rawBaseName === part) {
        return file;
      }
    }
  }

  // Check 3: Reading match
  if (normNyanReading) {
    for (const file of files) {
      const normFileName = normalizeNameForMatch(file.name);
      if (normFileName && normFileName === normNyanReading) {
        return file;
      }
    }
  }

  // Check 4: No + Name match (e.g. "01_ほむらにゃん", "No.1 ほむらにゃん", "088_ほむらにゃん")
  for (const file of files) {
    const raw = file.name.toLowerCase();
    const noMatch = raw.match(/^(?:no\.?|#)?0*(\d+)[\s._\-ー]/i);
    if (noMatch && noMatch[1] === nyanNoStr) {
      return file;
    }
  }

  // Check 5: Partial containment
  if (normNyanName.length >= 3) {
    for (const file of files) {
      const normFileName = normalizeNameForMatch(file.name);
      if (normFileName.includes(normNyanName) || normNyanName.includes(normFileName)) {
        return file;
      }
    }
  }

  return null;
}

export interface DriveSyncResult {
  success: boolean;
  matchedCount: number;
  totalDriveFiles: number;
  updatedNyans: NyanCharacter[];
  kihonNyanImageUrl?: string;
  error?: string;
  details: {
    no: number;
    name: string;
    fileName: string;
    imageUrl: string;
    transparencyApplied: boolean;
  }[];
}

/**
 * Syncs character images from a Google Drive folder:
 * - Matches images by character name
 * - Preserves existing per-character transparency settings (or applies default)
 * - Automatically applies background transparency if configured
 */
export async function syncImagesFromGoogleDriveFolder(
  folderUrlOrId: string,
  characters: NyanCharacter[],
  defaultTransparencyOpts: NyanTransparencyOptions = {
    enableTransparency: true,
    tolerance: 30,
    trimPadding: true,
  }
): Promise<DriveSyncResult> {
  try {
    const files = await fetchGoogleDriveFolderFiles(folderUrlOrId);

    const updatedNyans: NyanCharacter[] = [];
    const details: DriveSyncResult['details'] = [];
    let matchedCount = 0;
    let kihonNyanImageUrl: string | undefined = undefined;

    // Check if there's a base nyan / kihon nyan image in the folder
    for (const file of files) {
      const norm = normalizeNameForMatch(file.name);
      if (norm === 'きほんのにゃんこ' || norm === 'きほん' || norm === 'basenyan' || norm === 'base') {
        kihonNyanImageUrl = file.url;
      }
    }

    for (const nyan of characters) {
      const matchedFile = findMatchingDriveFile(nyan, files);

      if (matchedFile) {
        const driveUrl = matchedFile.url;

        // Preserve existing transparency configuration if user already customized it
        const transOpts: NyanTransparencyOptions = nyan.transparency || {
          ...defaultTransparencyOpts,
        };

        let processedImageUrl = driveUrl;
        let transApplied = false;

        // If raw image URL or custom image is already the same, keep existing processed image to avoid re-processing
        if (nyan.rawImageUrl === driveUrl && nyan.customImageUrl) {
          processedImageUrl = nyan.customImageUrl;
        } else if (transOpts.enableTransparency) {
          // If transparency is enabled, attempt automatic background removal
          try {
            const opts: TransparencyOptions = {
              enableTransparency: true,
              tolerance: transOpts.tolerance,
              feather: 2,
              trimPadding: transOpts.trimPadding,
            };
            processedImageUrl = await compressAndResizeImage(driveUrl, 600, 600, 0.92, opts);
            transApplied = true;
          } catch (imgErr) {
            console.warn(`Could not apply transparency directly for ${nyan.name}, using raw drive URL:`, imgErr);
            processedImageUrl = driveUrl;
          }
        }

        const isNewlyChanged = nyan.rawImageUrl !== driveUrl || nyan.customImageUrl !== processedImageUrl;
        if (isNewlyChanged) {
          matchedCount++;
        }

        updatedNyans.push({
          ...nyan,
          rawImageUrl: driveUrl,
          customImageUrl: processedImageUrl,
          transparency: transOpts,
        });

        details.push({
          no: nyan.no,
          name: nyan.name,
          fileName: matchedFile.name,
          imageUrl: processedImageUrl,
          transparencyApplied: transApplied,
        });
      } else {
        // Keep existing nyan as-is
        updatedNyans.push(nyan);
      }
    }

    return {
      success: true,
      matchedCount,
      totalDriveFiles: files.length,
      updatedNyans,
      kihonNyanImageUrl,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      matchedCount: 0,
      totalDriveFiles: 0,
      updatedNyans: characters,
      error: err.message || 'Google Driveフォルダの画像同期に失敗しました',
      details: [],
    };
  }
}
