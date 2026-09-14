const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('useEffect')) {
        const lines = content.split('\n');
        let inEffect = false;
        lines.forEach((line, i) => {
          if (line.includes('useEffect(')) inEffect = true;
          if (inEffect && line.includes('}')) {
             // not perfect but gives a hint
          }
          if (inEffect && (line.includes('saveGlobal') || line.includes('setDoc') || line.includes('batch.') || line.includes('saveOnUserAction') || line.includes('onUpdateSaveData'))) {
            console.log(`[${path.basename(fullPath)}:${i+1}] ${line.trim()}`);
          }
        });
      }
    }
  }
}

scanDir('./src');
