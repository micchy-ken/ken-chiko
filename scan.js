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
      if (content.includes('setDoc') || content.includes('batch.set') || content.includes('saveOnUserAction')) {
        console.log(`\n--- ${fullPath} ---`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('setDoc') || line.includes('batch.set') || line.includes('saveOnUserAction')) {
            console.log(`${i + 1}: ${line}`);
          }
        });
      }
    }
  }
}

scanDir('./src');
