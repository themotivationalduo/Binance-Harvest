export interface UserProfile {
  walletAddress: string; // Primary On-Chain Identifier (BEP-20)
  currentTier: number;
  miningBalance: number; // BHFT amount as a Float (e.g., 12.34 BHFT)
  totalPoints: number; // Legacy, kept for backwards compatibility / UI metrics if needed
  miningBalanceBNB: number; // Legacy, kept for backwards compatibility
  lastClaimDate: string; // Legacy or just day tracking
  minerStartTimestamp?: string; // Exact time the current mining session started
  withdrawalStatus: 'NOT_STARTED' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED';
  treasuryWalletAddress: string;
  isVerified: boolean;
  loginStreak: number;
  lastStreakClaimDate: string;
  totalStreakPointsClaimed: number; // Legacy, maps to BHFT now
  createdAt: string;
  lastActiveTimestamp?: string;
  email?: string;
  // Referral Program Fields
  referredBy?: string; // Referrer's BNB wallet address
  referralCount?: number; // Total number of friends invited
  referredUsers?: string[]; // List of referred user wallet addresses
  referralBonusPercent?: number; // Total active referral boost percentage
}

export interface TierInfo {
  tier: number;
  name: string;
  bhftPerDay: number; // Daily mining rate in BHFT tokens (e.g., 0.10 BHFT/day)
  pointsPerDay: number; // Legacy points rate, kept for backwards compatibility
  upgradeCostUSD: number;
  multiplier: string;
  weeklyYieldUSD: number;
}

export interface TransactionRecord {
  id: string;
  userAddress: string;
  type: 'UPGRADE' | 'WITHDRAW_FEE' | 'CLAIM' | 'TRANSFER' | 'WITHDRAW';
  amountBNB: number;
  amountUSD: number;
  txHash: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CONFIRMED';
  timestamp: string;
  details?: string;
}

export const ADMIN_WALLETS = [
  '0x2a9ba6c55f22a81d6b0c80837996a0ecc28751e6'
];

// Dynamically generate standard 20 Tiers with the new structure
export const ALL_TIERS: TierInfo[] = (() => {
  const list: TierInfo[] = [];
  
  // Tier 1 (Free / Initial) - Mines $0.05 worth of BHFT per day (0.10 BHFT/day)
  list.push({
    tier: 1,
    name: 'Tier 1 Miner',
    bhftPerDay: 0.10, // $0.05 worth of BHFT at $0.50 peg
    pointsPerDay: 714,
    upgradeCostUSD: 0,
    multiplier: '1x',
    weeklyYieldUSD: 0.35, // 0.05 * 7
  });

  // Tier 2
  list.push({
    tier: 2,
    name: 'Tier 2 Pro Rig',
    bhftPerDay: 5.00 / 3.5, // ~1.428 BHFT/day
    pointsPerDay: 1429,
    upgradeCostUSD: 5.00,
    multiplier: '2x',
    weeklyYieldUSD: 5.00,
  });

  // Tier 3
  list.push({
    tier: 3,
    name: 'Tier 3 Elite Cluster',
    bhftPerDay: 10.00 / 3.5, // ~2.857 BHFT/day
    pointsPerDay: 2857,
    upgradeCostUSD: 10.00,
    multiplier: '4x',
    weeklyYieldUSD: 10.00,
  });

  // Tier 4
  list.push({
    tier: 4,
    name: 'Tier 4 Quantum ASIC',
    bhftPerDay: 12.50 / 3.5, // ~3.571 BHFT/day
    pointsPerDay: 3571,
    upgradeCostUSD: 12.50,
    multiplier: '5x',
    weeklyYieldUSD: 12.50,
  });

  // Tier 5
  list.push({
    tier: 5,
    name: 'Tier 5 Binance Titan',
    bhftPerDay: 15.00 / 3.5, // ~4.285 BHFT/day
    pointsPerDay: 4286,
    upgradeCostUSD: 15.00,
    multiplier: '6x',
    weeklyYieldUSD: 15.00,
  });

  // Tier 6 to 20
  for (let t = 6; t <= 20; t++) {
    const cost = 15.00 + (t - 5) * 5.00;
    const pointsPerDay = Math.round((cost * 2000) / 7);
    list.push({
      tier: t,
      name: `Tier ${t} Sovereign Node`,
      bhftPerDay: cost / 3.5,
      pointsPerDay,
      upgradeCostUSD: cost,
      multiplier: `${(cost / 2.5).toFixed(1)}x`,
      weeklyYieldUSD: cost,
    });
  }

  return list;
})();

