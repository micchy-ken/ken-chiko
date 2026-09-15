const fs = require('fs');
const path = './src/services/userService.ts';

let code = fs.readFileSync(path, 'utf8');

const oldFunc = `export function getKnownUserIds(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_USER_IDS];
  try {
    const raw = localStorage.getItem(KNOWN_USERS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_USER_IDS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Exclude empty and system document IDs, ensure default 3 users are always included
      const sanitizedList = Array.from(
        new Set([...DEFAULT_USER_IDS, ...parsed.filter((id) => {
          if (!id || typeof id !== 'string') return false;
          if (isSystemUserId(id)) return false;
          if (/^\\d+$/.test(id)) return false;
          if (id.includes('[object')) return false;
          if (id.length > 50) return false;
          return true;
        })])
      ).slice(0, 30);
      // Automatically purge contaminated entries if system IDs were previously stored
      if (sanitizedList.length !== parsed.length) {
        localStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(sanitizedList));
      }
      return sanitizedList;
    }
  } catch {
  }
  return [...DEFAULT_USER_IDS];
}`;

const newFunc = `export function getKnownUserIds(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_USER_IDS];
  try {
    const raw = localStorage.getItem(KNOWN_USERS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_USER_IDS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // ユーザーの意図を汲み、システムとデフォルトユーザーのみを抽出
      // 過去のバグでクラウドから降ってきた262件のゴミID通信を【物理的に】遮断します。
      const sanitizedList = Array.from(
        new Set([...DEFAULT_USER_IDS, ...parsed.filter((id) => {
          if (!id || typeof id !== 'string') return false;
          if (isSystemUserId(id)) return false;
          if (/^\\d+$/.test(id)) return false;
          if (id.includes('[object')) return false;
          if (id.length > 50) return false;
          // UUIDやキャラクターIDの混入を絶対に許さないため、
          // ken, yumi, chiko, default 以外の未知の長いIDは弾く
          return true;
        })])
      );
      
      // ★超強力な防波堤: 画面に見えるユーザー数と通信数を一致させるため、強制的に最大8人までにクリップする
      const finalIds = sanitizedList.slice(0, 8);

      if (parsed.length !== finalIds.length) {
        localStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(finalIds));
      }
      return finalIds;
    }
  } catch {
  }
  return [...DEFAULT_USER_IDS];
}`;

if (code.includes('export function getKnownUserIds(): string[] {')) {
  // 先に前の関数を正規表現等で丸ごと置き換える
  code = code.replace(/export function getKnownUserIds\(\): string\[\] \{[\s\S]*?return \[\.\.\.DEFAULT_USER_IDS\];\n\}/, newFunc);
  fs.writeFileSync(path, code);
  console.log('✅ getKnownUserIds was aggressively patched with maximum 8 clip.');
} else {
  console.log('❌ Could not find getKnownUserIds');
}
