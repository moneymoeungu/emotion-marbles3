import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA4opik6DQL2faYbWqf-k_1kNI71wQlX1U",
  authDomain: "emotion-marbles.firebaseapp.com",
  projectId: "emotion-marbles",
  storageBucket: "emotion-marbles.firebasestorage.app",
  messagingSenderId: "57446309564",
  appId: "1:57446309564:web:0e5dfbdd85a88a6c0e3ab9",
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
