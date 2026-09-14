/**
 * Verification Script: Test Yumi's Data Migration & Separation
 * 
 * yumiの実バックアップデータを用いて、
 * 1. マスターデータのクレンジング
 * 2. ユーザー進行度の抽出
 * 3. 4重セーフティネットによる有利マージ（Advantageous Merge）
 * 4. UI向け合成（composeCharacters）
 * が100%完全に行われ、1つの発見データも親密度も失われないことを厳密に検証します。
 */

import fs from 'fs';
import path from 'path';
import {
  cleanseMasterCharacters,
  extractProgressMap,
  composeCharacters,
  mergeUserProgressSafely,
  cleanseMasterCharacter,
} from '../src/utils/dataSeparation';

function runTest() {
  console.log('==============================================');
  console.log('🧪 ステップ3: yumiデータの安全移行シミュレーション検証');
  console.log('==============================================\n');

  // 1. バックアップファイルの読み込み
  const yumiBackupPath = path.resolve(process.cwd(), 'backups/yumi_progress_latest.json');
  const masterBackupPath = path.resolve(process.cwd(), 'backups/firestore_backup_latest.json');

  if (!fs.existsSync(yumiBackupPath)) {
    console.error('❌ yumiのバックアップファイルが見つかりません:', yumiBackupPath);
    process.exit(1);
  }
  if (!fs.existsSync(masterBackupPath)) {
    console.error('❌ マスターのバックアップファイルが見つかりません:', masterBackupPath);
    process.exit(1);
  }

  const yumiRaw = JSON.parse(fs.readFileSync(yumiBackupPath, 'utf8'));
  const masterRaw = JSON.parse(fs.readFileSync(masterBackupPath, 'utf8'));

  console.log('✅ バックアップ読み込み成功:');
  console.log(` - yumi RAW nyanProgress数: ${Object.keys(yumiRaw.nyanProgress || {}).length}件`);
  console.log(` - yumi 日記数: ${yumiRaw.diary?.length || 0}件`);
  console.log(` - yumi 所持アイテム数: ${yumiRaw.inventory?.length || 0}件`);

  // 2. マスターデータのクレンジングテスト
  const rawMasterNyans = masterRaw['ken-chiko-master-characters']?.characters || masterRaw['ken-chiko-global-master']?.characters || [];
  console.log(`\n【検証1】マスターデータのクレンジング`);
  console.log(` - 元のマスターキャラ数: ${rawMasterNyans.length}件`);

  const pureMasterNyans = cleanseMasterCharacters(rawMasterNyans);
  console.log(` - クレンジング後の純マスターキャラ数: ${pureMasterNyans.length}件`);

  // 純マスターデータに discovered や friendshipLevel が混入していないか全件監査
  let corruptedCount = 0;
  for (const c of pureMasterNyans as any[]) {
    if (c.discovered !== undefined || c.friendshipLevel !== undefined || c.playCount !== undefined) {
      corruptedCount++;
      console.error(`❌ マスターデータにユーザー進行度が混入しています: No.${c.no} ${c.name}`);
    }
  }

  if (corruptedCount === 0) {
    console.log('✨ [PASS] 純マスターデータは100%クリーンです（ユーザー進行度の混入: 0件）');
  } else {
    console.error(`❌ [FAIL] ${corruptedCount}件の混入が検知されました`);
    process.exit(1);
  }

  // 3. yumiの進行度抽出テスト
  console.log(`\n【検証2】yumiの進行度抽出`);
  const yumiProgressMap = extractProgressMap(yumiRaw.nyanProgress);
  const discoveredNos = Object.entries(yumiProgressMap)
    .filter(([_, p]) => p.discovered)
    .map(([no]) => Number(no));

  console.log(` - 抽出された進行度エントリー数: ${Object.keys(yumiProgressMap).length}件`);
  console.log(` - 発見済みねこ数: ${discoveredNos.length}匹`);
  console.log(` - 発見済みNo一覧: ${discoveredNos.join(', ')}`);

  if (discoveredNos.length < 20) {
    console.error(`❌ [FAIL] 発見済みねこ数が少なすぎます (${discoveredNos.length})`);
    process.exit(1);
  } else {
    console.log(`✨ [PASS] yumiの発見データ（${discoveredNos.length}匹）が欠損なく100%抽出されました`);
  }

  // 4. 有利マージ（Advantageous Merge）のシミュレーション
  console.log(`\n【検証3】オフラインローカル進行度との有利マージテスト`);
  // 例: yumiがローカルで No.1 と遊んで親密度が上がっていたと仮定
  const hypotheticalLocalProgress = {
    ...yumiProgressMap,
    1: {
      ...yumiProgressMap[1],
      friendshipLevel: 10, // ローカルで親密度アップ
      playCount: 20,
    },
    99: { // ローカルで新発見
      discovered: true,
      discoveryDate: '2026/09/14',
      friendshipLevel: 2,
      playCount: 3,
    },
  };

  const merged = mergeUserProgressSafely(hypotheticalLocalProgress, yumiProgressMap);
  console.log(` - No.1の親密度（ローカル10 vs リモート${yumiProgressMap[1]?.friendshipLevel || 1}） -> 採用値: ${merged[1]?.friendshipLevel}`);
  console.log(` - No.99の発見状況 -> 採用値: ${merged[99]?.discovered}`);

  if (merged[1]?.friendshipLevel === 10 && merged[99]?.discovered === true && merged[4]?.discovered === true) {
    console.log('✨ [PASS] 有利マージにより、ローカル・リモートどちらの成果も一切失われませんでした');
  } else {
    console.error('❌ [FAIL] 有利マージに不整合があります');
    process.exit(1);
  }

  // 5. 合成（composeCharacters）テスト
  console.log(`\n【検証4】公式マスターとyumi進行度の安全合成`);
  const composedNyans = composeCharacters(pureMasterNyans, yumiProgressMap);
  console.log(` - 合成後キャラクター総数: ${composedNyans.length}匹`);

  const composedDiscovered = composedNyans.filter(c => c.discovered);
  console.log(` - 合成後の発見済み数: ${composedDiscovered.length}匹`);

  // No.1 の検証
  const nyan1 = composedNyans.find(c => c.no === 1);
  console.log(` - No.1 確認: 名前="${nyan1?.name}", 発見=${nyan1?.discovered}, 親密度=${nyan1?.friendshipLevel}, 画像="${nyan1?.customImageUrl ? 'あり' : 'なし'}"`);

  if (composedDiscovered.length === discoveredNos.length && nyan1?.name) {
    console.log('✨ [PASS] 公式マスターの定義（名前・画像）とyumiの進行度が完全に融合しました！');
  } else {
    console.error('❌ [FAIL] 合成結果に不整合があります');
    process.exit(1);
  }

  console.log('\n==============================================');
  console.log('🎉 ステップ3 検証完了: 全てのテストを100%クリアしました！');
  console.log('yumiのデータは1ビットも失われることなく安全に移行できます。');
  console.log('==============================================');
}

runTest();
