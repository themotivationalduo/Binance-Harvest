import React, { useEffect, useState } from 'react';
import { UserProfile, TransactionRecord } from '../types';
import { User, Wallet, Globe, Shield, CheckCircle2, RefreshCw, Flame, Sparkles, Medal, Bell, BellOff, Info, ArrowUpDown, Coins } from 'lucide-react';
import { switchToBSC, TREASURY_WALLET, getUSDTBalance, getSwapQuote, executeUSDTtoBNBSwap } from '../services/web3';
import { motion } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { getTransactionHistory } from '../services/firebase';
import { ACHIEVEMENTS_DATA, evaluateAchievements } from '../lib/achievements';
import { ethers } from 'ethers';
import { 
  requestNotificationPermission, 
  isNotificationSupported, 
  hasNotificationPermission, 
  sendPushNotification 
} from '../services/notifications';

interface ProfileViewProps {
  user: UserProfile;
  bnbPrice: number;
  walletAddress: string | null;
  walletBalance?: string;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onOpenAuth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  bnbPrice,
  walletAddress,
  walletBalance,
  onConnectWallet,
  onDisconnectWallet,
  onOpenAuth,
}) => {
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [notificationState, setNotificationState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');

  // Quick Swap states
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [usdtInput, setUsdtInput] = useState("20");
  const [estimatedBnb, setEstimatedBnb] = useState("0.000000");
  const [estimatedRate, setEstimatedRate] = useState("0.00");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapSuccessHash, setSwapSuccessHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalancesAndQuotes = async () => {
      if (!walletAddress) return;
      try {
        const bal = await getUSDTBalance(walletAddress);
        setUsdtBalance(bal);
      } catch (err) {
        console.error("USDT balance fetch error:", err);
      }
    };
    fetchBalancesAndQuotes();
  }, [walletAddress]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!usdtInput || isNaN(Number(usdtInput)) || Number(usdtInput) <= 0) {
        setEstimatedBnb("0.000000");
        return;
      }
      try {
        setLoadingQuote(true);
        const quote = await getSwapQuote(usdtInput, bnbPrice);
        setEstimatedBnb(quote.bnbAmount);
        setEstimatedRate(quote.rate);
      } catch (err) {
        console.error("Quote fetch error:", err);
      } finally {
        setLoadingQuote(false);
      }
    };
    
    const delayDebounceFn = setTimeout(() => {
      fetchQuote();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [usdtInput, bnbPrice]);

  const handleSwap = async () => {
    setSwapError(null);
    setSwapSuccessHash(null);
    if (!walletAddress) {
      setSwapError("Please connect your wallet first.");
      return;
    }
    if (!usdtInput || isNaN(Number(usdtInput)) || Number(usdtInput) <= 0) {
      setSwapError("Please enter a valid USDT amount.");
      return;
    }
    try {
      setSwapping(true);
      
      let provider: ethers.BrowserProvider | null = null;
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        provider = new ethers.BrowserProvider((window as any).ethereum);
      }
      if (!provider) {
        throw new Error("Web3 provider not found. Please open this app in MetaMask or dynamic Web3 client.");
      }
      
      const signer = await provider.getSigner();
      const hash = await executeUSDTtoBNBSwap(signer, usdtInput, estimatedBnb);
      setSwapSuccessHash(hash);
      
      // Update USDT balance
      const bal = await getUSDTBalance(walletAddress);
      setUsdtBalance(bal);
      
      showSuccess({
        initiativeName: 'PancakeSwap Router Swap',
        title: 'Swap Executed!',
        badge: `${estimatedBnb} BNB Received`,
        description: `Successfully swapped ${usdtInput} USDT to ${estimatedBnb} BNB directly on PancakeSwap V2 Router!`,
        txHash: hash,
        details: [
          { label: 'Amount Paid', value: `${usdtInput} USDT` },
          { label: 'Amount Received', value: `${estimatedBnb} BNB` },
          { label: 'Status', value: 'Confirmed (1 block)' },
        ],
      });
      
      sendPushNotification("Quick Swap Completed! 🔄", {
        body: `Swapped ${usdtInput} USDT to ${estimatedBnb} BNB successfully on BSC!`,
      });
    } catch (err: any) {
      console.error("Swap execution error:", err);
      const msg = err?.reason || err?.message || "Failed to execute swap on PancakeSwap. Please check your USDT balance & approval.";
      setSwapError(msg);
      showFailed({
        initiativeName: 'PancakeSwap Router Swap',
        title: 'Swap Failed',
        badge: 'Error',
        description: msg,
      });
    } finally {
      setSwapping(false);
    }
  };

  useEffect(() => {
    if (!isNotificationSupported()) {
      setNotificationState('unsupported');
    } else {
      setNotificationState(Notification.permission);
    }
  }, []);

  const handleToggleNotifications = async () => {
    if (notificationState === 'unsupported') return;
    
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationState('granted');
      sendPushNotification("Notifications Activated! 🔔", {
        body: "BinanceHarvest will now notify you when your mining session completes or when you level up!",
      });
      showSuccess({
        initiativeName: 'Notification Engine',
        title: 'Push Notifications Enabled',
        badge: 'PUSH SUCCESS',
        description: 'You will now receive dynamic browser alerts when your mining cycle finishes or when your miner reaches a new milestone tier.',
      });
    } else {
      setNotificationState('denied');
      showFailed({
        initiativeName: 'Notification Engine',
        title: 'Permission Denied',
        description: 'Please enable notifications manually inside your browser address bar settings to receive mining session completion alerts.',
      });
    }
  };

  useEffect(() => {
    const fetchAchievements = async () => {
      if (user.walletAddress) {
        const txs = await getTransactionHistory(user.walletAddress);
        const unlocked = evaluateAchievements(user, txs);
        setUnlockedAchievements(unlocked);
      }
    };
    fetchAchievements();
  }, [user.walletAddress, user.totalPoints, user.loginStreak, user.currentTier, user.withdrawalStatus]);

  const handleSwitch = async () => {
    setSwitchingNetwork(true);
    const success = await switchToBSC();
    setSwitchingNetwork(false);

    if (success) {
      showSuccess({
        initiativeName: 'Network Synchronization',
        title: 'Binance Smart Chain Active!',
        badge: 'Chain ID 56',
        description: 'Successfully switched or verified your active wallet connection to Binance Smart Chain Mainnet (BEP-20).',
        details: [
          { label: 'Network', value: 'BSC Mainnet' },
          { label: 'RPC Endpoint', value: 'https://bsc-dataseed.binance.org/' },
          { label: 'Native Currency', value: 'BNB' },
        ],
      });
    } else {
      showFailed({
        initiativeName: 'Network Synchronization',
        title: 'Network Switch Rejected',
        description: 'Could not switch wallet to Binance Smart Chain Mainnet. Please approve the network switch prompt in your Web3 wallet.',
        actionLabel: 'Try Switch Again',
        onAction: () => handleSwitch(),
      });
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-6">
      
      {/* Header */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-400" />
            Miner Profile & Wallet
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Account Settings
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your Web3 connection, Binance Smart Chain configuration, and profile credentials.
        </p>
      </div>

      {/* Wallet Card */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-6">
        <h3 className="text-lg font-bold text-white">Web3 Connection</h3>

        {walletAddress ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-white/10">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs text-slate-400">Connected Wallet (BSC Mainnet)</div>
                  <div className="font-mono text-white text-sm sm:text-base font-semibold truncate">{walletAddress}</div>
                  {walletBalance && (
                    <div className="text-xs font-mono font-bold text-[#F3BA2F] mt-0.5">
                      Balance: {Number(walletBalance).toFixed(4)} BNB (≈ ${(Number(walletBalance) * bnbPrice).toFixed(2)} USD)
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onDisconnectWallet}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition self-start sm:self-auto shrink-0"
              >
                Disconnect
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xs text-slate-400">Active Network</div>
                  <div className="font-bold text-white text-sm">Binance Smart Chain Mainnet (Chain ID: 56)</div>
                </div>
              </div>
              <button
                onClick={handleSwitch}
                disabled={switchingNetwork}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center justify-center gap-2"
              >
                {switchingNetwork && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Verify BSC Network</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-slate-400 text-sm">No wallet connected. Connect your MetaMask wallet to start mining on Binance Smart Chain.</p>
            <button
              onClick={onConnectWallet}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition"
            >
              Connect MetaMask Now
            </button>
          </div>
        )}
      </div>

      {/* Mined Yield & Balance Overview */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Mined Yield & Balance Overview</h3>
            <p className="text-xs text-slate-400">Track your overall mining yield accumulation, dynamic point balances, and active BNB conversions.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Mined BHFT Balance</div>
            <div className="text-3xl font-black text-[#F3BA2F] font-mono flex items-baseline gap-1.5">
              {(user.miningBalance || 0).toFixed(2)}
              <span className="text-sm font-bold text-slate-400">BHFT</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Value: ≈ ${((user.miningBalance || 0) * 0.50).toFixed(2)} USD (1 BHFT = 500 PTS = $0.50 USD)
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Equivalent Mined BNB Value</div>
            <div className="text-3xl font-black text-white font-mono flex items-baseline gap-1.5">
              {(((user.miningBalance || 0) * 0.50) / (bnbPrice || 600)).toFixed(6)}
              <span className="text-sm font-bold text-slate-400">BNB</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Live Rate: 1 BNB = ${bnbPrice.toFixed(2)} USD
            </div>
          </div>
        </div>
      </div>

      {/* Quick Swap Widget */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-5 h-5 text-[#F3BA2F]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Protocol Swap</h3>
            <p className="text-xs text-slate-400">
              Instantly swap BEP-20 USDT to BNB to fund your verification fees or miner tier upgrades directly via PancakeSwap.
            </p>
          </div>
        </div>

        {walletAddress ? (
          <div className="space-y-4">
            {/* From USDT */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>From (USDT BEP-20)</span>
                <span className="font-mono">Balance: <strong className="text-white">{usdtBalance} USDT</strong></span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={usdtInput}
                  onChange={(e) => setUsdtInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-5 py-4 font-mono font-bold text-lg text-white focus:outline-none focus:border-amber-500/50 transition-all"
                />
                <div className="absolute right-3 top-3.5 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">USDT</span>
                  <button 
                    onClick={() => setUsdtInput(usdtBalance)} 
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded-lg active:scale-95 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Preset Pills */}
            <div className="flex flex-wrap gap-2">
              {["5", "10", "20", "50"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setUsdtInput(preset)}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all duration-200 active:scale-95 ${
                    usdtInput === preset
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {preset} USDT
                </button>
              ))}
            </div>

            {/* Divider Icon */}
            <div className="flex justify-center -my-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-amber-400 shadow-md">
                <ArrowUpDown className="w-4 h-4" />
              </div>
            </div>

            {/* To BNB */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>To (BNB Native Coin)</span>
                <span className="font-mono">Oracle: 1 BNB = ${bnbPrice.toFixed(2)} USDT</span>
              </div>
              <div className="relative">
                <div className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-5 py-4 font-mono font-bold text-lg text-white flex items-center justify-between">
                  {loadingQuote ? (
                    <span className="text-slate-500 text-sm animate-pulse flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      Estimating quote...
                    </span>
                  ) : (
                    <span>{estimatedBnb}</span>
                  )}
                  <span className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">BNB</span>
                </div>
              </div>
            </div>

            {/* Quote details */}
            {Number(estimatedBnb) > 0 && !loadingQuote && (
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 font-mono space-y-1">
                <div className="flex justify-between">
                  <span>Slippage Tolerance:</span>
                  <span className="text-amber-400 font-semibold">5% (Auto)</span>
                </div>
                <div className="flex justify-between">
                  <span>Routing Path:</span>
                  <span>USDT → WBNB (PancakeSwap V2)</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Rate:</span>
                  <span>1 BNB ≈ {estimatedRate} USDT</span>
                </div>
              </div>
            )}

            {/* Success and Error Indicators */}
            {swapSuccessHash && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  Swap Complete!
                </div>
                <p>USDT swapped to BNB successfully. Your wallet balance has been updated.</p>
                <a
                  href={`https://bscscan.com/tx/${swapSuccessHash}`}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="inline-flex items-center gap-1 text-amber-400 hover:underline font-semibold"
                >
                  View on BscScan
                  <Globe className="w-3 h-3" />
                </a>
              </div>
            )}

            {swapError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-red-400 shrink-0" />
                  Swap Interrupted
                </div>
                <p className="font-mono text-[11px] break-words">{swapError}</p>
              </div>
            )}

            {/* Action Swap Button */}
            <button
              onClick={handleSwap}
              disabled={swapping || loadingQuote || !usdtInput || Number(usdtInput) <= 0}
              className={`w-full py-4 rounded-2xl font-bold text-sm border flex items-center justify-center gap-2.5 transition active:scale-[0.98] ${
                swapping
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20 cursor-wait"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border-transparent shadow-lg shadow-amber-500/15"
              }`}
            >
              {swapping ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Approving & Swapping USDT...</span>
                </>
              ) : (
                <>
                  <ArrowUpDown className="w-4 h-4" />
                  <span>Execute PancakeSwap Swap</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-950/40 rounded-2xl border border-white/5 space-y-3">
            <p className="text-slate-400 text-xs">Connect your MetaMask Web3 wallet to authorize live token swaps directly on the BSC network.</p>
            <button
              onClick={onConnectWallet}
              className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition active:scale-95"
            >
              Connect Wallet to Swap
            </button>
          </div>
        )}
      </div>

      {/* Push Notifications Configuration */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              notificationState === 'granted' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                : 'bg-slate-950/60 text-slate-400 border-white/10'
            }`}>
              {notificationState === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Browser Push Notifications
                {notificationState === 'granted' && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ACTIVE
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Stay updated with real-time browser alerts when your mining cycle finishes or when your miner levels up.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNotifications}
            disabled={notificationState === 'unsupported'}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 ${
              notificationState === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
                : notificationState === 'unsupported'
                ? 'bg-slate-950/40 text-slate-600 border-white/5 cursor-not-allowed'
                : 'bg-[#F3BA2F] hover:bg-[#e2ad23] text-black border-transparent shadow-lg shadow-[#F3BA2F]/10 active:scale-95'
            }`}
          >
            {notificationState === 'granted' ? (
              <span>Notifications Enabled</span>
            ) : notificationState === 'denied' ? (
              <span>Permission Blocked</span>
            ) : notificationState === 'unsupported' ? (
              <span>Unsupported Browser</span>
            ) : (
              <span>Enable Browser Alerts</span>
            )}
          </button>
        </div>

        {notificationState === 'denied' && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-red-400 shrink-0" />
            <span>It looks like notification permissions are blocked. Please click the lock or settings icon next to the URL in your browser address bar to allow notifications for this application.</span>
          </div>
        )}
      </div>

      {/* Account Details */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Miner Credentials & Authentication</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage your authenticated miner account or switch profile credentials.</p>
          </div>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Switch / Sign In to Account</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Primary On-Chain ID</div>
            <div className="font-mono text-white break-all">{user.walletAddress || 'Not Authenticated'}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Account Created</div>
            <div className="font-mono text-white">{new Date(user.createdAt).toLocaleDateString()}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Consecutive Login Streak</span>
            </div>
            <div className="font-mono text-[#F3BA2F] font-bold text-base">
              {user.loginStreak || 0} Day{(user.loginStreak || 0) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00C087]" />
              <span>Total Streak Bonus Claimed</span>
            </div>
            <div className="font-mono text-[#00C087] font-bold text-base">
              +{(user.totalStreakPointsClaimed || 0).toLocaleString()} BHFT
            </div>
          </div>
        </div>
      </div>

      {/* Achievements & Badges */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Medal className="w-5 h-5 text-[#F3BA2F]" />
          <h3 className="text-lg font-bold text-white">Achievements & Badges</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {ACHIEVEMENTS_DATA.map((achievement) => {
            const isUnlocked = unlockedAchievements.includes(achievement.id);
            return (
              <div 
                key={achievement.id} 
                className={`relative p-5 rounded-2xl border transition-all duration-300 ${
                  isUnlocked 
                    ? `bg-white/5 border-white/20 hover:border-white/40 shadow-lg` 
                    : `bg-slate-950/60 border-white/5 opacity-60 grayscale`
                }`}
              >
                {!isUnlocked && (
                  <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    Locked
                  </div>
                )}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 border ${
                  isUnlocked ? achievement.color : 'bg-slate-800 border-slate-700 text-slate-600'
                }`}>
                  {achievement.icon}
                </div>
                <h4 className={`font-bold text-sm mb-1 ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
                  {achievement.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {achievement.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
