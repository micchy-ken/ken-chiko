import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
import { GameSaveData } from '../types';

export interface FirebaseCustomConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  syncDocId?: string; // default: "ken-chiko-global-state"
}

const FIREBASE_CONFIG_STORAGE_KEY = 'kenchiko_firebase_config_v1';

export function loadSavedFirebaseConfig(): FirebaseCustomConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config: FirebaseCustomConfig): void {
  try {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save Firebase config', err);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let unsubscribeSnapshot: Unsubscribe | null = null;

export function initFirebase(config: FirebaseCustomConfig): { success: boolean; error?: string } {
  try {
    if (!config.apiKey || !config.projectId) {
      return { success: false, error: 'API KeyとProject IDを入力してください' };
    }

    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
    } else {
      firebaseApp = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    }

    firestoreDb = getFirestore(firebaseApp);
    return { success: true };
  } catch (err: any) {
    console.error('Firebase init error', err);
    return { success: false, error: err.message || 'Firebase初期化に失敗しました' };
  }
}

export async function syncSaveDataToFirebase(
  data: GameSaveData,
  config: FirebaseCustomConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) return initRes;
    }
    if (!firestoreDb) return { success: false, error: 'Firestore is not initialized' };

    const docId = config.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);

    // Save state (clean characters if needed or save full snapshot)
    await setDoc(docRef, {
      ...data,
      lastSaved: Date.now(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error syncing to Firestore', err);
    return { success: false, error: err.message || 'Firestore書き込みに失敗しました' };
  }
}

export function subscribeToFirebaseState(
  config: FirebaseCustomConfig,
  onRemoteUpdate: (data: GameSaveData) => void,
  onError?: (err: Error) => void
): () => void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (!firestoreDb) {
    const initRes = initFirebase(config);
    if (!initRes.success) {
      if (onError) onError(new Error(initRes.error));
      return () => {};
    }
  }

  if (!firestoreDb) return () => {};

  const docId = config.syncDocId || 'ken-chiko-global-state';
  const docRef = doc(firestoreDb, 'kenchiko_world', docId);

  unsubscribeSnapshot = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data() as GameSaveData;
        if (remoteData && remoteData.kenchiko) {
          onRemoteUpdate(remoteData);
        }
      }
    },
    (err) => {
      console.error('Firebase snapshot error', err);
      if (onError) onError(err);
    }
  );

  return () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}
