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
