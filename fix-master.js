import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  const docRef = doc(db, 'kenchiko_world', 'ken-chiko-master-characters');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.characters) {
      const fixed = data.characters.map(c => ({
        ...c,
        discovered: c.no <= 8 ? true : false,
        discoveryDate: null,
        lastMetAt: null,
        playCount: 0,
        friendshipLevel: 1
      }));
      await setDoc(docRef, { characters: fixed }, { merge: true });
      console.log('Fixed master data!');
    }
  } else {
    console.log('Doc not found');
  }
}
fix().catch(console.error).then(() => process.exit(0));
