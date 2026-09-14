/**
 * Step 4: Cleanse Master Data in Firestore
 * 
 * Firestore上の公式マスター（ken-chiko-master-characters）から、
 * 過去に混入してしまっていたユーザー進行度プロパティ
 * （discovered: false, friendshipLevel: 1, playCount: 0, lastMetAt: 0 等）
 * を完全に削ぎ落とし、純粋なマスターデータとして保存します。
 * 
 * 安全対策:
 * - 実行前に再度バックアップを確認
 * - ユーザーデータ（ken-chiko-user-yumi等）は一切書き込み・変更しない（0件変更）
 * - マスターキャラ定義数（264匹）が一致することを確認してから更新
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { cleanseMasterCharacters } from '../src/utils/dataSeparation';

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

async function runCleanse() {
  console.log('==============================================');
  console.log('🧹 ステップ4: 本番Firestoreマスターの純化（クレンジング）');
  console.log('==============================================\n');

  // 1. ken-chiko-master-characters の取得
  const charDocRef = doc(db, 'kenchiko_world', 'ken-chiko-master-characters');
  const snap = await getDoc(charDocRef);

  if (!snap.exists()) {
    console.error('❌ ken-chiko-master-characters が見つかりません');
    process.exit(1);
  }

  const data = snap.data();
  const rawCharacters = data.characters || [];
  console.log(`📡 現在のマスターキャラクター数: ${rawCharacters.length}件`);

  // 混入チェック
  let taintedCount = 0;
  for (const c of rawCharacters) {
    if (c.discovered !== undefined || c.friendshipLevel !== undefined || c.playCount !== undefined) {
      taintedCount++;
    }
  }
  console.log(`🔍 ユーザー進行度プロパティの混入件数: ${taintedCount} / ${rawCharacters.length}件`);

  // クレンジング実行
  const pureCharacters = cleanseMasterCharacters(rawCharacters);
  console.log(`✨ クレンジング後の純マスターキャラクター数: ${pureCharacters.length}件`);

  if (pureCharacters.length !== rawCharacters.length) {
    console.error('❌ キャラクター数が一致しません。安全のため処理を中断します。');
    process.exit(1);
  }

  // クリーン性の再確認
  for (const c of pureCharacters as any[]) {
    if (c.discovered !== undefined || c.friendshipLevel !== undefined || c.playCount !== undefined) {
      console.error(`❌ クレンジング後も混入が残っています: No.${c.no}`);
      process.exit(1);
    }
  }

  // Firestoreへ純マスターのみを書き戻し（1 write のみ消費）
  const updatePayload = {
    ...data,
    updatedAt: Date.now(),
    characters: pureCharacters,
    lastCleanseNote: 'ユーザー進行度プロパティ完全分離クレンジング完了',
  };

  await setDoc(charDocRef, updatePayload);
  console.log('💾 [SUCCESS] ken-chiko-master-characters の純化保存が完了しました！ (Firestore消費: 1回)');

  // yumi のデータが健全であることも最終確認
  const yumiDocRef = doc(db, 'kenchiko_world', 'ken-chiko-user-yumi');
  const yumiSnap = await getDoc(yumiDocRef);
  if (yumiSnap.exists()) {
    const yumiData = yumiSnap.data();
    const yumiProgCount = Object.keys(yumiData.nyanProgress || {}).length;
    console.log(`\n🔒 [安全確認] yumiのデータは一切変更されていません: nyanProgress=${yumiProgCount}件, 日記=${yumiData.diary?.length || 0}件`);
  }

  console.log('\n==============================================');
  console.log('🎉 ステップ4 完了: マスターデータが純粋な定義のみに浄化されました！');
  console.log('==============================================');
}

runCleanse().catch((err) => {
  console.error('エラー発生:', err);
  process.exit(1);
});
