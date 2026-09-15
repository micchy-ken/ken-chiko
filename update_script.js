const fs = require('fs');
let code = fs.readFileSync('src/services/userService.ts', 'utf8');

const target = `      const sanitizedList = Array.from(
        new Set([...DEFAULT_USER_IDS, ...parsed.filter((id) => Boolean(id) && !isSystemUserId(id) && !/^\\d+$/.test(String(id)))])
      );`;

const replacement = `      const sanitizedList = Array.from(
        new Set([...DEFAULT_USER_IDS, ...parsed.filter((id) => {
          if (!id || typeof id !== 'string') return false;
          if (isSystemUserId(id)) return false;
          if (/^\\d+$/.test(id)) return false;
          if (id.includes('[object')) return false;
          if (id.length > 50) return false;
          return true;
        })])
      ).slice(0, 30);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/services/userService.ts', code);
