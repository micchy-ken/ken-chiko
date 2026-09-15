import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  projectId: "gen-lang-client-0027333270",
  appId: "1:589716285990:web:0b1c0cce13f5f0187154e7",
  apiKey: "AIzaSyCDqLWbRYRSsrhzYKdUXvd5DQ6m360yKBk",
  authDomain: "gen-lang-client-0027333270.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-fae23163-8cc8-4b97-bd81-37d5070e358a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-fae23163-8cc8-4b97-bd81-37d5070e358a");

async function run() {
  console.log("Fetching documents...");
  const colRef = collection(db, "kenchiko_world");
  const snapshot = await getDocs(colRef);
  const data = {};
  snapshot.forEach(doc => {
    console.log("Found doc:", doc.id);
    data[doc.id] = doc.data();
  });
  
  fs.writeFileSync("yumi_backup.json", JSON.stringify(data, null, 2));
  console.log("Backup saved to yumi_backup.json");
  process.exit(0);
}
run().catch(console.error);
