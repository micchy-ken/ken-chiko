import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function listAll() {
  const colRef = collection(db, 'kenchiko_world');
  const snap = await getDocs(colRef);
  console.log('Total documents in kenchiko_world:', snap.docs.length);
  for (const d of snap.docs) {
    const data = d.data();
    let info = '';
    if (data.nyanProgress) {
      const disc = Object.keys(data.nyanProgress).filter(k => data.nyanProgress[k].discovered).length;
      info += ` nyanProgress:${Object.keys(data.nyanProgress).length} (disc:${disc})`;
    }
    if (data.characters) {
      const disc = data.characters.filter(c => c.discovered).length;
      info += ` characters:${data.characters.length} (disc:${disc})`;
    }
    console.log(`- ${d.id}: size=${JSON.stringify(data).length}${info}`);
  }
}

listAll().then(() => process.exit(0));
