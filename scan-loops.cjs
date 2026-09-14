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
      if (content.includes('setDoc') || content.includes('batch.') || content.includes('executeFirestoreWrite') || content.includes('saveGlobal')) {
        const lines = content.split('\n');
        let inLoop = false;
        let loopLevel = 0;
        lines.forEach((line, i) => {
          if (line.match(/for\s*\(|forEach|while\s*\(/)) {
            inLoop = true;
          }
          if (line.includes('setDoc') || line.includes('batch.') || line.includes('executeFirestoreWrite') || line.includes('saveGlobal')) {
            console.log(`[${path.basename(fullPath)}:${i+1}] ${line.trim()}`);
          }
        });
      }
    }
  }
}

scanDir('./src');
