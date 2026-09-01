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

// Read configuration from environment variables (import.meta.env)
export function getEnvFirebaseConfig(): FirebaseCustomConfig {
  const env = (import.meta as any).env || {};
  const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    projectId: projectId,
    appId: env.VITE_FIREBASE_APP_ID || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ''),
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : ''),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    syncDocId: 'ken-chiko-global-state',
  };
}

const FIREBASE_CONFIG_STORAGE_KEY = 'kenchiko_firebase_config_v1';

export function loadSavedFirebaseConfig(): FirebaseCustomConfig {
  const envConfig = getEnvFirebaseConfig();
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return envConfig;
    const parsed = JSON.parse(raw);
    return {
      ...envConfig,
      ...parsed,
    };
  } catch {
    return envConfig;
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

export function initFirebase(config: FirebaseCustomConfig = loadSavedFirebaseConfig()): {
  success: boolean;
  error?: string;
} {
  try {
    const activeConfig = {
      ...loadSavedFirebaseConfig(),
      ...config,
    };

    if (!activeConfig.apiKey || !activeConfig.projectId) {
      return { success: false, error: '環境変数 (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID) または設定画面で設定してください' };
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

    const docId = config.syncDocId || 'ken-chiko-global-state';
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
