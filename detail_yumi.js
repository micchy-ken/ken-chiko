import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function detailYumi() {
  const snap = await getDoc(doc(db, 'kenchiko_world', 'ken-chiko-user-yumi'));
  const d = snap.data();
  console.log('User yumi:');
  console.log('lastSaved:', new Date(d.lastSaved).toLocaleString());
  console.log('updatedAt:', d.updatedAt);
  const prog = d.nyanProgress || {};
  console.log('All nyanProgress entries:');
  for (const [k, v] of Object.entries(prog)) {
    console.log(`- No.${k}: discovered=${v.discovered}, playCount=${v.playCount || 0}, friendship=${v.friendshipLevel || 1}, date=${v.discoveryDate || 'none'}`);
  }
}

detailYumi().then(() => process.exit(0));
