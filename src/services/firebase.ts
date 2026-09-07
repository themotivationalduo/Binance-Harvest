/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, where, orderBy, Firestore, setLogLevel } from 'firebase/firestore';
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
export const STORAGE_KEY_PREFIX = "binance_harvest_wallet_";
export const TX_STORAGE_KEY = "binance_harvest_txs_";

export async function getUserProfile(walletAddress: string): Promise<UserProfile> {
  if (!walletAddress) {
    return {
      walletAddress: '',
      currentTier: 1,
      miningBalance: 0,
      totalPoints: 0,
      miningBalanceBNB: 0,
      lastClaimDate: new Date().toISOString().split('T')[0],
      minerStartTimestamp: new Date().toISOString(),
      withdrawalStatus: 'NOT_STARTED',
      treasuryWalletAddress: TREASURY_WALLET,
      isVerified: false,
      loginStreak: 0,
      lastStreakClaimDate: '',
      totalStreakPointsClaimed: 0,
      createdAt: new Date().toISOString(),
    };
  }

  const normalizedAddress = walletAddress.toLowerCase();
  
  if (db) {
    try {
      const docRef = doc(db, "users", normalizedAddress);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        const miningBalance = data.miningBalance !== undefined ? Number(data.miningBalance) : ((data.totalPoints || 0) / 1000);
        return {
          ...data,
          walletAddress: normalizedAddress,
          treasuryWalletAddress: TREASURY_WALLET,
          miningBalance,
          loginStreak: data.loginStreak ?? 0,
          lastStreakClaimDate: data.lastStreakClaimDate ?? '',
          totalStreakPointsClaimed: data.totalStreakPointsClaimed ?? 0,
          minerStartTimestamp: data.minerStartTimestamp ?? new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn("Firestore fetch failed, falling back to localStorage:", e);
    }
  }

  // Fallback to localStorage
  const localData = localStorage.getItem(STORAGE_KEY_PREFIX + normalizedAddress);
  if (localData) {
    const profile = JSON.parse(localData) as UserProfile;
    profile.walletAddress = normalizedAddress;
    profile.treasuryWalletAddress = TREASURY_WALLET;
    profile.miningBalance = profile.miningBalance !== undefined ? Number(profile.miningBalance) : ((profile.totalPoints || 0) / 1000);
    profile.loginStreak = profile.loginStreak ?? 0;
    profile.lastStreakClaimDate = profile.lastStreakClaimDate ?? '';
    profile.totalStreakPointsClaimed = profile.totalStreakPointsClaimed ?? 0;
    profile.minerStartTimestamp = profile.minerStartTimestamp ?? new Date().toISOString();
    return profile;
  }

  // Create default on-chain user profile starting afresh (0 tokens, tier 1)
  const defaultProfile: UserProfile = {
    walletAddress: normalizedAddress,
    currentTier: 1,
    miningBalance: 0,
    totalPoints: 0,
    miningBalanceBNB: 0,
    lastClaimDate: new Date().toISOString().split('T')[0],
    minerStartTimestamp: new Date().toISOString(),
    withdrawalStatus: 'NOT_STARTED',
    treasuryWalletAddress: TREASURY_WALLET,
    isVerified: false,
    loginStreak: 0,
    lastStreakClaimDate: '',
    totalStreakPointsClaimed: 0,
    createdAt: new Date().toISOString(),
    lastActiveTimestamp: new Date().toISOString(),
  };

  await saveUserProfile(normalizedAddress, defaultProfile);
  return defaultProfile;
}

export async function saveUserProfile(walletAddress: string, profile: UserProfile): Promise<void> {
  if (!walletAddress) return;
  const normalizedAddress = walletAddress.toLowerCase();
  const dataToSave = {
    ...profile,
    walletAddress: normalizedAddress,
    treasuryWalletAddress: TREASURY_WALLET,
    lastActiveTimestamp: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEY_PREFIX + normalizedAddress, JSON.stringify(dataToSave));

  if (db) {
    try {
      const docRef = doc(db, "users", normalizedAddress);
      await setDoc(docRef, dataToSave, { merge: true });
    } catch (e) {
      console.warn("Firestore save failed, saved locally:", e);
    }
  }
}

export async function updateUserProfileFields(walletAddress: string, fields: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await getUserProfile(walletAddress);
  const updated = { ...profile, ...fields };
  await saveUserProfile(walletAddress, updated);
  return updated;
}

// Transaction Records
export async function getTransactionHistory(walletAddress: string): Promise<TransactionRecord[]> {
  if (!walletAddress) return [];
  const normalizedAddress = walletAddress.toLowerCase();
  
  if (db) {
    try {
      const q = query(collection(db, "transactions"), where("userAddress", "==", normalizedAddress));
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

  const localTx = localStorage.getItem(TX_STORAGE_KEY + normalizedAddress);
  if (localTx) {
    return JSON.parse(localTx);
  }

  return [];
}

export async function addTransactionRecord(walletAddress: string, record: Omit<TransactionRecord, 'id' | 'timestamp' | 'userAddress'>): Promise<TransactionRecord> {
  const normalizedAddress = (walletAddress || '').toLowerCase();
  const fullRecord: TransactionRecord = {
    ...record,
    id: 'tx_' + Math.random().toString(36).substring(2, 11),
    userAddress: normalizedAddress,
    timestamp: new Date().toISOString(),
  };

  if (db) {
    try {
      await addDoc(collection(db, "transactions"), fullRecord);
    } catch (e) {
      console.warn("Firestore transaction add failed:", e);
    }
  }

  const existing = await getTransactionHistory(normalizedAddress);
  const updated = [fullRecord, ...existing];
  localStorage.setItem(TX_STORAGE_KEY + normalizedAddress, JSON.stringify(updated));

  return fullRecord;
}


export async function getAllUsers(): Promise<UserProfile[]> {
  if (db) {
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(doc => doc.data() as UserProfile);
    } catch (e) {
      console.warn("Firestore fetch all failed, falling back to local:", e);
    }
  }
  const users: UserProfile[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      users.push(JSON.parse(localStorage.getItem(key) as string));
    }
  }
  return users;
}

export async function deleteUserProfile(walletAddress: string): Promise<void> {
  if (!walletAddress) return;
  const normalizedAddress = walletAddress.toLowerCase();
  
  if (db) {
    try {
      await deleteDoc(doc(db, "users", normalizedAddress));
    } catch (e) {
      console.warn("Firestore delete failed:", e);
    }
  }
  localStorage.removeItem(STORAGE_KEY_PREFIX + normalizedAddress);
  localStorage.removeItem(TX_STORAGE_KEY + normalizedAddress);
}
