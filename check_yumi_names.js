import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkNames() {
  const userSnap = await getDoc(doc(db, 'kenchiko_world', 'ken-chiko-user-yumi'));
  const masterSnap = await getDoc(doc(db, 'kenchiko_world', 'ken-chiko-master-characters'));
  
  const userData = userSnap.data();
  const masterData = masterSnap.data();
  
  const masterMap = new Map();
  if (masterData && masterData.characters) {
    for (const c of masterData.characters) {
      masterMap.set(c.no, c.name);
    }
  }
  
  console.log('--- YUMI PROGRESS (Firestore ken-chiko-user-yumi) ---');
  console.log('Total nyanProgress keys:', Object.keys(userData.nyanProgress || {}).length);
  
  const list = [];
  for (const [noStr, p] of Object.entries(userData.nyanProgress || {})) {
    const no = parseInt(noStr, 10);
    const name = masterMap.get(no) || '不明';
    list.push({ no, name, ...p });
  }
  
  list.sort((a, b) => a.no - b.no);
  for (const item of list) {
    console.log(`No.${item.no} ${item.name}: 発見日=${item.discoveryDate || 'なし'}, 遊び回数=${item.playCount || 0}, 親密度=${item.friendshipLevel || 1}`);
  }
}

checkNames().then(() => process.exit(0));
