import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId || undefined);

async function runBackup() {
  console.log(`[Backup] Connecting to Firestore database: ${config.firestoreDatabaseId || '(default)'}...`);
  const colRef = collection(db, 'kenchiko_world');
  const snap = await getDocs(colRef);

  console.log(`[Backup] Successfully retrieved ${snap.docs.length} documents from 'kenchiko_world'.`);

  const backupData: Record<string, any> = {};
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let yumiDoc: any = null;

  for (const docSnap of snap.docs) {
    const docId = docSnap.id;
    const data = docSnap.data();
    backupData[docId] = data;
    console.log(` - Saved document: ${docId} (Keys: ${Object.keys(data).length})`);

    if (docId === 'ken-chiko-user-yumi') {
      yumiDoc = data;
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `firestore_backup_${timestamp}.json`);
  const latestBackupPath = path.join(backupDir, 'firestore_backup_latest.json');

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  fs.writeFileSync(latestBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n[Backup SUCCESS] Full database backup written to:`);
  console.log(`  -> ${backupFilePath}`);
  console.log(`  -> ${latestBackupPath}`);

  if (yumiDoc) {
    const yumiBackupPath = path.join(backupDir, 'yumi_progress_latest.json');
    fs.writeFileSync(yumiBackupPath, JSON.stringify(yumiDoc, null, 2), 'utf-8');
    console.log(`\n[Backup SUCCESS] 'yumi' user dedicated backup saved to:`);
    console.log(`  -> ${yumiBackupPath}`);

    // Summary of yumi progress
    const nyanProgress = yumiDoc.nyanProgress || {};
    const nyanKeys = Object.keys(nyanProgress);
    const discoveredNyans = nyanKeys.filter((k) => nyanProgress[k]?.discovered);
    console.log(`\n--- YUMI PROGRESS SUMMARY ---`);
    console.log(`Total Nyan Progress Entries: ${nyanKeys.length}`);
    console.log(`Discovered Nyans: ${discoveredNyans.length}`);
    console.log(`Inventory Items: ${(yumiDoc.inventory || []).length}`);
    console.log(`Diary Entries: ${(yumiDoc.diary || []).length}`);
    console.log(`Points: ${yumiDoc.points ?? 'N/A'}`);
    console.log(`Last Saved: ${yumiDoc.lastSaved ? new Date(yumiDoc.lastSaved).toLocaleString('ja-JP') : 'N/A'}`);
    console.log(`Updated At: ${yumiDoc.updatedAt || 'N/A'}`);
    console.log(`------------------------------`);
  } else {
    console.warn(`[Backup WARNING] 'ken-chiko-user-yumi' was not found as a separate doc! Let's check other docs...`);
  }
}

runBackup()
  .then(() => {
    console.log('[Backup] Completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Backup ERROR] Failed to fetch backup:', err);
    process.exit(1);
  });
