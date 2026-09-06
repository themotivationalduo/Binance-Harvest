import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Landmark, ShieldCheck, ExternalLink, Copy, CheckCircle2, Clock, AlertTriangle, RefreshCw, Activity, Layers } from 'lucide-react';
import { TREASURY_WALLET, getLiveTreasuryStats } from '../services/web3';
import { motion } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';

interface TreasuryViewProps {
  user: UserProfile;
  bnbPrice: number;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ user, bnbPrice }) => {
  const [copied, setCopied] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const { showSuccess, showFailed, showCopySuccess } = useInitiativeFeedback();
  const [treasuryStats, setTreasuryStats] = useState<{
    treasuryBnb: string;
    treasuryBnbFormatted: string;
    blockNumber: number;
    gasPriceGwei: string;
  }>({
    treasuryBnb: '...',
    treasuryBnbFormatted: '...',
    blockNumber: 0,
    gasPriceGwei: '3.0',
  });

  const loadOnChainStats = async () => {
    try {
      setLoadingStats(true);
      const stats = await getLiveTreasuryStats();
      setTreasuryStats(stats);
    } catch (e) {
      console.warn("Could not fetch on-chain stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setLoadingStats(true);
      const stats = await getLiveTreasuryStats();
      setTreasuryStats(stats);
      showSuccess({
        initiativeName: 'BSC Treasury Ledger',
        title: 'Node Synchronized!',
        badge: `Block #${stats.blockNumber > 0 ? stats.blockNumber.toLocaleString() : 'Live'}`,
        description: 'Successfully verified live Binance Smart Chain Mainnet ledger state and treasury balance.',
        details: [
          { label: 'Treasury Balance', value: `${stats.treasuryBnbFormatted} BNB` },
          { label: 'Gas Price', value: `${stats.gasPriceGwei} Gwei` },
          { label: 'Network', value: 'BSC Mainnet (BEP-20)' },
        ],
      });
    } catch (e) {
      showFailed({
        initiativeName: 'BSC Treasury Ledger',
        title: 'Node Sync Failed',
        description: 'Unable to reach public BSC RPC endpoint. Retrying in background...',
      });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadOnChainStats();
    const interval = setInterval(loadOnChainStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(TREASURY_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showCopySuccess('Treasury Wallet Address');
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-6">
      
      {/* Header */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-amber-400" />
            Live On-Chain Smart Treasury
          </span>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleManualSync}
            disabled={loadingStats}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>Sync BSC Node</span>
          </motion.button>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Official Treasury & Settlement Contract
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          All tier upgrade payments ($1) and withdrawal verification fees ($5) are broadcast directly to the Binance Smart Chain Treasury wallet.
        </p>
      </div>

      {/* Live On-Chain Node Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Treasury On-Chain Balance</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {treasuryStats.treasuryBnbFormatted} BNB
          </div>
          <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
            ≈ ${(Number(treasuryStats.treasuryBnb || 0) * (bnbPrice || 750)).toFixed(2)} USD
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Current BSC Block</span>
            <Layers className="w-4 h-4 text-[#F3BA2F]" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {treasuryStats.blockNumber > 0 ? `#${treasuryStats.blockNumber.toLocaleString()}` : 'Connecting...'}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synced to BSC Mainnet</span>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Network Gas Price</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {treasuryStats.gasPriceGwei} Gwei
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Ultra-low BEP-20 transfer cost
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Live BNB Exchange</span>
            <span className="text-[11px] text-emerald-400 font-bold">LIVE</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#F3BA2F]">
            ${bnbPrice.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Aggregated Binance Spot Price
          </div>
        </div>
      </div>

      {/* Treasury Wallet Info Card */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Official Treasury Receiver Address</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/60 border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs text-slate-400">BSC Mainnet Verified Address</div>
              <div className="font-mono text-white text-sm sm:text-base truncate">{TREASURY_WALLET}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://bscscan.com/address/${TREASURY_WALLET}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-semibold px-3.5 py-2.5 rounded-xl text-xs transition active:scale-95 shrink-0"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Verify on BscScan</span>
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold px-4 py-2.5 rounded-xl text-xs transition active:scale-95 shrink-0 shadow-lg shadow-[#F3BA2F]/20"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Network Protocol</div>
            <div className="font-bold text-white">Binance Smart Chain (BEP-20)</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Chain ID: 56 (0x38)</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Verification Fee</div>
            <div className="font-bold text-amber-400">$5.00 USD (≈ {(5.00 / bnbPrice).toFixed(5)} BNB)</div>
            <div className="text-[11px] text-slate-400 mt-1">One-time account KYC & security audit</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Upgrade Fee</div>
            <div className="font-bold text-amber-400">$1.00 USD (≈ {(1.00 / bnbPrice).toFixed(5)} BNB)</div>
            <div className="text-[11px] text-slate-400 mt-1">Sequential ASIC rig upgrade tier fee</div>
          </div>
        </div>
      </div>

      {/* User Withdrawal Status Card */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Your Account Settlement & Verification</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              {user.withdrawalStatus === 'APPROVED' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
                <Clock className="w-6 h-6 text-amber-400 animate-spin" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-slate-400" />
              )}
              <div>
                <div className="text-xs text-slate-400">Settlement Status</div>
                <div className="font-bold text-white uppercase text-sm tracking-wide">
                  {user.withdrawalStatus.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Account Verification</div>
              <div className={`font-bold text-sm ${user.isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                {user.isVerified ? 'Verified & Unlocked' : 'Pending Verification'}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-white mb-1">On-Chain Protocol Rules:</div>
            <p>1. Reach the minimum withdrawal threshold ($10.00 USD equivalent in mined points).</p>
            <p>2. Connect your verified Binance Smart Chain Web3 wallet (MetaMask / Trust Wallet).</p>
            <p>3. Broadcast the $5.00 USD verification fee on BSC to the Treasury Wallet.</p>
            <p>4. Your transaction is verified on BscScan and queued for treasury settlement to your wallet.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
