/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, where, orderBy, Firestore, setLogLevel, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, Auth } from 'firebase/auth';
import { UserProfile, TransactionRecord, ReferralActivityEvent, ReferralMilestone, REFERRAL_MILESTONES } from '../types';
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
export const REF_EVENTS_STORAGE_KEY = "binance_harvest_ref_events_";

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
      referralCount: 0,
      referredUsers: [],
      referralBonusPercent: 0,
    };
  }

  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  if (db) {
    try {
      const docRef = doc(db, "users", normalizedAddress);
      const snap = await getDoc(docRef);
      let data: Partial<UserProfile> = {};
      
      if (snap.exists()) {
        data = snap.data() as UserProfile;
      } else {
        // Create initial profile in Firestore
        data = {
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
          referralCount: 0,
          referredUsers: [],
          referralBonusPercent: 0,
        };
        await setDoc(docRef, data, { merge: true });
      }

      // Discover any referees dynamically who registered with referredBy == normalizedAddress
      try {
        const refQuery = query(collection(db, "users"), where("referredBy", "==", normalizedAddress));
        const refSnap = await getDocs(refQuery);
        const discoveredReferred = new Set<string>(data.referredUsers || []);
        refSnap.forEach(d => {
          const refereeAddr = (d.data()?.walletAddress || d.id).toLowerCase();
          if (refereeAddr && refereeAddr !== normalizedAddress) {
            discoveredReferred.add(refereeAddr);
          }
        });

        const mergedUsers = Array.from(discoveredReferred);
        const currentCount = data.referralCount ?? 0;
        if (mergedUsers.length > (data.referredUsers?.length || 0) || currentCount < mergedUsers.length) {
          data.referredUsers = mergedUsers;
          data.referralCount = mergedUsers.length;
          data.referralBonusPercent = (mergedUsers.length * 5) + (data.referredBy ? 5 : 0);
          
          // Persist reconciled referral metrics
          await setDoc(docRef, {
            referredUsers: mergedUsers,
            referralCount: mergedUsers.length,
            referralBonusPercent: data.referralBonusPercent,
            lastActiveTimestamp: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (discoveryErr) {
        console.warn("Referee discovery reconciliation note:", discoveryErr);
      }

      const miningBalance = data.miningBalance !== undefined ? Number(data.miningBalance) : ((data.totalPoints || 0) / 500);
      const referralCount = data.referralCount ?? (data.referredUsers ? data.referredUsers.length : 0);
      const referralBonusPercent = data.referralBonusPercent ?? ((referralCount * 5) + (data.referredBy ? 5 : 0));

      const fullProfile: UserProfile = {
        walletAddress: normalizedAddress,
        currentTier: Number(data.currentTier || 1),
        totalPoints: Number(data.totalPoints || 0),
        miningBalance,
        miningBalanceBNB: Number(data.miningBalanceBNB || 0),
        lastClaimDate: data.lastClaimDate || new Date().toISOString().split('T')[0],
        minerStartTimestamp: data.minerStartTimestamp || new Date().toISOString(),
        withdrawalStatus: data.withdrawalStatus || 'NOT_STARTED',
        treasuryWalletAddress: TREASURY_WALLET,
        isVerified: Boolean(data.isVerified),
        loginStreak: Number(data.loginStreak ?? 0),
        lastStreakClaimDate: data.lastStreakClaimDate ?? '',
        totalStreakPointsClaimed: Number(data.totalStreakPointsClaimed ?? 0),
        createdAt: data.createdAt || new Date().toISOString(),
        lastActiveTimestamp: data.lastActiveTimestamp || new Date().toISOString(),
        referredBy: data.referredBy || undefined,
        referralCount,
        referredUsers: data.referredUsers ?? [],
        referralBonusPercent,
      };

      localStorage.setItem(STORAGE_KEY_PREFIX + normalizedAddress, JSON.stringify(fullProfile));
      return fullProfile;
    } catch (e) {
      console.warn("Firestore fetch failed, falling back to localStorage:", e);
    }
  }

  // Fallback to localStorage
  const localData = localStorage.getItem(STORAGE_KEY_PREFIX + normalizedAddress);
  if (localData) {
    try {
      const profile = JSON.parse(localData) as UserProfile;
      profile.walletAddress = normalizedAddress;
      profile.treasuryWalletAddress = TREASURY_WALLET;
      profile.miningBalance = profile.miningBalance !== undefined ? Number(profile.miningBalance) : ((profile.totalPoints || 0) / 500);
      profile.loginStreak = Number(profile.loginStreak ?? 0);
      profile.lastStreakClaimDate = profile.lastStreakClaimDate ?? '';
      profile.totalStreakPointsClaimed = Number(profile.totalStreakPointsClaimed ?? 0);
      profile.minerStartTimestamp = profile.minerStartTimestamp ?? new Date().toISOString();
      profile.referralCount = Number(profile.referralCount ?? (profile.referredUsers ? profile.referredUsers.length : 0));
      profile.referredUsers = profile.referredUsers ?? [];
      profile.referralBonusPercent = Number(profile.referralBonusPercent ?? (((profile.referralCount ?? 0) * 5) + (profile.referredBy ? 5 : 0)));
      return profile;
    } catch (parseErr) {
      console.warn("Error parsing local storage profile:", parseErr);
    }
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
    referralCount: 0,
    referredUsers: [],
    referralBonusPercent: 0,
  };

  await saveUserProfile(normalizedAddress, defaultProfile);
  return defaultProfile;
}

/**
 * Real-time subscription to user profile and referee additions on Firestore.
 */
export function subscribeToUserProfile(
  walletAddress: string,
  onUpdate: (profile: UserProfile) => void
): () => void {
  if (!walletAddress) return () => {};
  const normalizedAddress = walletAddress.toLowerCase().trim();

  if (!db) {
    // If no db, fetch once
    getUserProfile(normalizedAddress).then(onUpdate);
    return () => {};
  }

  const unsubs: (() => void)[] = [];

  try {
    // 1. Listen to the user's personal profile doc
    const userDocRef = doc(db, "users", normalizedAddress);
    const unsubDoc = onSnapshot(userDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        const miningBalance = data.miningBalance !== undefined ? Number(data.miningBalance) : ((data.totalPoints || 0) / 500);
        const referralCount = data.referralCount ?? (data.referredUsers ? data.referredUsers.length : 0);
        const referralBonusPercent = data.referralBonusPercent ?? ((referralCount * 5) + (data.referredBy ? 5 : 0));

        const updatedProfile: UserProfile = {
          ...data,
          walletAddress: normalizedAddress,
          treasuryWalletAddress: TREASURY_WALLET,
          currentTier: Number(data.currentTier || 1),
          totalPoints: Number(data.totalPoints || 0),
          miningBalance,
          miningBalanceBNB: Number(data.miningBalanceBNB || 0),
          lastClaimDate: data.lastClaimDate || new Date().toISOString().split('T')[0],
          minerStartTimestamp: data.minerStartTimestamp || new Date().toISOString(),
          withdrawalStatus: data.withdrawalStatus || 'NOT_STARTED',
          isVerified: Boolean(data.isVerified),
          loginStreak: Number(data.loginStreak ?? 0),
          lastStreakClaimDate: data.lastStreakClaimDate ?? '',
          totalStreakPointsClaimed: Number(data.totalStreakPointsClaimed ?? 0),
          createdAt: data.createdAt || new Date().toISOString(),
          referralCount,
          referredUsers: data.referredUsers ?? [],
          referralBonusPercent,
        };

        localStorage.setItem(STORAGE_KEY_PREFIX + normalizedAddress, JSON.stringify(updatedProfile));
        onUpdate(updatedProfile);
      }
    }, (err) => {
      console.warn("Firestore profile subscription warning:", err);
    });
    unsubs.push(unsubDoc);

    // 2. Listen to referees registering with this user's address
    const refQuery = query(collection(db, "users"), where("referredBy", "==", normalizedAddress));
    const unsubRef = onSnapshot(refQuery, (querySnap) => {
      if (!querySnap.empty) {
        const discovered = new Set<string>();
        querySnap.forEach((d) => {
          const addr = (d.data()?.walletAddress || d.id).toLowerCase();
          if (addr && addr !== normalizedAddress) {
            discovered.add(addr);
          }
        });
        const refereeList = Array.from(discovered);
        
        getUserProfile(normalizedAddress).then((currentProfile) => {
          const existingList = currentProfile.referredUsers || [];
          const combined = Array.from(new Set([...existingList, ...refereeList]));
          if (combined.length > existingList.length || (currentProfile.referralCount || 0) < combined.length) {
            const newCount = combined.length;
            const newBonus = (newCount * 5) + (currentProfile.referredBy ? 5 : 0);
            const reconciled: UserProfile = {
              ...currentProfile,
              referredUsers: combined,
              referralCount: newCount,
              referralBonusPercent: newBonus,
            };
            saveUserProfile(normalizedAddress, reconciled);
            onUpdate(reconciled);
          }
        });
      }
    }, (err) => {
      console.warn("Firestore referee query subscription warning:", err);
    });
    unsubs.push(unsubRef);

  } catch (err) {
    console.warn("Error setting up Firestore subscriptions:", err);
  }

  return () => {
    unsubs.forEach(unsub => {
      try {
        unsub();
      } catch (e) {}
    });
  };
}

/**
 * Applies a referral code linking a referee to a referrer.
 * Rewards both with a permanent +5% Daily Mining boost.
 */
export async function applyReferralCode(
  refereeAddress: string,
  rawReferrerCode: string
): Promise<{ success: boolean; message: string; referrerAddress?: string; updatedProfile?: UserProfile }> {
  if (!refereeAddress) {
    return { success: false, message: 'Please connect your wallet first.' };
  }

  const normalizedReferee = refereeAddress.toLowerCase().trim();
  let normalizedReferrer = rawReferrerCode.trim().toLowerCase();

  // Extract address if full URL or prefix e.g. ref-0x... or https://.../ref-0x... or ?ref=0x...
  const match = normalizedReferrer.match(/0x[a-f0-9]{40}/i);
  if (match) {
    normalizedReferrer = match[0].toLowerCase();
  }

  // Validate BEP-20 / EVM address format
  if (!normalizedReferrer.startsWith('0x') || normalizedReferrer.length !== 42) {
    return {
      success: false,
      message: 'Invalid referral code. Must be a valid 42-character BSC wallet address (0x...).',
    };
  }

  // Prevent self-referral
  if (normalizedReferee === normalizedReferrer) {
    return {
      success: false,
      message: 'You cannot use your own referral code!',
    };
  }

  // Fetch referee profile
  const refereeProfile = await getUserProfile(normalizedReferee);
  if (refereeProfile.referredBy) {
    return {
      success: false,
      message: `You have already applied a referral code (Referred by ${refereeProfile.referredBy.substring(0, 6)}...${refereeProfile.referredBy.substring(38)}).`,
    };
  }

  try {
    // 1. Fetch and update Referrer's profile (+1 referral, add referee to referredUsers list, +5% boost)
    const referrerProfile = await getUserProfile(normalizedReferrer);
    const existingReferredUsers = referrerProfile.referredUsers || [];
    const isAlreadyInList = existingReferredUsers.includes(normalizedReferee);

    const updatedReferredUsers = isAlreadyInList
      ? existingReferredUsers
      : [...existingReferredUsers, normalizedReferee];

    const updatedReferralCount = updatedReferredUsers.length;
    const updatedReferrerBonusPercent = (updatedReferralCount * 5) + (referrerProfile.referredBy ? 5 : 0);

    const updatedReferrerProfile: UserProfile = {
      ...referrerProfile,
      walletAddress: normalizedReferrer,
      currentTier: Number(referrerProfile.currentTier || 1),
      totalPoints: Number(referrerProfile.totalPoints || 0),
      miningBalance: Number(referrerProfile.miningBalance || 0),
      referralCount: updatedReferralCount,
      referredUsers: updatedReferredUsers,
      referralBonusPercent: updatedReferrerBonusPercent,
      lastActiveTimestamp: new Date().toISOString(),
    };

    await saveUserProfile(normalizedReferrer, updatedReferrerProfile);

    // 2. Fetch and update Referee's profile (set referredBy, +5% bonus for being referred)
    const refereeReferralCount = Number(refereeProfile.referralCount || 0);
    const updatedRefereeProfile: UserProfile = {
      ...refereeProfile,
      walletAddress: normalizedReferee,
      currentTier: Number(refereeProfile.currentTier || 1),
      totalPoints: Number(refereeProfile.totalPoints || 0),
      miningBalance: Number(refereeProfile.miningBalance || 0),
      referredBy: normalizedReferrer,
      referralCount: refereeReferralCount,
      referralBonusPercent: (refereeReferralCount * 5) + 5, // +5% bonus for being referred
      lastActiveTimestamp: new Date().toISOString(),
    };

    await saveUserProfile(normalizedReferee, updatedRefereeProfile);

    // 3. Create persistent email-like notification logs for both parties
    try {
      await addReferralActivityEvent({
        referrerAddress: normalizedReferrer,
        refereeAddress: normalizedReferee,
        type: 'REFERRAL_JOINED',
        title: 'New Referee Joined Syndicate',
        subject: `[SPEED BOOST +5%] Miner ${normalizedReferee.substring(0, 6)}...${normalizedReferee.substring(38)} joined via your link`,
        speedIncreasePercent: 5.0,
        totalBoostPercent: updatedReferrerBonusPercent,
        status: 'VERIFIED',
        details: `Your referral network expanded to ${updatedReferralCount} active miner${updatedReferralCount === 1 ? '' : 's'}. Mining velocity increased by +5.0% across all Binance Smart Chain cloud rigs.`,
      });

      await addReferralActivityEvent({
        referrerAddress: normalizedReferrer,
        refereeAddress: normalizedReferee,
        type: 'SPEED_BOOST_ACTIVATED',
        title: 'Referral Welcome Boost Active',
        subject: `[WELCOME BOOST] Connected to Referrer ${normalizedReferrer.substring(0, 6)}...${normalizedReferrer.substring(38)} (+5% Hashrate)`,
        speedIncreasePercent: 5.0,
        totalBoostPercent: updatedRefereeProfile.referralBonusPercent || 5,
        status: 'VERIFIED',
        details: `Successfully connected to BSC referral node ${normalizedReferrer}. A permanent +5.0% hashrate speed increase has been applied to your daily mining output.`,
      });
    } catch (logErr) {
      console.warn("Could not write referral event log:", logErr);
    }

    console.log(`✅ Referral linked successfully: Referrer ${normalizedReferrer} (+${updatedReferrerBonusPercent}%), Referee ${normalizedReferee} (+${updatedRefereeProfile.referralBonusPercent}%)`);

    return {
      success: true,
      message: 'Referral code applied! You and your referrer both received a +5% Daily Mining boost.',
      referrerAddress: normalizedReferrer,
      updatedProfile: updatedRefereeProfile,
    };
  } catch (err: any) {
    console.error('Error applying referral code:', err);
    return {
      success: false,
      message: err?.message || 'Failed to apply referral code. Please try again.',
    };
  }
}

export async function saveUserProfile(walletAddress: string, profile: UserProfile): Promise<void> {
  if (!walletAddress) return;
  const normalizedAddress = walletAddress.toLowerCase().trim();
  const currentTier = Number(profile.currentTier || 1);
  const totalPoints = Number(profile.totalPoints || 0);
  const miningBalance = Number(profile.miningBalance !== undefined ? profile.miningBalance : (totalPoints / 500));
  const referralCount = Number(profile.referralCount ?? (profile.referredUsers ? profile.referredUsers.length : 0));
  const referralBonusPercent = Number(profile.referralBonusPercent ?? ((referralCount * 5) + (profile.referredBy ? 5 : 0)));

  const dataToSave: UserProfile = {
    ...profile,
    walletAddress: normalizedAddress,
    currentTier,
    totalPoints,
    miningBalance,
    referralCount,
    referredUsers: profile.referredUsers || [],
    referralBonusPercent,
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
  localStorage.removeItem(REF_EVENTS_STORAGE_KEY + normalizedAddress);
}

// -------------------------------------------------------------
// Referral Activity Logs (Email-like Notifications & History)
// -------------------------------------------------------------

export async function addReferralActivityEvent(event: Omit<ReferralActivityEvent, 'id' | 'timestamp'>): Promise<ReferralActivityEvent> {
  const fullEvent: ReferralActivityEvent = {
    ...event,
    id: 'refevt_' + Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toISOString(),
    read: false,
  };

  if (db) {
    try {
      await addDoc(collection(db, "referralEvents"), fullEvent);
    } catch (e) {
      console.warn("Firestore referral event add failed:", e);
    }
  }

  // Save locally for referrer
  if (event.referrerAddress) {
    const keyRef = REF_EVENTS_STORAGE_KEY + event.referrerAddress.toLowerCase();
    const existingRef: ReferralActivityEvent[] = JSON.parse(localStorage.getItem(keyRef) || '[]');
    localStorage.setItem(keyRef, JSON.stringify([fullEvent, ...existingRef]));
  }

  // Save locally for referee
  if (event.refereeAddress && event.refereeAddress.toLowerCase() !== event.referrerAddress?.toLowerCase()) {
    const keyReferee = REF_EVENTS_STORAGE_KEY + event.refereeAddress.toLowerCase();
    const existingReferee: ReferralActivityEvent[] = JSON.parse(localStorage.getItem(keyReferee) || '[]');
    localStorage.setItem(keyReferee, JSON.stringify([fullEvent, ...existingReferee]));
  }

  return fullEvent;
}

export async function getReferralActivityHistory(walletAddress: string, profile?: UserProfile): Promise<ReferralActivityEvent[]> {
  if (!walletAddress) return [];
  const normalizedAddress = walletAddress.toLowerCase().trim();
  const events: ReferralActivityEvent[] = [];

  if (db) {
    try {
      const q1 = query(collection(db, "referralEvents"), where("referrerAddress", "==", normalizedAddress));
      const snap1 = await getDocs(q1);
      snap1.forEach(docSnap => events.push(docSnap.data() as ReferralActivityEvent));

      const q2 = query(collection(db, "referralEvents"), where("refereeAddress", "==", normalizedAddress));
      const snap2 = await getDocs(q2);
      snap2.forEach(docSnap => {
        const item = docSnap.data() as ReferralActivityEvent;
        if (!events.some(e => e.id === item.id)) {
          events.push(item);
        }
      });
    } catch (e) {
      console.warn("Firestore referralEvents query failed, checking local:", e);
    }
  }

  const localEvents: ReferralActivityEvent[] = JSON.parse(localStorage.getItem(REF_EVENTS_STORAGE_KEY + normalizedAddress) || '[]');
  localEvents.forEach(item => {
    if (!events.some(e => e.id === item.id)) {
      events.push(item);
    }
  });

  // Synthesize events for any referred users that don't have an explicit event yet
  if (profile && profile.referredUsers && profile.referredUsers.length > 0) {
    profile.referredUsers.forEach((referee, idx) => {
      const alreadyHas = events.some(e => e.refereeAddress.toLowerCase() === referee.toLowerCase() && e.referrerAddress.toLowerCase() === normalizedAddress);
      if (!alreadyHas) {
        const estBoost = (idx + 1) * 5 + (profile.referredBy ? 5 : 0);
        events.push({
          id: `synth_ref_${referee.substring(2, 10)}_${idx}`,
          referrerAddress: normalizedAddress,
          refereeAddress: referee.toLowerCase(),
          type: 'REFERRAL_JOINED',
          title: 'Referee Onboarded',
          subject: `[BOOST ACTIVATED] Miner ${referee.substring(0, 6)}...${referee.substring(38)} joined your mining syndicate`,
          speedIncreasePercent: 5.0,
          totalBoostPercent: estBoost,
          timestamp: profile.createdAt || new Date().toISOString(),
          status: 'VERIFIED',
          details: `Permanent +5.0% hashrate boost applied to your BSC mining node. Total syndicate members: ${idx + 1}.`,
          read: true,
        });
      }
    });
  }

  // Synthesize event if user was referred by someone
  if (profile && profile.referredBy) {
    const hasWelcome = events.some(e => e.type === 'SPEED_BOOST_ACTIVATED' && e.refereeAddress.toLowerCase() === normalizedAddress);
    if (!hasWelcome) {
      events.push({
        id: `synth_welcome_${normalizedAddress.substring(2, 10)}`,
        referrerAddress: profile.referredBy.toLowerCase(),
        refereeAddress: normalizedAddress,
        type: 'SPEED_BOOST_ACTIVATED',
        title: 'Referral Welcome Boost Active',
        subject: `[WELCOME BOOST] Connected to Referrer ${profile.referredBy.substring(0, 6)}...${profile.referredBy.substring(38)} (+5% Hashrate)`,
        speedIncreasePercent: 5.0,
        totalBoostPercent: profile.referralBonusPercent || 5,
        timestamp: profile.createdAt || new Date().toISOString(),
        status: 'VERIFIED',
        details: `Initial syndicate welcome link activated. +5.0% permanent mining speed increase active on BEP-20 node.`,
        read: true,
      });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getMilestoneForReferrals(referralCount: number): ReferralMilestone {
  const count = Number(referralCount || 0);
  for (const milestone of REFERRAL_MILESTONES) {
    if (count >= milestone.minReferrals) {
      return milestone;
    }
  }
  return {
    minReferrals: 0,
    name: 'Genesis Miner',
    boostPercent: 0,
    badge: 'GENESIS',
    color: 'from-slate-600 to-slate-700',
    iconName: 'Shield',
    description: 'Starting mining node with base hashrate',
  };
}

export interface TopReferrerItem {
  rank: number;
  address: string;
  referralCount: number;
  boostPercent: number;
  milestone: ReferralMilestone;
  isYou?: boolean;
  totalEstimatedEarnedUSD: number;
  activeTier: number;
}

export async function getTopReferrersLeaderboard(currentUserAddress?: string): Promise<TopReferrerItem[]> {
  const normalizedUser = (currentUserAddress || '').toLowerCase().trim();
  const allUsers = await getAllUsers();

  // Known benchmark BSC network top nodes to ensure rich gamified competition
  const benchmarkNodes: { address: string; referralCount: number; activeTier: number }[] = [
    { address: '0x3F7159c2980757d54b8e21D09A87C3e309738a29', referralCount: 56, activeTier: 6 },
    { address: '0x8B228f447A9c1482E2b152DcA7f6775678681c40', referralCount: 38, activeTier: 5 },
    { address: '0x9E10fbc286c478413AcE2e15A9e9A6b2F4f74f77', referralCount: 29, activeTier: 5 },
    { address: '0x1C497c36F32eDa462208E776F6D4164b3E489d88', referralCount: 18, activeTier: 4 },
    { address: '0x7A82d2C7e80D3A635dF756475685B5b38F243b12', referralCount: 12, activeTier: 3 },
    { address: '0x5D3a1e9Bf74C97813a4cD8861d8aA308B9D08721', referralCount: 8, activeTier: 3 },
    { address: '0x4E9281a1795C24D984F772861a49B8aE374b6284', referralCount: 6, activeTier: 2 },
    { address: '0x2C8834918e7724aB97d62057F6Ac5576a89c9251', referralCount: 4, activeTier: 2 },
    { address: '0x6A192e482d8615A429b47e5A8eF36284931aC192', referralCount: 3, activeTier: 2 },
  ];

  // Map user addresses to unique objects
  const addressMap = new Map<string, { address: string; referralCount: number; activeTier: number }>();

  // Add benchmark nodes
  benchmarkNodes.forEach(b => {
    addressMap.set(b.address.toLowerCase(), { ...b, address: b.address.toLowerCase() });
  });

  // Merge real users from database
  allUsers.forEach(u => {
    if (!u.walletAddress) return;
    const addr = u.walletAddress.toLowerCase();
    const count = Number(u.referralCount ?? (u.referredUsers ? u.referredUsers.length : 0));
    const tier = Number(u.currentTier || 1);
    
    const existing = addressMap.get(addr);
    if (!existing || count >= existing.referralCount) {
      addressMap.set(addr, {
        address: addr,
        referralCount: count,
        activeTier: tier,
      });
    }
  });

  // Ensure current user is present
  if (normalizedUser && !addressMap.has(normalizedUser)) {
    const userProfile = await getUserProfile(normalizedUser);
    addressMap.set(normalizedUser, {
      address: normalizedUser,
      referralCount: Number(userProfile.referralCount ?? (userProfile.referredUsers ? userProfile.referredUsers.length : 0)),
      activeTier: Number(userProfile.currentTier || 1),
    });
  }

  // Sort descending by referralCount
  const sorted = Array.from(addressMap.values()).sort((a, b) => {
    if (b.referralCount !== a.referralCount) {
      return b.referralCount - a.referralCount;
    }
    return b.activeTier - a.activeTier;
  });

  // Take top 10 and map to TopReferrerItem
  const topList: TopReferrerItem[] = sorted.slice(0, 10).map((item, index) => {
    const boostPercent = item.referralCount * 5;
    const milestone = getMilestoneForReferrals(item.referralCount);
    const estEarnedUSD = Number(((item.referralCount * 12.5) + (item.activeTier * 25.0)).toFixed(2));
    const isYou = normalizedUser ? item.address.toLowerCase() === normalizedUser : false;

    return {
      rank: index + 1,
      address: item.address,
      referralCount: item.referralCount,
      boostPercent,
      milestone,
      isYou,
      totalEstimatedEarnedUSD: estEarnedUSD,
      activeTier: item.activeTier,
    };
  });

  // If current user is not in top 10, calculate their rank
  if (normalizedUser && !topList.some(item => item.isYou)) {
    const userIndex = sorted.findIndex(item => item.address.toLowerCase() === normalizedUser);
    if (userIndex !== -1) {
      const userItem = sorted[userIndex];
      const boostPercent = userItem.referralCount * 5;
      const milestone = getMilestoneForReferrals(userItem.referralCount);
      const estEarnedUSD = Number(((userItem.referralCount * 12.5) + (userItem.activeTier * 25.0)).toFixed(2));
      
      topList.push({
        rank: userIndex + 1,
        address: userItem.address,
        referralCount: userItem.referralCount,
        boostPercent,
        milestone,
        isYou: true,
        totalEstimatedEarnedUSD: estEarnedUSD,
        activeTier: userItem.activeTier,
      });
    }
  }

  return topList;
}
