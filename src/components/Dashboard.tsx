import React, { useState } from 'react';
import { UserProfile, ALL_TIERS } from '../types';
import { Zap, ShieldCheck, Clock, ArrowUpRight, AlertCircle, CheckCircle2, Loader2, Sparkles, TrendingUp, Info, X, Flame, ExternalLink, Users, Gift, Percent, Share2, RefreshCw, Lock } from 'lucide-react';
import { sendBNBTransaction, sendBHFTTransaction, TREASURY_WALLET, BHFT_TOKEN_ADDRESS, switchToBSC, getOrInitSigner } from '../services/web3';
import { addTransactionRecord } from '../services/firebase';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { DailyLoginStreak } from './DailyLoginStreak';
import { TransactionStatusIndicator } from './TransactionStatusIndicator';
import { ReferralCard } from './ReferralCard';
import { sendPushNotification } from '../services/notifications';
import { parseWeb3Error } from '../utils/errorParser';
import { triggerMiningRewardConfetti } from '../utils/confetti';

import { CommunityTasks } from './CommunityTasks';
import { BscTreasuryPaymentModal } from './BscTreasuryPaymentModal';

interface DashboardProps {
  user: UserProfile;
  bnbPrice: number;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onNavigateToTiers: () => void;
  onPollMiningCalculations?: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  bnbPrice,
  onUpdateUser,
  onNavigateToTiers,
  onPollMiningCalculations,
}) => {
  const [isMining, setIsMining] = useState(false);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showTreasuryModal, setShowTreasuryModal] = useState(false);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [elapsedMs, setElapsedMs] = useState(0);

  const isTonWallet = user.walletType === 'TON' || 
    (typeof window !== 'undefined' && localStorage.getItem('binance_harvest_wallet_type') === 'TON') ||
    Boolean(user.walletAddress && (user.walletAddress.startsWith('UQ') || user.walletAddress.startsWith('EQ') || user.walletAddress.startsWith('kQ')));

  // Calculations with Referral Boosts
  const currentTierInfo = ALL_TIERS.find(t => t.tier === user.currentTier) || ALL_TIERS[0];
  const baseDailyBHFT = currentTierInfo.bhftPerDay || 0.10;
  
  // Referral Multiplier Math: 5% per referred user + 5% for being referred
  const referralCount = user.referralCount || 0;
  const referrerBonusPct = referralCount * 5;
  const refereeBonusPct = user.referredBy ? 5 : 0;
  const totalReferralBonusPct = referrerBonusPct + refereeBonusPct;
  const referralMultiplier = 1 + (totalReferralBonusPct / 100);

  const dailyBHFT = baseDailyBHFT * referralMultiplier;
  const hourlyBHFT = dailyBHFT / 24;
  const bhftBalance = user.miningBalance || 0;
  const usdValue = bhftBalance * 0.50; // Peg: 1 BHFT = $0.50 USD
  const bnbValue = usdValue / bnbPrice;
  
  const withdrawalThresholdUSD = 50.00; // $50 worth of BHFT
  const verificationFeeUSD = 20.00; // Refined to $20 worth of BHFT / BNB
  const isThresholdMet = usdValue >= withdrawalThresholdUSD;
  const verificationFeeBNB = (verificationFeeUSD / bnbPrice).toFixed(5);
  const withdrawalThresholdBNB = (withdrawalThresholdUSD / bnbPrice).toFixed(5);

  // Daily Mining Capacity Utilization based on current tier and total points
  const baseTierDailyPoints = currentTierInfo.pointsPerDay || Math.round(baseDailyBHFT * 500) || 714;
  const dailyCapacityPoints = Math.max(1, Math.round(baseTierDailyPoints * referralMultiplier));
  const userTotalPoints = Math.max(0, user.totalPoints || 0);

  // Utilization calculation (0% to 100%)
  const rawUtilization = (userTotalPoints / dailyCapacityPoints) * 100;
  const capacityUtilizationPercent = Math.min(100, Math.max(0, rawUtilization));
  const isDailyCapReached = userTotalPoints >= dailyCapacityPoints;

  // 30-Second Auto-Refresh polling state for mining calculations
  const [refreshCountdown, setRefreshCountdown] = useState<number>(30);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // 30-Second Auto-Refresh Interval: polls updated mining calculations without manual page refresh
  React.useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          setIsAutoRefreshing(true);
          Promise.resolve(onPollMiningCalculations?.()).finally(() => {
            setTimeout(() => {
              setIsAutoRefreshing(false);
              setLastRefreshedAt(new Date());
            }, 600);
          });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onPollMiningCalculations]);

  const handleManualAutoRefreshTrigger = async () => {
    if (isAutoRefreshing) return;
    setIsAutoRefreshing(true);
    try {
      if (onPollMiningCalculations) {
        await onPollMiningCalculations();
      }
      setLastRefreshedAt(new Date());
      setRefreshCountdown(30);
    } catch (e) {
      console.warn("Manual refresh failed:", e);
    } finally {
      setTimeout(() => setIsAutoRefreshing(false), 500);
    }
  };

  // Track miner live progress
  React.useEffect(() => {
    const startTime = new Date(user.minerStartTimestamp || user.createdAt).getTime();
    setElapsedMs(Math.max(0, Date.now() - startTime));
    
    const interval = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startTime));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [user.minerStartTimestamp, user.createdAt]);

  // Push notification alert when mining finishes
  React.useEffect(() => {
    const startTimeStr = user.minerStartTimestamp || user.createdAt;
    const minerCycleDurationMs = 24 * 60 * 60 * 1000;
    
    if (elapsedMs >= minerCycleDurationMs) {
      const notifiedKey = `notified_miner_end_${startTimeStr}`;
      const alreadyNotified = localStorage.getItem(notifiedKey);
      if (!alreadyNotified) {
        localStorage.setItem(notifiedKey, 'true');
        sendPushNotification("Mining Yield Ready to Harvest! ⚡", {
          body: `Your Tier ${user.currentTier} ASIC cluster has completed its 24-hour cycle. Claim your yield now!`,
        });
      }
    }
  }, [elapsedMs, user.minerStartTimestamp, user.createdAt, user.currentTier]);

  const minerCycleDurationMs = 24 * 60 * 60 * 1000;
  const isMinerEnded = elapsedMs >= minerCycleDurationMs;
  const effectiveElapsed = Math.min(elapsedMs, minerCycleDurationMs);
  const accumulatedBHFT = (effectiveElapsed / minerCycleDurationMs) * dailyBHFT;
  const remainingMs = Math.max(0, minerCycleDurationMs - elapsedMs);

  const formatRemainingCountdown = (ms: number) => {
    if (ms <= 0) return '00h 00m 00s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Claim points/BHFT action: Allowed ONLY after 24h mining cycle completes. Adds full session yield to balance and starts a new 24h cycle
  const handleClaimPoints = async () => {
    if (isMining) return;
    
    // Strict 24-hour cycle validation: Harvesting is locked until the full 24 hours have elapsed
    if (!isMinerEnded) {
      setErrorMessage(`Harvest Locked: Mining cycle is currently active. Rewards can only be harvested after completing the full 24-hour cycle (${formatRemainingCountdown(remainingMs)} remaining).`);
      setTimeout(() => setErrorMessage(null), 6000);
      return;
    }

    setIsMining(true);
    setTimeout(async () => {
      const earned = accumulatedBHFT;
      const newBalance = (user.miningBalance || 0) + earned;
      // Sync totalPoints for backwards compatibility
      const newTotalPoints = newBalance * 500;
      const now = new Date().toISOString();
      
      await onUpdateUser({
        miningBalance: newBalance,
        totalPoints: newTotalPoints,
        miningBalanceBNB: (newBalance * 0.50) / bnbPrice,
        lastClaimDate: now.split('T')[0],
        minerStartTimestamp: now, // Automatically initiates brand new 24h session
      });

      // Record harvest in audit history
      try {
        await addTransactionRecord(user.email || user.walletAddress, {
          type: 'CLAIM',
          amountBNB: (earned * 0.50) / bnbPrice,
          amountUSD: earned * 0.50,
          txHash: `0x_harvest_${Date.now().toString(16)}`,
          status: 'SUCCESS',
        });
      } catch (txErr) {
        console.warn("Could not record harvest tx history:", txErr);
      }
      
      setIsMining(false);
      setSuccessMessage(`Successfully harvested +${earned.toFixed(4)} BHFT! Your balance was credited and a new 24h mining cycle has started.`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Trigger BSC Celebratory Confetti Animation
      triggerMiningRewardConfetti();

      // Trigger glorious Success Animation
      showSuccess({
        initiativeName: 'Cloud Hash Harvest',
        title: '24h Yield Harvested!',
        badge: `+${earned.toFixed(4)} BHFT`,
        description: `Successfully collected your full 24-hour mining yield of ${earned.toFixed(4)} BHFT to your balance. Your next 24-hour ASIC mining session has automatically begun!`,
        details: [
          { label: 'Active Rig', value: `Tier ${user.currentTier} (${dailyBHFT.toFixed(2)} BHFT/day)` },
          { label: 'Harvested Amount', value: `+${earned.toFixed(4)} BHFT` },
          { label: 'Cycle Completed', value: '24 Hours (100% Fulfilled)' },
          { label: 'Updated Balance', value: `${newBalance.toFixed(2)} BHFT` },
          { label: 'Estimated Value', value: `≈ ${(newBalance * 0.50).toFixed(2)} USDT` },
          { label: 'Next Mining Session', value: 'Active (24h Countdown Reset)' },
        ],
      });
    }, 800);
  };

  // Verify & Withdraw action
  const handleVerifyAndWithdraw = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user.walletAddress) {
      const err = "Please connect your MetaMask wallet first.";
      setErrorMessage(err);
      showFailed({
        initiativeName: 'Treasury Settlement',
        title: 'MetaMask Wallet Required',
        description: 'You must connect your Binance Smart Chain Web3 wallet before initiating an on-chain transaction.',
        actionLabel: 'Connect Web3 Wallet',
      });
      return;
    }

    // If the user is already APPROVED / Verified: Show Coming Soon status modal just like on wallet page
    if (user.withdrawalStatus === 'APPROVED' || user.isVerified) {
      showSuccess({
        initiativeName: 'BHFT Token Settlement',
        title: 'BHFT Withdrawals Coming Soon',
        badge: 'MAINNET STAGING',
        description: `Direct on-chain BEP-20 BHFT token withdrawals to connected Web3 wallets are currently being finalized for our mainnet smart contract release. Your account is fully verified and your mined balance of ${bhftBalance.toFixed(2)} BHFT is securely allocated.`,
        details: [
          { label: 'KYC & Wallet Status', value: 'Verified & Whitelisted' },
          { label: 'Allocated BHFT', value: `${bhftBalance.toFixed(2)} BHFT (≈ $${usdValue.toFixed(2)} USD)` },
          { label: 'Minimum Threshold', value: isThresholdMet ? '100.00 BHFT Met' : `${bhftBalance.toFixed(2)} / 100.00 BHFT` },
          { label: 'Planned Launch', value: 'Coming Soon (Mainnet Phase)' },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
        ],
      });
      return;
    }

    // Launch Dual-Flow Web3 Checkout Modal (adapts dynamically to Telegram Mini App vs Native Web3 DApp browser)
    setShowTreasuryModal(true);
  };


  // Next Tier Progress calculation
  const nextTierThresholds = [0, 2000, 6000, 14000, 30000, 60000, 0];
  const isMaxTier = user.currentTier >= 6;
  const nextTierPointsRequired = nextTierThresholds[user.currentTier] || 0;
  const pointsRemaining = isMaxTier ? 0 : Math.max(0, nextTierPointsRequired - user.totalPoints);
  const tierProgressPercent = isMaxTier ? 100 : Math.min(100, (user.totalPoints / nextTierPointsRequired) * 100);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-[#0B0E11] text-[#EAECEF] pb-36 sm:pb-40 overflow-y-auto">
      
      {/* Rate Breakdown Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fade-in">
          <div className="relative w-full max-w-lg my-auto max-h-[90vh] overflow-y-auto overscroll-contain bg-[#1E2329]/95 backdrop-blur-2xl border border-[rgba(255,255,255,0.15)] rounded-2xl p-6 shadow-2xl custom-scrollbar">
            <button
              onClick={() => setShowRateModal(false)}
              className="absolute top-4 right-4 text-[#848E9C] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-[#F3BA2F]" />
              Mining Rate & Formula Breakdown
            </h3>
            <p className="text-xs text-[#848E9C] mb-6">
              How your current hourly and daily points are calculated on Binance Smart Chain:
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">1. Base Tier Rig (Tier {user.currentTier}):</p>
                <p className="text-white">Base Output = <strong className="text-[#F3BA2F]">{baseDailyBHFT.toFixed(4)} BHFT / Day</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1.5">
                <p className="text-[#848E9C]">2. Referral Hashpower Booster:</p>
                <p className="text-white">Friends Invited ({referralCount}) = <span className="text-[#F3BA2F]">+{referrerBonusPct}%</span></p>
                <p className="text-white">Referee Link Active = <span className="text-[#00C087]">{user.referredBy ? '+5%' : '0%'}</span></p>
                <p className="text-amber-300 font-bold">Total Boost = +{totalReferralBonusPct}% (Multiplier: {referralMultiplier.toFixed(2)}x)</p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">3. Effective Boosted Daily Mining:</p>
                <p className="text-white">{baseDailyBHFT.toFixed(4)} × {referralMultiplier.toFixed(2)} = <strong className="text-[#F3BA2F]">{dailyBHFT.toFixed(4)} BHFT / Day</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">4. Hourly Generation Rate:</p>
                <p className="text-white">{dailyBHFT.toFixed(4)} / 24 hours = <strong className="text-[#00C087]">{hourlyBHFT.toFixed(6)} BHFT / Hour</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">5. USDT Equivalent Baseline:</p>
                <p className="text-white">1 BHFT = 0.50 USDT (Pegged)</p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">6. Daily Capacity Utilization:</p>
                <p className="text-white">({userTotalPoints.toLocaleString()} PTS / {dailyCapacityPoints.toLocaleString()} PTS) = <strong className="text-[#00C087]">{capacityUtilizationPercent.toFixed(1)}%</strong></p>
                <p className="text-[11px] text-[#848E9C]">Auto-refreshed every 30 seconds for live recalculation.</p>
              </div>
            </div>

            <button
              onClick={() => setShowRateModal(false)}
              className="w-full mt-6 bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold py-2.5 rounded-lg text-xs transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="w-full lg:w-[280px] bg-[#0B0E11] border-r border-[rgba(255,255,255,0.08)] flex flex-col justify-between p-4 space-y-4">
        <div className="space-y-4">
          <div className="bg-[#1E2329] p-4 rounded-lg border border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">Global Network Hashrate</p>
            <p className="text-2xl font-semibold mono text-white">84.22 <span className="text-sm text-[#848E9C] font-normal">TH/s</span></p>
          </div>

          <div className="bg-[#1E2329] p-4 rounded-lg border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider text-[#848E9C]">Your Account Tier</p>
              <span className="text-[10px] font-mono text-[#00C087] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C087] animate-pulse"></span>
                {capacityUtilizationPercent.toFixed(1)}% Cap
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Tier {user.currentTier}</span>
              <span className="bg-[#F3BA2F]/10 border border-[#F3BA2F] text-[#F3BA2F] px-2 py-0.5 rounded-full text-[10px] font-bold">
                {user.currentTier === 1 ? 'NOVICE' : `PRO RIG T${user.currentTier}`}
              </span>
            </div>
            <p className="text-xs text-[#848E9C] mb-2">Mining Power: {dailyBHFT.toFixed(2)} BHFT / Day</p>
            
            {/* Daily Capacity Utilization Mini Indicator */}
            <div className="flex items-center justify-between mb-3 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[11px]">
              <span className="text-[#848E9C] flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#F3BA2F]" /> Daily Capacity:
              </span>
              <span className="font-mono font-bold text-[#00C087]">
                {capacityUtilizationPercent.toFixed(1)}%
              </span>
            </div>
            
            {/* Tier Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[#848E9C]">
                  {isMaxTier ? 'Max Tier Reached' : `Progress to Tier ${user.currentTier + 1}`}
                </span>
                {!isMaxTier && (
                  <span className="text-[10px] font-mono text-[#00C087]">
                    {tierProgressPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full bg-[#0B0E11] rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${tierProgressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-[#00C087] to-[#00E5A0] rounded-full relative"
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                </motion.div>
              </div>
              {!isMaxTier && (
                <p className="text-[10px] text-[#848E9C] mt-1.5 text-right">
                  <strong className="text-white">{pointsRemaining.toLocaleString()}</strong> more points required
                </p>
              )}
            </div>

            <button
              onClick={onNavigateToTiers}
              className="w-full border border-[rgba(255,255,255,0.08)] hover:bg-white/5 py-2 rounded text-xs text-center font-semibold text-[#F3BA2F] transition"
            >
              {isMaxTier ? 'Manage Max Rig' : 'Upgrade Tier ($1 BNB)'}
            </button>
          </div>

          <div className="bg-[#1E2329] p-4 rounded-lg border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-[#848E9C]">Mining Rate Calculator</p>
              <button onClick={() => setShowRateModal(true)} className="text-[#F3BA2F] hover:text-white transition">
                <Info className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs mono">
              <p className="text-slate-300">Hourly: <strong className="text-[#00C087]">{hourlyBHFT.toFixed(4)} BHFT/hr</strong></p>
              <p className="text-slate-300">Daily: <strong className="text-[#F3BA2F]">{dailyBHFT.toFixed(2)} BHFT</strong></p>
            </div>
          </div>

          <div className="bg-[#1E2329] p-4 rounded-lg border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] uppercase tracking-wider text-[#848E9C]">Daily Streak</p>
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                {user.loginStreak || 0} Day{(user.loginStreak || 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Bonus:</span>
              <strong className="text-[#F3BA2F] mono">+{(user.totalStreakPointsClaimed || 0).toLocaleString()} BHFT</strong>
            </div>
          </div>
        </div>

        <div className="bg-[#181A20] p-4 rounded-lg text-center border border-[rgba(255,255,255,0.08)]">
          <p className="text-[10px] text-[#848E9C] italic">"BinanceHarvest: Secure decentralized cloud mining on BSC"</p>
        </div>
      </aside>

      {/* Center Main Content */}
      <main className="flex-1 bg-[#1E2329] p-6 lg:p-8 flex flex-col justify-between space-y-6">
        
        {/* Notifications */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-3.5 bg-[#00C087]/15 border border-[#00C087]/40 text-[#00C087] text-xs rounded-xl flex items-center gap-2.5 shadow-lg shadow-[#00C087]/10 backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.4 }}
              className="p-3.5 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-xl flex items-center gap-2.5 shadow-lg shadow-red-500/10 backdrop-blur-md"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 24h Mining Session Completed Alert Banner */}
        <AnimatePresence>
          {isMinerEnded && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#F3BA2F]/10 to-amber-500/15 border-2 border-[#F3BA2F]/50 shadow-[0_8px_32px_rgba(243,186,47,0.25)] backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-[#F3BA2F] text-black flex items-center justify-center font-black shrink-0 shadow-lg">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">24h Mining Session Completed</h3>
                    <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      MINING STOPPED
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Your 24-hour ASIC cloud mining session has ended and mining is now halted. Claim your earned <strong className="text-amber-300 font-mono">+{accumulatedBHFT.toFixed(4)} BHFT</strong> to automatically credit your balance and initiate your next 24-hour mining session!
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClaimPoints}
                disabled={isMining}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-[#F3BA2F] to-amber-300 hover:brightness-110 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#F3BA2F]/30 transition shrink-0 cursor-pointer"
              >
                {isMining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Harvesting & Starting Next Cycle...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Harvest 24h Rewards (+{accumulatedBHFT.toFixed(4)} BHFT)</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[#848E9C] text-xs font-medium uppercase tracking-wider">Total Mining Balance</h2>
                <button onClick={() => setShowRateModal(true)} className="text-[#F3BA2F] hover:underline text-[10px] flex items-center gap-1 cursor-pointer">
                  <Info className="w-3 h-3" /> Rate Formula
                </button>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl lg:text-5xl font-bold mono tracking-tighter text-white">
                  {bhftBalance.toFixed(2)}
                </span>
                <span className="text-xl font-semibold text-[#F3BA2F]">BHFT</span>
              </div>
            </div>

            {/* Auto-Refresh 30s Polling Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs backdrop-blur-md self-start md:self-center mt-2 md:mt-0">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isAutoRefreshing ? 'bg-[#00C087]' : 'bg-[#F3BA2F]'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAutoRefreshing ? 'bg-[#00C087]' : 'bg-[#F3BA2F]'}`}></span>
              </span>
              <span className="text-[#848E9C] text-[11px] hidden sm:inline">Auto-Refresh:</span>
              <span className="font-mono font-bold text-white text-[11px]">
                {isAutoRefreshing ? 'Syncing...' : `${refreshCountdown}s`}
              </span>
              <button
                onClick={handleManualAutoRefreshTrigger}
                title="Click to recalculate and refresh mining balance now"
                disabled={isAutoRefreshing}
                className="text-[#848E9C] hover:text-[#F3BA2F] transition cursor-pointer p-0.5"
              >
                <RefreshCw className={`w-3 h-3 ${isAutoRefreshing ? 'animate-spin text-[#00C087]' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[#848E9C] text-[10px] font-medium uppercase tracking-wider">
                {isMinerEnded ? '24h Yield (Ready to Harvest)' : '24h Accruing Yield'}
              </h2>
              {isMinerEnded ? (
                <span className="text-[9px] bg-[#00C087]/20 text-[#00C087] px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1 border border-[#00C087]/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  HARVEST READY
                </span>
              ) : (
                <span className="text-[9px] bg-amber-500/15 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1 border border-amber-500/20">
                  <Lock className="w-2.5 h-2.5" />
                  24H CYCLE
                </span>
              )}
            </div>
            <motion.div
              animate={isMinerEnded ? {
                boxShadow: ["0px 0px 0px 0px rgba(243, 186, 47, 0.1)", "0px 0px 12px 3px rgba(243, 186, 47, 0.35)", "0px 0px 0px 0px rgba(243, 186, 47, 0.1)"]
              } : { 
                boxShadow: ["0px 0px 0px 0px rgba(0, 192, 135, 0.1)", "0px 0px 8px 2px rgba(0, 192, 135, 0.3)", "0px 0px 0px 0px rgba(0, 192, 135, 0.1)"]
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className={`flex items-baseline gap-2 px-3.5 py-1.5 rounded-xl border ${
                isMinerEnded 
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                  : 'bg-[#00C087]/10 border-[#00C087]/20 text-[#00C087]'
              }`}
            >
              <span className={`text-2xl font-bold mono ${isMinerEnded ? 'text-amber-300' : 'text-[#00C087]'}`}>
                +{accumulatedBHFT.toFixed(6)}
              </span>
              <span className={`text-xs font-semibold ${isMinerEnded ? 'text-amber-300/80' : 'text-[#00C087]/80'}`}>
                BHFT
              </span>
            </motion.div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={isMinerEnded && !isMining ? { scale: 1.03 } : {}}
              whileTap={isMinerEnded && !isMining ? { scale: 0.96 } : {}}
              onClick={handleClaimPoints}
              disabled={isMining || !isMinerEnded}
              title={isMinerEnded ? 'Click to harvest your completed 24h rewards' : `Reward harvest locked until 24-hour cycle completes (${formatRemainingCountdown(remainingMs)} remaining)`}
              className={`text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 ${
                isMinerEnded && !isMining
                  ? 'bg-gradient-to-r from-amber-400 via-[#F3BA2F] to-amber-300 hover:brightness-110 shadow-lg shadow-[#F3BA2F]/30 text-black font-extrabold cursor-pointer animate-pulse'
                  : 'bg-[#2B3139]/90 text-[#848E9C] cursor-not-allowed border border-white/5 opacity-80'
              }`}
            >
              {isMining ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isMinerEnded ? (
                <Sparkles className="w-4 h-4 text-black" />
              ) : (
                <Lock className="w-4 h-4 text-[#848E9C]" />
              )}
              <span className={isMinerEnded ? 'text-black font-extrabold' : 'text-[#848E9C]'}>
                {isMining
                  ? 'Harvesting 24h Yield...'
                  : isMinerEnded
                  ? `Harvest Rewards (+${accumulatedBHFT.toFixed(4)})`
                  : `Harvest in ${formatRemainingCountdown(remainingMs)}`}
              </span>
            </motion.button>

            <div className="bg-[#0B0E11] p-3 rounded-xl border border-white/5 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className={`absolute w-6 h-6 rounded-full animate-ping ${isMinerEnded ? 'bg-red-400/30' : 'bg-[#00C087]/30'}`}></div>
                <div className={`w-3 h-3 rounded-full animate-pulse ${isMinerEnded ? 'bg-red-400 shadow-[0_0_16px_#ef4444]' : 'bg-[#00C087] shadow-[0_0_16px_#00C087]'}`}></div>
              </div>
              <div className="leading-tight">
                <p className={`text-xs font-bold flex items-center gap-1.5 ${isMinerEnded ? 'text-[#F3BA2F]' : 'text-[#00C087]'}`}>
                  <span>{isMinerEnded ? '24H CYCLE ENDED' : 'MINING ACTIVE'}</span>
                  {!isMinerEnded && <span className="inline-block w-1.5 h-1.5 bg-[#00C087] rounded-full animate-ping"></span>}
                </p>
                <p className="text-[10px] text-[#848E9C]">
                  {isMinerEnded ? 'Harvest to begin next 24h' : `Tier ${user.currentTier} (${dailyBHFT.toFixed(2)}/day)`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Mining Capacity Utilization Section with Circular Progress Bar */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1E2329]/95 via-[#232A32]/90 to-[#181C22]/95 backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#00C087]/15 via-[#F3BA2F]/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            {/* Left Content & Stats */}
            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-[#00C087]/20 border border-[#F3BA2F]/30 text-[#F3BA2F]">
                  <Zap className="w-5 h-5 text-[#F3BA2F]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Daily Mining Capacity Utilization
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00C087]/15 text-[#00C087] border border-[#00C087]/30">
                      Tier {user.currentTier}
                    </span>
                  </div>
                  <p className="text-xs text-[#848E9C]">
                    Calculated from your accumulated points ({userTotalPoints.toLocaleString()} PTS) relative to Tier {user.currentTier} daily quota ({dailyCapacityPoints.toLocaleString()} PTS/d).
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] uppercase text-[#848E9C] tracking-wider block">Total Points</span>
                  <span className="text-lg font-bold mono text-white">
                    {userTotalPoints.toLocaleString()} <span className="text-[11px] text-[#848E9C] font-normal">PTS</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ≈ {(userTotalPoints / 500).toFixed(2)} BHFT value
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] uppercase text-[#848E9C] tracking-wider block">Daily Tier Capacity</span>
                  <span className="text-lg font-bold mono text-[#F3BA2F]">
                    {dailyCapacityPoints.toLocaleString()} <span className="text-[11px] text-[#848E9C] font-normal">PTS/d</span>
                  </span>
                  <span className="text-[10px] text-[#848E9C] block mt-0.5">
                    {dailyBHFT.toFixed(2)} BHFT/day rate
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase text-[#848E9C] tracking-wider block">Capacity Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isDailyCapReached ? 'bg-[#00C087] animate-pulse' : 'bg-[#F3BA2F]'}`}></span>
                    <span className={`text-xs font-bold ${isDailyCapReached ? 'text-[#00C087]' : capacityUtilizationPercent >= 75 ? 'text-[#00C087]' : 'text-amber-300'}`}>
                      {isDailyCapReached ? '100% Full Quota' : capacityUtilizationPercent >= 75 ? 'Peak Load' : capacityUtilizationPercent >= 25 ? 'Active Output' : 'Initial Load'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Auto-refreshed (30s)
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Visual Circular Progress Bar */}
            <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto pt-2 md:pt-0">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="capacityCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F3BA2F" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#00C087" />
                    </linearGradient>
                    <filter id="capacityCircleGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00C087" floodOpacity="0.4" />
                    </filter>
                  </defs>
                  {/* Background Track */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="9"
                    fill="transparent"
                  />
                  {/* Dynamic Circular Progress */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="url(#capacityCircleGrad)"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={(2 * Math.PI * 48) - ((capacityUtilizationPercent / 100) * (2 * Math.PI * 48))}
                    strokeLinecap="round"
                    fill="transparent"
                    filter="url(#capacityCircleGlow)"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <div className="flex items-center gap-0.5 text-[#F3BA2F] mb-0.5">
                    <Zap className="w-3 h-3 fill-[#F3BA2F]" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black mono text-white tracking-tight leading-none">
                    {capacityUtilizationPercent.toFixed(1)}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[#848E9C] font-extrabold mt-1">
                    UTILIZED
                  </span>
                </div>
              </div>

              <div className="mt-1 text-center">
                <span className="text-[11px] font-mono text-[#00C087] font-semibold">
                  {userTotalPoints.toLocaleString()} / {dailyCapacityPoints.toLocaleString()} PTS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 bg-[#2B3139] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">BHFT Balance</p>
            <p className="text-3xl font-bold mono mb-1 text-white">
              {bhftBalance.toFixed(2)} <span className="text-sm font-normal text-[#848E9C]">BHFT</span>
            </p>
            <p className="text-xs text-[#848E9C]">≈ {usdValue.toFixed(2)} USDT (Peg: 0.50 USDT / BHFT)</p>
          </div>

          <div className="p-6 bg-[#2B3139] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">Minimum Settlement Threshold</p>
            <p className="text-3xl font-bold mono mb-1 text-white">
              100.00 <span className="text-sm font-normal text-[#848E9C]">BHFT</span>
            </p>
            <p className={`text-xs font-medium ${isThresholdMet ? 'text-[#00C087]' : 'text-[#F3BA2F]'}`}>
              {isThresholdMet ? `Threshold Met: 100.00 BHFT Minimum` : `Need ${(100.00 - bhftBalance).toFixed(2)} BHFT to reach threshold`}
            </p>
          </div>
        </div>

        {/* Dedicated Referral Network & Mining Increase Bonus Section */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/80 backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          {/* Mirror Glass Ambient Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-[#00C087]/10 via-[#F3BA2F]/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-[#F3BA2F]/30 to-[#00C087]/20 border border-[#F3BA2F]/40 flex items-center justify-center text-[#F3BA2F] shrink-0 shadow-md">
                <Users className="w-5 h-5 text-[#F3BA2F]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                    Referral Network & Mining Increase Bonus
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00C087]/20 text-[#00C087] border border-[#00C087]/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    +5% Per Referral
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live tracking of referred BSC miners and aggregate hash rate increase bonuses.
                </p>
              </div>
            </div>

            <a
              href="#referral-program-section"
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#F3BA2F] text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite Friends</span>
            </a>
          </div>

          {/* Metric Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4 relative z-10">
            
            {/* 1. Successfully Referred Users */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Successfully Referred</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-black mono text-white">
                  {referralCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {referralCount === 1 ? 'Active User' : 'Active Users'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>+{referrerBonusPct}% from referrals</span>
              </div>
            </div>

            {/* 2. Total Mining Increase Percentage Bonus */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Total Mining Increase</span>
                <Percent className="w-4 h-4 text-[#00C087]" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-black mono text-[#00C087]">
                  +{totalReferralBonusPct}%
                </span>
                <span className="text-xs text-emerald-400/80 font-bold">
                  Bonus Yield
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C087]"></span>
                <span>{referralMultiplier.toFixed(2)}x Speed Multiplier</span>
              </div>
            </div>

            {/* 3. Extra Daily Mined BHFT */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Extra Daily Bonus</span>
                <TrendingUp className="w-4 h-4 text-[#F3BA2F]" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black mono text-[#F3BA2F]">
                  +{(dailyBHFT - baseDailyBHFT).toFixed(4)}
                </span>
                <span className="text-xs text-slate-400">BHFT/d</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <span>Total: {dailyBHFT.toFixed(4)} BHFT/day</span>
              </div>
            </div>

            {/* 4. Referee Kickback Status */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Referee Status</span>
                <Gift className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className={`text-2xl font-black mono ${user.referredBy ? 'text-sky-400' : 'text-slate-500'}`}>
                  {user.referredBy ? '+5%' : '0%'}
                </span>
                <span className="text-xs text-slate-400">
                  {user.referredBy ? 'Boost Active' : 'Unlinked'}
                </span>
              </div>
              <div className="mt-2 text-[10px] text-slate-400 truncate">
                {user.referredBy ? `Linked to ${user.referredBy.substring(0, 6)}...` : 'Enter a code below to activate'}
              </div>
            </div>

          </div>
        </div>

        {/* Community Airdrop Tasks */}
        <CommunityTasks user={user} onUpdateUser={onUpdateUser} />

        {/* Referral Program & Mining Boost Feature */}
        <ReferralCard
          user={user}
          baseDailyBHFT={baseDailyBHFT}
          onUpdateUser={onUpdateUser}
        />

        {/* Daily Login Streak Component (Firestore-backed) */}
        <DailyLoginStreak user={user} onUpdateUser={onUpdateUser} />

        {/* Live Transaction Confirmation & Progress Tracker */}
        <TransactionStatusIndicator user={user} bnbPrice={bnbPrice} />

        {/* Verification & Withdrawal Box */}
        <div className="bg-[#0B0E11] rounded-xl p-6 lg:p-8 border border-[#F3BA2F]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <div className="w-32 h-32 border-8 border-[#F3BA2F] rounded-full"></div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-white">Verification & Withdrawal</h3>
              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                user.withdrawalStatus === 'APPROVED' || user.isVerified ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'bg-[#F3BA2F]/20 text-[#F3BA2F] animate-pulse' :
                'bg-white/10 text-slate-300'
              }`}>
                {user.withdrawalStatus === 'APPROVED' || user.isVerified ? 'VERIFIED • COMING SOON' :
                 user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'PENDING APPROVAL' :
                 'READY TO VERIFY'}
              </span>
            </div>

            {user.withdrawalStatus === 'APPROVED' || user.isVerified ? (
              <p className="text-sm text-slate-300 mb-6 max-w-xl leading-relaxed">
                Your account is <strong className="text-emerald-400 font-semibold">Verified & Whitelisted</strong>! Direct on-chain BEP-20 BHFT token withdrawals to your connected Web3 wallet are currently in final audit and will launch with our mainnet smart contract release. Your mined balance of <strong className="text-[#F3BA2F] mono font-bold">{bhftBalance.toFixed(2)} BHFT</strong> (≈ ${usdValue.toFixed(2)} USDT) is securely allocated.
              </p>
            ) : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
              <p className="text-sm text-slate-300 mb-6 max-w-xl leading-relaxed">
                Your account verification fee has been broadcasted to Binance Smart Chain. Once confirmed, your account will be verified and queued for the mainnet BHFT withdrawal release!
              </p>
            ) : (
              <p className="text-sm text-[#848E9C] mb-6 max-w-xl leading-relaxed">
                To unlock withdrawals upon mainnet release, your account must undergo a one-time blockchain verification. This verification fee (<strong className="text-[#F3BA2F]">{verificationFeeBNB} BNB</strong> ≈ $20.00 USDT) is sent directly to the protocol treasury to whitelist your address. You can pre-verify early at any time!
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <motion.button
                whileHover={
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL'
                    ? {}
                    : { scale: 1.02 }
                }
                whileTap={
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL'
                    ? {}
                    : { scale: 0.97 }
                }
                onClick={handleVerifyAndWithdraw}
                disabled={
                  isProcessingTx ||
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL'
                }
                className={`px-8 py-3.5 rounded-xl font-bold text-sm transition flex items-center gap-2.5 cursor-pointer ${
                  user.withdrawalStatus === 'APPROVED' || user.isVerified
                    ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:brightness-110 text-white shadow-lg shadow-violet-600/30'
                    : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL'
                    ? 'bg-[#2B3139] text-[#848E9C] border border-white/5 cursor-not-allowed'
                    : 'bg-[#F3BA2F] hover:bg-[#e2ad23] text-black shadow-lg shadow-[#F3BA2F]/20'
                }`}
              >
                {isProcessingTx ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Processing...</span>
                  </>
                ) : user.withdrawalStatus === 'APPROVED' || user.isVerified ? (
                  <>
                    <Clock className="w-4 h-4 text-violet-200" />
                    <span>BHFT Withdrawals (Coming Soon)</span>
                  </>
                ) : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F3BA2F]" />
                    <span>Awaiting BSC Confirmation...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Account ({verificationFeeBNB} BNB)</span>
                  </>
                )}
              </motion.button>

              <button
                onClick={onNavigateToTiers}
                className="border border-[rgba(255,255,255,0.08)] hover:bg-white/5 px-6 py-3 rounded-xl text-sm text-[#848E9C] hover:text-white transition cursor-pointer"
              >
                View Tier Rigs
              </button>

              {/* Explicit BSC Treasury Payment Modal button for users on Telegram / TON / Manual OTC */}
              {!user.isVerified && user.withdrawalStatus !== 'APPROVED' && user.withdrawalStatus !== 'PENDING_ADMIN_APPROVAL' && (
                <button
                  type="button"
                  onClick={() => setShowTreasuryModal(true)}
                  className="px-4 py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <span>Pay via BSC Treasury (QR & TxID)</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Right Sidebar */}
      <aside className="w-full lg:w-[300px] bg-[#0B0E11] border-l border-[rgba(255,255,255,0.08)] flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-2">Live Market (Binance)</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white">BNB / USDT</span>
              <span className="text-sm text-[#00C087] font-semibold mono">${bnbPrice.toFixed(2)}</span>
            </div>
            <div className="h-[100px] w-full bg-[#1E2329] rounded flex items-end gap-1 p-2 border border-[rgba(255,255,255,0.08)]">
              <div className="bg-[#00C087]/40 w-full h-[40%] rounded-t"></div>
              <div className="bg-[#00C087]/40 w-full h-[55%] rounded-t"></div>
              <div className="bg-red-500/40 w-full h-[45%] rounded-t"></div>
              <div className="bg-[#00C087]/40 w-full h-[70%] rounded-t"></div>
              <div className="bg-[#00C087]/40 w-full h-[85%] rounded-t"></div>
              <div className="bg-red-500/40 w-full h-[60%] rounded-t"></div>
              <div className="bg-[#00C087]/40 w-full h-[75%] rounded-t"></div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[300px]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-4">Transaction Logs</p>
            <div className="space-y-4 mono text-[10px]">
              <div className="flex justify-between items-start opacity-70">
                <div>
                  <p className="text-white">MINING_CLAIM_SUCCESS</p>
                  <p className="text-[#848E9C]">{new Date().toLocaleDateString()}</p>
                </div>
                <span className="text-[#00C087]">+{((dailyBHFT || 0.10) * 0.25).toFixed(4)} BHFT</span>
              </div>
              <div className="flex justify-between items-start opacity-70">
                <div>
                  <p className="text-white">NODE_SYNC_COMPLETE</p>
                  <p className="text-[#848E9C]">BSC Chain ID: 56</p>
                </div>
                <span className="text-[#F3BA2F]">0.0</span>
              </div>
              <div className="flex justify-between items-start opacity-70">
                <div>
                  <p className="text-white">ACCOUNT_INITIALIZED</p>
                  <p className="text-[#848E9C]">Fresh Start (Tier 1)</p>
                </div>
                <span className="text-[#00C087]">0.00 BHFT</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#181A20] border-t border-[rgba(255,255,255,0.08)] space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#848E9C] mb-1">
              <span>BHFT Token Contract</span>
              <span className="text-[#F3BA2F] font-bold">BEP-20</span>
            </div>
            <a 
              href={`https://bscscan.com/token/${BHFT_TOKEN_ADDRESS}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mono text-[10px] text-amber-400/90 hover:text-amber-300 break-all flex items-center gap-1 transition"
            >
              <span>{BHFT_TOKEN_ADDRESS}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#848E9C] mb-1">
              <span>Treasury Receiver Wallet</span>
              <span className="text-[#00C087]">Verified</span>
            </div>
            <p className="mono text-[10px] text-white/40 break-all">{user.treasuryWalletAddress || TREASURY_WALLET}</p>
          </div>
        </div>
      </aside>

      {/* BSC Treasury Payment Modal with On-Chain Backend Verification & Replay Protection */}
      <BscTreasuryPaymentModal
        isOpen={showTreasuryModal}
        onClose={() => setShowTreasuryModal(false)}
        paymentType="WITHDRAW_FEE"
        costUSD={verificationFeeUSD}
        bnbPrice={bnbPrice}
        userAddress={user.walletAddress}
        isTonWallet={isTonWallet}
        onSuccess={async (result) => {
          setShowTreasuryModal(false);
          await addTransactionRecord(user.email || user.walletAddress, {
            type: 'WITHDRAW_FEE',
            amountBNB: result.amountBNB,
            amountUSD: result.amountUSD,
            txHash: result.txHash,
            status: 'SUCCESS',
          });
          await onUpdateUser({
            withdrawalStatus: 'PENDING_ADMIN_APPROVAL',
            isVerified: true,
          });
          showSuccess({
            initiativeName: 'Treasury Verification Fee',
            title: 'Verification Broadcasted & Confirmed!',
            badge: `${result.amountBNB} BNB`,
            description: `Your one-time ${result.amountBNB} BNB (≈ $${result.amountUSD.toFixed(2)} USD) verification payment was confirmed on BSC with ${result.confirmations} confirmations. Account KYC is verified!`,
            txHash: result.txHash,
            details: [
              { label: 'Transaction Hash', value: `${result.txHash.substring(0, 10)}...` },
              { label: 'Settlement Network', value: 'Binance Smart Chain (BEP-20)' },
              { label: 'Confirmations', value: `${result.confirmations} Blocks Verified` },
              { label: 'Status', value: 'Account Verified' },
            ],
          });
        }}
      />

    </div>
  );
};


