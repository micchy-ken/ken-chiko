import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkMaster() {
  const docIds = [
    'ken-chiko-global-master',
    'ken-chiko-global-state',
    'ken-chiko-master-characters',
    'ken-chiko-master-nyans',
    'ken-chiko-user-default'
  ];

  for (const id of docIds) {
    const snap = await getDoc(doc(db, 'kenchiko_world', id));
    if (!snap.exists()) {
      console.log(`Doc ${id}: NOT EXISTS`);
      continue;
    }
    const d = snap.data();
    console.log(`Doc ${id}: EXISTS, size:`, JSON.stringify(d).length);
    if (d.characters) {
      const disc = d.characters.filter(c => c.discovered);
      console.log(`  -> characters length: ${d.characters.length}, discovered in characters: ${disc.length}`);
    }
    if (d.nyans) {
      const disc = d.nyans.filter(c => c.discovered);
      console.log(`  -> nyans length: ${d.nyans.length}, discovered in nyans: ${disc.length}`);
    }
    if (d.nyanProgress) {
      console.log(`  -> nyanProgress keys: ${Object.keys(d.nyanProgress).length}`);
    }
  }
}

checkMaster().then(() => process.exit(0));
