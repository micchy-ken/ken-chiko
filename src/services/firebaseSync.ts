import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
import { GameSaveData } from '../types';

export interface FirebaseCustomConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
  syncDocId?: string; // default: "ken-chiko-global-state"
}

// Provisioned Firebase configuration for this app
export const PROVISIONED_FIREBASE_CONFIG: FirebaseCustomConfig = {
  projectId: 'gen-lang-client-0027333270',
  appId: '1:589716285990:web:0b1c0cce13f5f0187154e7',
  apiKey: 'AIzaSyCDqLWbRYRSsrhzYKdUXvd5DQ6m360yKBk',
  authDomain: 'gen-lang-client-0027333270.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-fae23163-8cc8-4b97-bd81-37d5070e358a',
  storageBucket: 'gen-lang-client-0027333270.firebasestorage.app',
  messagingSenderId: '589716285990',
  syncDocId: 'ken-chiko-global-state',
};

const FIREBASE_CONFIG_STORAGE_KEY = 'kenchiko_firebase_config_v1';

export function loadSavedFirebaseConfig(): FirebaseCustomConfig {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return PROVISIONED_FIREBASE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...PROVISIONED_FIREBASE_CONFIG,
      ...parsed,
    };
  } catch {
    return PROVISIONED_FIREBASE_CONFIG;
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

export function initFirebase(config: FirebaseCustomConfig = PROVISIONED_FIREBASE_CONFIG): {
  success: boolean;
  error?: string;
} {
  try {
    const activeConfig = {
      ...PROVISIONED_FIREBASE_CONFIG,
      ...config,
    };

    if (!activeConfig.apiKey || !activeConfig.projectId) {
      return { success: false, error: 'API KeyとProject IDを入力してください' };
    }

    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
    } else {
      firebaseApp = initializeApp({
        apiKey: activeConfig.apiKey,
        authDomain: activeConfig.authDomain || `${activeConfig.projectId}.firebaseapp.com`,
        projectId: activeConfig.projectId,
        storageBucket: activeConfig.storageBucket,
        messagingSenderId: activeConfig.messagingSenderId,
        appId: activeConfig.appId,
      });
    }

    // Connect to database (with custom databaseId if defined)
    if (activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)') {
      try {
        firestoreDb = getFirestore(firebaseApp, activeConfig.firestoreDatabaseId);
      } catch {
        firestoreDb = getFirestore(firebaseApp);
      }
    } else {
      firestoreDb = getFirestore(firebaseApp);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Firebase init error', err);
    return { success: false, error: err.message || 'Firebase初期化に失敗しました' };
  }
}

export async function syncSaveDataToFirebase(
  data: GameSaveData,
  config: FirebaseCustomConfig = loadSavedFirebaseConfig()
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!firestoreDb) {
      const initRes = initFirebase(config);
      if (!initRes.success) return initRes;
    }
    if (!firestoreDb) return { success: false, error: 'Firestore is not initialized' };

    const docId = config.syncDocId || PROVISIONED_FIREBASE_CONFIG.syncDocId || 'ken-chiko-global-state';
    const docRef = doc(firestoreDb, 'kenchiko_world', docId);

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
  config: FirebaseCustomConfig = loadSavedFirebaseConfig(),
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

  const docId = config.syncDocId || PROVISIONED_FIREBASE_CONFIG.syncDocId || 'ken-chiko-global-state';
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
