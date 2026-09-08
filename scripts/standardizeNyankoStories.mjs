import { readFileSync, writeFileSync } from 'fs';

const filePath = './src/data/nyanko.json';
const rawData = readFileSync(filePath, 'utf8');
const nyankoMap = JSON.parse(rawData);

const entries = Object.values(nyankoMap);
console.log(`Loaded ${entries.length} nyanko entries.`);

// 1. Remove redundant '---' separators before headers
let cleanedDashesCount = 0;
for (const entry of entries) {
  for (const day of entry.week_info?.days || []) {
    for (const msg of day.messages || []) {
      const original = msg.body;
      const cleaned = original.replace(/\s*---\s*(?=(?:#+[^\n]*\r?\n\s*)*##)/g, '\n\n').trimEnd();
      if (original !== cleaned) {
        cleanedDashesCount++;
        msg.body = cleaned;
      }
    }
  }
}
console.log(`Cleaned '---' separators from ${cleanedDashesCount} messages.`);

// 2. Sort entries chronologically to determine the weekly sequence
entries.sort((a, b) => {
  const sa = a.week_info?.week_start || a.debut_date || '';
  const sb = b.week_info?.week_start || b.debut_date || '';
  if (sa !== sb) return sa.localeCompare(sb);
  return a.id - b.id;
});

// Group by week_info.week_start
const weeks = [];
let curWeek = null;
for (const e of entries) {
  const wStart = e.week_info?.week_start;
  const wEnd = e.week_info?.week_end;
  const wTitle = e.week_info?.week_title;
  if (!curWeek || curWeek.start !== wStart) {
    curWeek = { start: wStart, end: wEnd, title: wTitle, entries: [] };
    weeks.push(curWeek);
  }
  curWeek.entries.push(e);
}
console.log(`Total unique weeks in timeline: ${weeks.length}`);

// 3. Append missing weekly headers
let addedHeadersCount = 0;
for (let i = 0; i < weeks.length; i++) {
  const currentWeek = weeks[i];
  const nextWeek = weeks[i + 1];

  for (const entry of currentWeek.entries) {
    const hasHeader = JSON.stringify(entry).includes('## ');
    if (!hasHeader) {
      if (!nextWeek) {
        console.warn(`Warning: No next week for entry ID ${entry.id} (${entry.name})`);
        continue;
      }

      const days = entry.week_info?.days || [];
      if (days.length === 0) {
        console.error(`Error: No days for entry ID ${entry.id} (${entry.name})`);
        continue;
      }

      const lastDay = days[days.length - 1];
      const msgs = lastDay.messages || [];
      if (msgs.length === 0) {
        console.error(`Error: No messages on last day for entry ID ${entry.id} (${entry.name})`);
        continue;
      }

      const lastMsg = msgs[msgs.length - 1];
      const headerToAppend = `\n\n## ${nextWeek.title}`;
      lastMsg.body = lastMsg.body.trimEnd() + headerToAppend;
      addedHeadersCount++;
      console.log(`Added header to ID ${entry.id} (${entry.name}): -> ## ${nextWeek.title}`);
    }
  }
}
console.log(`Successfully added weekly headers to ${addedHeadersCount} entries.`);

// 4. Save back to nyanko.json
writeFileSync(filePath, JSON.stringify(nyankoMap, null, 2) + '\n', 'utf8');
console.log(`Saved updated nyanko.json successfully.`);
