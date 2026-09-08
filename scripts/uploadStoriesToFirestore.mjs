import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, getDoc } from 'firebase/firestore';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));
const nyankoData = JSON.parse(readFileSync('./src/data/nyanko.json', 'utf-8'));

const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
});

const db = getFirestore(app, config.firestoreDatabaseId);

function cleanObject(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanObject);
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanObject(v);
      }
    }
    return res;
  }
  return obj;
}

async function uploadAll() {
  const entries = Object.values(nyankoData);
  console.log(`Starting upload of ${entries.length} nyanko stories to Firestore...`);

  const BATCH_SIZE = 50; // Upload in safe batches of 50 documents
  let uploadedCount = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, 'nyanko_stories', String(item.id));
      const payload = cleanObject({
        ...item,
        updatedAt: new Date().toISOString(),
      });
      batch.set(docRef, payload);
    }

    await batch.commit();
    uploadedCount += chunk.length;
    console.log(`Uploaded batch: ${uploadedCount} / ${entries.length} completed.`);
  }

  // Verify first and last
  const firstSnap = await getDoc(doc(db, 'nyanko_stories', '1'));
  const lastSnap = await getDoc(doc(db, 'nyanko_stories', '263'));
  console.log('Verification: doc(1) exists =', firstSnap.exists(), 'doc(263) exists =', lastSnap.exists());
  console.log('Sample doc(1) name:', firstSnap.data()?.name);
  console.log('Sample doc(263) name:', lastSnap.data()?.name);
  console.log('All stories successfully migrated to Firestore!');
  process.exit(0);
}

uploadAll().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
