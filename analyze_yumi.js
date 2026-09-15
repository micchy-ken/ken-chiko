import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function analyze() {
  const userSnap = await getDoc(doc(db, 'kenchiko_world', 'ken-chiko-user-yumi'));
  const masterSnap = await getDoc(doc(db, 'kenchiko_world', 'ken-chiko-master-characters'));
  const d = userSnap.data();
  const m = masterSnap.data();
  const mMap = new Map(m.characters.map(c => [c.no, c.name]));
  const prog = d.nyanProgress || {};
  
  const played = [];
  const notPlayed = [];
  for (const [k, v] of Object.entries(prog)) {
    const no = Number(k);
    const item = { no, name: mMap.get(no) || "不明", ...v };
    if ((v.playCount || 0) > 0) {
      played.push(item);
    } else {
      notPlayed.push(item);
    }
  }
  console.log(`=== 実際に遊んだ猫 (playCount > 0): ${played.length}匹 ===`);
  played.forEach(c => console.log(`No.${c.no} ${c.name} (遊んだ回数: ${c.playCount}, 発見日: ${c.discoveryDate})`));
  
  console.log(`\n=== 遊んでいない猫 (playCount == 0): ${notPlayed.length}匹 ===`);
  notPlayed.forEach(c => console.log(`No.${c.no} ${c.name} (遊んだ回数: ${c.playCount}, 発見日: ${c.discoveryDate})`));

  console.log('\n=== ガラポンや日記での言及 ===');
  console.log('ガラポン新猫当選履歴:');
  (d.rewards?.history || []).filter(h => h.type === 'new_nyan').forEach(h => {
    console.log(`- ${h.prizeTitle} (${new Date(h.timestamp).toLocaleString()})`);
  });
  console.log('絵日記に登場した猫 (ユニーク):');
  const diaryNyans = new Set((d.diary || []).map(entry => entry.nyanName).filter(Boolean));
  console.log(Array.from(diaryNyans).join(', '));
}

analyze().then(() => process.exit(0));
