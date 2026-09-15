import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkAll() {
  const snap = await getDocs(collection(db, 'kenchiko_world'));
  for (const d of snap.docs) {
    const data = d.data();
    const str = JSON.stringify(data);
    if (str.includes('126')) {
      console.log(`Doc [${d.id}] contains '126'`);
    }
  }
}

checkAll().then(() => process.exit(0));
