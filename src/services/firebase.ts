/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, Firestore, setLogLevel } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, Auth } from 'firebase/auth';
import { UserProfile, TransactionRecord } from '../types';
import { TREASURY_WALLET } from './web3';
import appletConfig from '../../firebase-applet-config.json';

const activeApiKey = appletConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
const activeProjectId = appletConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "";

// Firebase is active and configured directly from the provisioned applet setup
export const isFirebaseConfigured = Boolean(
  activeApiKey &&
  activeProjectId &&
  activeApiKey.trim() !== '' &&
  !activeApiKey.includes("MockKey") &&
  activeApiKey !== "YOUR_FIREBASE_API_KEY"
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: activeApiKey,
      authDomain: appletConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${activeProjectId}.firebaseapp.com`,
      projectId: activeProjectId,
      storageBucket: appletConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${activeProjectId}.appspot.com`,
      messagingSenderId: appletConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: appletConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
    };

    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    setLogLevel('error');
    const databaseId = appletConfig?.firestoreDatabaseId;
    db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    auth = getAuth(app);
    console.log("🔥 Firebase Firestore connected successfully:", activeProjectId, databaseId || "default");
  } catch (e) {
    console.warn("Firebase initialization warning (using local persistence fallback):", e);
    db = null;
    auth = null;
  }
}

export { db, auth };

// LocalStorage fallback storage helper
export const STORAGE_KEY_PREFIX = "binance_harvest_user_";
export const TX_STORAGE_KEY = "binance_harvest_transactions_";

export async function getUserProfile(identifier: string): Promise<UserProfile> {
  const normalizedKey = identifier.toLowerCase();
  
  if (db) {
    try {
      const docRef = doc(db, "users", normalizedKey);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        return {
          ...data,
          loginStreak: data.loginStreak ?? 0,
          lastStreakClaimDate: data.lastStreakClaimDate ?? '',
          totalStreakPointsClaimed: data.totalStreakPointsClaimed ?? 0,
        };
      }
    } catch (e) {
      console.warn("Firestore fetch failed, falling back to localStorage:", e);
    }
  }

  // Fallback to localStorage
  const localData = localStorage.getItem(STORAGE_KEY_PREFIX + normalizedKey);
  if (localData) {
    const profile = JSON.parse(localData) as UserProfile;
    profile.treasuryWalletAddress = TREASURY_WALLET;
    profile.loginStreak = profile.loginStreak ?? 0;
    profile.lastStreakClaimDate = profile.lastStreakClaimDate ?? '';
    profile.totalStreakPointsClaimed = profile.totalStreakPointsClaimed ?? 0;
    return profile;
  }

  // Create default user profile starting afresh (0 points, tier 1)
  const defaultProfile: UserProfile = {
    email: identifier.includes('@') ? identifier : `miner_${normalizedKey.slice(0, 8)}@binanceharvest.io`,
    walletAddress: identifier.startsWith('0x') ? identifier : '',
    currentTier: 1,
    totalPoints: 0,
    miningBalanceBNB: 0,
    lastClaimDate: new Date().toISOString().split('T')[0],
    withdrawalStatus: 'NOT_STARTED',
    treasuryWalletAddress: TREASURY_WALLET,
    isVerified: false,
    loginStreak: 0,
    lastStreakClaimDate: '',
    totalStreakPointsClaimed: 0,
    createdAt: new Date().toISOString(),
  };

  await saveUserProfile(defaultProfile.email, defaultProfile);
  return defaultProfile;
}

export async function saveUserProfile(identifier: string, profile: UserProfile): Promise<void> {
  const normalizedKey = identifier.toLowerCase();
  
  localStorage.setItem(STORAGE_KEY_PREFIX + normalizedKey, JSON.stringify(profile));
  // also save by wallet if present
  if (profile.walletAddress) {
    localStorage.setItem(STORAGE_KEY_PREFIX + profile.walletAddress.toLowerCase(), JSON.stringify(profile));
  }

  if (db) {
    try {
      const docRef = doc(db, "users", normalizedKey);
      await setDoc(docRef, profile, { merge: true });
    } catch (e) {
      console.warn("Firestore save failed, saved locally:", e);
    }
  }
}

export async function updateUserProfileFields(identifier: string, fields: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await getUserProfile(identifier);
  const updated = { ...profile, ...fields };
  await saveUserProfile(identifier, updated);
  return updated;
}

// Transaction Records
export async function getTransactionHistory(identifier: string): Promise<TransactionRecord[]> {
  const normalizedKey = identifier.toLowerCase();
  
  if (db) {
    try {
      const q = query(collection(db, "transactions"), where("userEmail", "==", normalizedKey));
      const querySnapshot = await getDocs(q);
      const records: TransactionRecord[] = [];
      querySnapshot.forEach((docSnap) => {
        records.push(docSnap.data() as TransactionRecord);
      });
      if (records.length > 0) {
        return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch (e) {
      console.warn("Firestore transactions fetch failed, checking local:", e);
    }
  }

  const localTx = localStorage.getItem(TX_STORAGE_KEY + normalizedKey);
  if (localTx) {
    return JSON.parse(localTx);
  }

  return [];
}

export async function addTransactionRecord(identifier: string, record: Omit<TransactionRecord, 'id' | 'timestamp'>): Promise<TransactionRecord> {
  const normalizedKey = identifier.toLowerCase();
  const fullRecord: TransactionRecord = {
    ...record,
    id: 'tx_' + Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toISOString(),
  };

  if (db) {
    try {
      await addDoc(collection(db, "transactions"), {
        ...fullRecord,
        userEmail: normalizedKey,
      });
    } catch (e) {
      console.warn("Firestore transaction add failed:", e);
    }
  }

  const existing = await getTransactionHistory(normalizedKey);
  const updated = [fullRecord, ...existing];
  localStorage.setItem(TX_STORAGE_KEY + normalizedKey, JSON.stringify(updated));

  return fullRecord;
}

