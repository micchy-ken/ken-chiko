import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkCollections() {
  const collectionsToCheck = [
    'kenchiko_world',
    'users',
    'nyanko_stories',
    'nyanko_stories_unmapped',
    'stories',
    'game_saves',
    'backups'
  ];

  for (const name of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, name));
      console.log(`Collection [${name}]: ${snap.docs.length} documents`);
    } catch (e) {
      console.log(`Collection [${name}]: error or does not exist (${e.message})`);
    }
  }
}

checkCollections().then(() => process.exit(0));
