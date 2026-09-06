export interface UserProfile {
  email: string;
  walletAddress: string;
  currentTier: number;
  totalPoints: number;
  miningBalanceBNB: number;
  lastClaimDate: string;
  withdrawalStatus: 'NOT_STARTED' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED';
  treasuryWalletAddress: string;
  isVerified: boolean;
  createdAt: string;
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
  type: 'UPGRADE' | 'WITHDRAW_FEE' | 'CLAIM';
  amountBNB: number;
  amountUSD: number;
  txHash: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  timestamp: string;
}
