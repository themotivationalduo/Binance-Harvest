export interface UserProfile {
  walletAddress: string; // Primary On-Chain Identifier (BEP-20)
  currentTier: number;
  totalPoints: number;
  miningBalanceBNB: number;
  lastClaimDate: string; // Legacy or just day tracking
  minerStartTimestamp?: string; // Exact time the current mining session started
  withdrawalStatus: 'NOT_STARTED' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED';
  treasuryWalletAddress: string;
  isVerified: boolean;
  loginStreak: number;
  lastStreakClaimDate: string;
  totalStreakPointsClaimed: number;
  createdAt: string;
  lastActiveTimestamp?: string;
}

export interface TierInfo {
  tier: number;
  name: string;
  pointsPerDay: number;
  upgradeCostUSD: number;
  multiplier: string;
  weeklyYieldUSD: number;
}

export interface TransactionRecord {
  id: string;
  userAddress: string;
  type: 'UPGRADE' | 'WITHDRAW_FEE' | 'CLAIM';
  amountBNB: number;
  amountUSD: number;
  txHash: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  timestamp: string;
}

export const ADMIN_WALLETS = [
  '0x2a9ba6c55f22a81d6b0c80837996a0ecc28751e6'
];

// Dynamically generate standard 20 Tiers with the new structure
export const ALL_TIERS: TierInfo[] = (() => {
  const list: TierInfo[] = [];
  
  // Tier 1 (Free / Initial)
  list.push({
    tier: 1,
    name: 'Tier 1 Miner',
    pointsPerDay: 714, // Math.round((2.5 * 2000) / 7)
    upgradeCostUSD: 0,
    multiplier: '1x',
    weeklyYieldUSD: 2.50,
  });

  // Tier 2
  list.push({
    tier: 2,
    name: 'Tier 2 Pro Rig',
    pointsPerDay: 1429, // Math.round((5 * 2000) / 7)
    upgradeCostUSD: 5.00,
    multiplier: '2x',
    weeklyYieldUSD: 5.00,
  });

  // Tier 3
  list.push({
    tier: 3,
    name: 'Tier 3 Elite Cluster',
    pointsPerDay: 2857, // Math.round((10 * 2000) / 7)
    upgradeCostUSD: 10.00,
    multiplier: '4x',
    weeklyYieldUSD: 10.00,
  });

  // Tier 4
  list.push({
    tier: 4,
    name: 'Tier 4 Quantum ASIC',
    pointsPerDay: 3571, // Math.round((12.5 * 2000) / 7)
    upgradeCostUSD: 12.50,
    multiplier: '5x',
    weeklyYieldUSD: 12.50,
  });

  // Tier 5
  list.push({
    tier: 5,
    name: 'Tier 5 Binance Titan',
    pointsPerDay: 4286, // Math.round((15 * 2000) / 7)
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
      pointsPerDay,
      upgradeCostUSD: cost,
      multiplier: `${(cost / 2.5).toFixed(1)}x`,
      weeklyYieldUSD: cost,
    });
  }

  return list;
})();

