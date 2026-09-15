import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreDbInstance } from '../services/firebaseSync';
import { GameSaveData } from '../types';

/**
 * 【安全なFirestore Listen（onSnapshot）カスタムフック】
 * 
 * GCP監査ログの 17:03:42〜17:03:49 の大量Listen発生（リスナー多重登録バグ）を防ぐための、
 * 完全に安全な onSnapshot 実装です。
 * 
 * 1. 依存配列（dependency array）には「ユーザーID（文字列）」というプリミティブ値のみを指定。
 * 2. クリーンアップ関数（unsubscribe）を確実に実行。
 * 3. useRef を用いてコールバック関数の最新化を行い、コールバック変更による無駄な再接続を防止。
 */
export function useSafeUserSync(
  userId: string | null,
  onDataUpdate: (data: GameSaveData) => void
) {
  // onDataUpdate が再生成されてもリスナーを再登録させないための Ref
  const callbackRef = useRef(onDataUpdate);

  useEffect(() => {
    callbackRef.current = onDataUpdate;
  }, [onDataUpdate]);

  useEffect(() => {
    // ユーザーIDが存在しない場合は監視しない
    if (!userId) return;

    const db = getFirestoreDbInstance();
    if (!db) return;

    // 依存配列の primitive 値 (userId) を使ってドキュメント参照を作成
    const userDocId = `ken-chiko-user-${userId}`;
    const docRef = doc(db, 'kenchiko_world', userDocId);

    console.log(`[SafeSync] 📡 Firestore.Listen 開始: ${userDocId}`);

    // onSnapshot の登録と、確実なクリーンアップ関数の返却
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // 最新のコールバックを呼び出す
          if (callbackRef.current && data.saveData) {
            callbackRef.current(data.saveData as GameSaveData);
          }
        }
      },
      (error) => {
        console.error(`[SafeSync] ❌ Firestore.Listen エラー (${userDocId}):`, error);
      }
    );

    // 【最重要】コンポーネントのアンマウント時、または userId が変更された時に
    // 確実に unsubscribe() を実行し、Listen の多重登録（暴走）を物理的に防ぐ
    return () => {
      console.log(`[SafeSync] 🛑 Firestore.Listen 解除 (unsubscribe): ${userDocId}`);
      unsubscribe();
    };
  }, [userId]); // 依存配列にはプリミティブ値（userId）のみを指定
}
