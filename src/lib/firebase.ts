import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDsSeTXvM55cSHQJUodIfHJV3E22jm8JJM",
  authDomain: "gen-lang-client-0422198274.firebaseapp.com",
  projectId: "gen-lang-client-0422198274",
  storageBucket: "gen-lang-client-0422198274.firebasestorage.app",
  messagingSenderId: "591454321636",
  appId: "1:591454321636:web:557cbf6454c272c89ce5f1"
};

const firestoreDatabaseId = "ai-studio-158bacd9-9ee1-44e7-a28e-d420f30e2ea9";

console.log('Firebase Config used:', firebaseConfig);

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
