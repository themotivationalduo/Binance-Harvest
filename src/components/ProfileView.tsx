import React, { useEffect, useState } from 'react';
import { UserProfile, TransactionRecord } from '../types';
import { 
  CreditCard,
  ArrowDown, 
  ArrowUp, 
  Send, 
  Users, 
  History, 
  ChevronRight, 
  BarChart2, 
  Copy, 
  CheckCircle2, 
  ExternalLink, 
  PlusCircle, 
  RefreshCw, 
  Wallet, 
  X, 
  Shield, 
  Globe, 
  Coins, 
  Flame, 
  Sparkles, 
  Bell, 
  BellOff, 
  Info, 
  ArrowUpDown, 
  Check,
  Award,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronLeft,
  AlertTriangle,
  Contrast,
  Moon,
  Sun,
  Eye
} from 'lucide-react';
import { 
  getStoredTheme, 
  applyTheme, 
  AppTheme 
} from '../utils/theme';
import { 
  switchToBSC, 
  TREASURY_WALLET, 
  getUSDTBalance, 
  getSwapQuote, 
  executeUSDTtoBNBSwap, 
  BHFT_TOKEN_ADDRESS, 
  BHFT_TOKEN_NAME, 
  BHFT_TOKEN_SYMBOL, 
  BHFT_TOKEN_DECIMALS, 
  BHFT_TOTAL_SUPPLY,
  addBHFTToWallet,
  sendNativeBNB,
  transferBEP20Token,
  getOrInitSigner,
  getActiveBrowserProvider
} from '../services/web3';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { getTransactionHistory, addTransactionRecord } from '../services/firebase';
import { ACHIEVEMENTS_DATA, evaluateAchievements } from '../lib/achievements';
import { ethers } from 'ethers';
import { 
  requestNotificationPermission, 
  isNotificationSupported, 
  hasNotificationPermission, 
  sendPushNotification 
} from '../services/notifications';
import { AppLogo } from './AppLogo';
import { parseWeb3Error } from '../utils/errorParser';

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
  // Feedback context
  const { showSuccess, showFailed, showCopySuccess } = useInitiativeFeedback();

  // Modals state
  const [activeModal, setActiveModal] = useState<'none' | 'receive' | 'send' | 'transfer' | 'p2p' | 'history' | 'withdraw' | 'settings'>('none');
  const [receiveStep, setReceiveStep] = useState<'options' | 'bnb' | 'bhft'>('options');
  const [selectedTokenDetail, setSelectedTokenDetail] = useState<'none' | 'BHFT' | 'BNB' | 'USDT'>('none');

  // Copy states
  const [addressCopied, setAddressCopied] = useState(false);
  const [contractCopied, setContractCopied] = useState(false);
  const [addingToken, setAddingToken] = useState(false);

  // Balances
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  // Send state
  const [sendAsset, setSendAsset] = useState<'BHFT' | 'BNB'>('BNB');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);

  // Live BSC Gas Fee Estimation
  const [estimatedGasFeeBNB, setEstimatedGasFeeBNB] = useState("0.000063");
  const [gasFeeUSD, setGasFeeUSD] = useState("0.04");

  // Quick Swap / Transfer state
  const [usdtInput, setUsdtInput] = useState("20");
  const [estimatedBnb, setEstimatedBnb] = useState("0.000000");
  const [estimatedRate, setEstimatedRate] = useState("0.00");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapSuccessHash, setSwapSuccessHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Transactions & Withdrawals history state
  const [txList, setTxList] = useState<TransactionRecord[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // P2P Desk State
  const [p2pTab, setP2pTab] = useState<'buy' | 'sell'>('buy');

  // Achievements & Notifications
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [notificationState, setNotificationState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [switchingNetwork, setSwitchingNetwork] = useState(false);

  // Theme & Readability mode
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.theme) {
        setTheme(e.detail.theme);
      }
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  const handleToggleTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    showSuccess({
      initiativeName: 'Display Preferences',
      title: newTheme === 'high-contrast' ? 'High-Contrast Mode Activated' : 'Default Dark Mode Activated',
      badge: newTheme === 'high-contrast' ? 'WCAG AAA' : 'Stealth Glass',
      description: newTheme === 'high-contrast'
        ? 'High-contrast typography, bold solid borders, and enhanced readability activated.'
        : 'Restored default Binance dark stealth theme.',
    });
  };

  // Derived Balance calculations
  const bhftBalance = user.miningBalance || 0;
  const bhftUsdValue = bhftBalance * 0.50; // Peg 1 BHFT = 0.50 USDT
  const bnbAmount = Number(walletBalance || 0);
  const bnbUsdValue = bnbAmount * (bnbPrice || 600); // BNB in USDT equivalent
  const usdtAmount = Number(usdtBalance || 0);
  
  // Total equivalent calculations in USDT (1 BHFT = 0.50 USDT, 1 USDT = 2 BHFT)
  const computedTotalUSDT = bhftUsdValue + bnbUsdValue + usdtAmount;
  // Total assets in BHFT
  const computedTotalBHFT = computedTotalUSDT > 0 
    ? (computedTotalUSDT / 0.50) 
    : (bhftBalance > 0 ? bhftBalance : 12.12);

  const displayTotalBHFT = computedTotalBHFT.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  const displayTotalUSDT = (computedTotalUSDT > 0 ? computedTotalUSDT : 6.06).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  // Synchronize USDT balance
  const fetchBalances = async () => {
    if (!walletAddress) return;
    try {
      setRefreshingBalances(true);
      const usdt = await getUSDTBalance(walletAddress);
      setUsdtBalance(usdt);
    } catch (e) {
      console.warn("Error fetching USDT balance:", e);
    } finally {
      setRefreshingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [walletAddress]);

  // Live BSC Gas Fee Estimation
  useEffect(() => {
    const fetchGasFee = async () => {
      try {
        const provider = getActiveBrowserProvider();
        if (provider) {
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice || ethers.parseUnits("3", "gwei");
          const gasLimit = 21000n; // Standard BNB transfer
          const gasCostWei = gasLimit * gasPrice;
          const gasCostBNB = ethers.formatEther(gasCostWei);
          const numBNB = parseFloat(gasCostBNB);
          setEstimatedGasFeeBNB(numBNB.toFixed(6));
          setGasFeeUSD((numBNB * (bnbPrice || 600)).toFixed(2));
        }
      } catch (e) {
        setEstimatedGasFeeBNB("0.000063");
        setGasFeeUSD((0.000063 * (bnbPrice || 600)).toFixed(2));
      }
    };
    fetchGasFee();
  }, [bnbPrice, walletAddress]);

  // Address validation helpers
  const isAddressValid = sendRecipient.trim().length > 0 && ethers.isAddress(sendRecipient.trim());
  const isAddressSelf = isAddressValid && walletAddress && sendRecipient.trim().toLowerCase() === walletAddress.toLowerCase();

  // Load Transactions
  const fetchTxs = async () => {
    if (!user.walletAddress) return;
    try {
      setLoadingTx(true);
      const records = await getTransactionHistory(user.walletAddress);
      setTxList(records);
    } catch (err) {
      console.error("Error loading tx history:", err);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    fetchTxs();
  }, [user.walletAddress]);

  // Achievements evaluation
  useEffect(() => {
    if (user.walletAddress) {
      const unlocked = evaluateAchievements(user, txList);
      setUnlockedAchievements(unlocked);
    }
  }, [user, txList]);

  // Notifications status check
  useEffect(() => {
    if (!isNotificationSupported()) {
      setNotificationState('unsupported');
    } else if (hasNotificationPermission()) {
      setNotificationState('granted');
    } else if (Notification.permission === 'denied') {
      setNotificationState('denied');
    } else {
      setNotificationState('default');
    }
  }, []);

  const handleToggleNotifications = async () => {
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
        description: 'You will receive browser alerts when your mining cycle finishes or when your miner reaches a milestone.',
      });
    } else {
      setNotificationState('denied');
      showFailed({
        initiativeName: 'Notification Engine',
        title: 'Permission Denied',
        description: 'Please allow notification permissions in your browser settings.',
      });
    }
  };

  // Switch to BSC
  const handleSwitchNetwork = async () => {
    setSwitchingNetwork(true);
    const success = await switchToBSC();
    setSwitchingNetwork(false);
    if (success) {
      showSuccess({
        initiativeName: 'Network Synchronization',
        title: 'BSC Mainnet Connected',
        badge: 'Chain ID 56',
        description: 'Your wallet is verified on Binance Smart Chain Mainnet.',
      });
    } else {
      showFailed({
        initiativeName: 'Network Synchronization',
        title: 'Network Switch Rejected',
        description: 'Please approve the switch prompt in your Web3 wallet.',
      });
    }
  };

  // Copy helpers
  const handleCopyWalletAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
    showCopySuccess('Wallet Address');
  };

  const handleCopyTokenContract = () => {
    navigator.clipboard.writeText(BHFT_TOKEN_ADDRESS);
    setContractCopied(true);
    setTimeout(() => setContractCopied(false), 2000);
    showCopySuccess('BHFT Contract Address');
  };

  const handleAddTokenToWallet = async () => {
    try {
      setAddingToken(true);
      const added = await addBHFTToWallet();
      if (added) {
        showSuccess({
          initiativeName: 'BEP-20 Asset Integration',
          title: 'BHFT Added to Wallet!',
          badge: 'MetaMask Sync',
          description: 'BinanceHarvest (BHFT) token asset was successfully imported into your Web3 wallet.',
          details: [
            { label: 'Token Name', value: BHFT_TOKEN_NAME },
            { label: 'Symbol', value: BHFT_TOKEN_SYMBOL },
            { label: 'Contract', value: `${BHFT_TOKEN_ADDRESS.substring(0, 8)}...` },
          ],
        });
      }
    } catch (e: any) {
      showFailed({
        initiativeName: 'BEP-20 Asset Integration',
        title: 'Wallet Asset Import',
        description: e?.message || 'Failed to import token. You can copy the address manually.',
      });
    } finally {
      setAddingToken(false);
    }
  };

  // Quote calculation for PancakeSwap quick swap
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
        console.error("Quote error:", err);
      } finally {
        setLoadingQuote(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchQuote();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [usdtInput, bnbPrice]);

  // Handle PancakeSwap execute swap
  const handleExecuteSwap = async () => {
    setSwapError(null);
    setSwapSuccessHash(null);
    if (!walletAddress) {
      const err = "Please connect your Web3 wallet first.";
      setSwapError(err);
      showFailed({
        initiativeName: 'PancakeSwap Router',
        title: 'Wallet Connection Required',
        description: 'You must connect your Binance Smart Chain Web3 wallet before swapping tokens.',
        actionLabel: 'Connect Wallet',
        onAction: onConnectWallet,
      });
      return;
    }
    if (!usdtInput || isNaN(Number(usdtInput)) || Number(usdtInput) <= 0) {
      setSwapError("Please enter a valid USDT amount greater than 0.");
      return;
    }
    try {
      setSwapping(true);
      const signer = await getOrInitSigner();
      if (!signer) {
        throw new Error("No active Web3 wallet signer. Please connect via WalletConnect or your browser extension.");
      }
      const txHash = await executeUSDTtoBNBSwap(signer, usdtInput, estimatedBnb);
      setSwapSuccessHash(txHash);
      showSuccess({
        initiativeName: 'PancakeSwap Router',
        title: 'Token Swap Executed!',
        badge: 'USDT → BNB',
        description: `Successfully swapped ${usdtInput} USDT to BNB on Binance Smart Chain.`,
        txHash: txHash,
        details: [
          { label: 'Amount In', value: `${usdtInput} USDT (BEP-20)` },
          { label: 'Estimated Received', value: `≈ ${estimatedBnb} BNB` },
          { label: 'Router', value: 'PancakeSwap v2' },
        ],
      });
      fetchBalances();
    } catch (err: any) {
      console.error("PancakeSwap execution failure:", err);
      const parsed = parseWeb3Error(err);
      setSwapError(parsed.message);

      showFailed({
        initiativeName: 'PancakeSwap Router',
        title: parsed.title,
        badge: 'Swap Failed',
        description: parsed.message,
        requirements: parsed.requirements,
        rawDetails: parsed.rawDetails,
        actionLabel: parsed.actionLabel,
        onAction: parsed.suggestedAction === 'switch_network' ? async () => {
          await switchToBSC();
          fetchBalances();
        } : undefined,
      });
    } finally {
      setSwapping(false);
    }
  };

  // Handle Send action
  const handleExecuteSend = async () => {
    setSendError(null);
    setSendTxHash(null);
    if (!walletAddress) {
      const err = "Please connect your Web3 wallet first.";
      setSendError(err);
      showFailed({
        initiativeName: 'On-Chain Transfer',
        title: 'Wallet Connection Required',
        description: 'You must connect your Binance Smart Chain Web3 wallet before transferring assets.',
        actionLabel: 'Connect Wallet',
        onAction: onConnectWallet,
      });
      return;
    }
    if (!sendRecipient || !ethers.isAddress(sendRecipient)) {
      setSendError("Please provide a valid 0x recipient Binance Smart Chain address.");
      return;
    }
    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setSendError("Please enter a valid transfer amount greater than 0.");
      return;
    }

    try {
      setIsSending(true);
      const signer = await getOrInitSigner();
      if (!signer) {
        throw new Error("No active Web3 wallet signer. Please connect via WalletConnect or your browser extension.");
      }

      let hash = "";
      if (sendAsset === 'BNB') {
        hash = await sendNativeBNB(signer, sendRecipient, sendAmount);
      } else {
        hash = await transferBEP20Token(signer, BHFT_TOKEN_ADDRESS, sendRecipient, sendAmount);
      }

      setSendTxHash(hash);
      await addTransactionRecord(walletAddress, {
        txHash: hash,
        type: 'WITHDRAW',
        amountBNB: sendAsset === 'BNB' ? Number(sendAmount) : 0,
        amountUSD: sendAsset === 'BNB' ? Number(sendAmount) * bnbPrice : Number(sendAmount) * 0.50,
        status: 'CONFIRMED',
        details: `Sent ${sendAmount} ${sendAsset} to ${sendRecipient.substring(0, 6)}...`
      });

      showSuccess({
        initiativeName: 'On-Chain Transfer',
        title: 'Asset Sent Successfully!',
        badge: `${sendAmount} ${sendAsset}`,
        description: `Transferred ${sendAmount} ${sendAsset} to ${sendRecipient.substring(0, 8)}...`,
        txHash: hash,
      });
      fetchTxs();
      fetchBalances();
    } catch (err: any) {
      console.error("Send error:", err);
      const parsed = parseWeb3Error(err);
      setSendError(parsed.message);

      showFailed({
        initiativeName: 'On-Chain Transfer',
        title: parsed.title,
        badge: `${sendAsset} Transfer Failed`,
        description: parsed.message,
        requirements: parsed.requirements,
        rawDetails: parsed.rawDetails,
        actionLabel: parsed.actionLabel,
        onAction: parsed.suggestedAction === 'switch_network' ? async () => {
          await switchToBSC();
          fetchBalances();
        } : undefined,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl mx-auto px-4 pt-4 sm:pt-6 pb-36 space-y-4">

      {/* ========================================================= */}
      {/* 1. TOP TOTAL BALANCE CARD (Violet Gradient Mirror Glass)    */}
      {/* ========================================================= */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        id="wallet-balance-card"
        className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-[#7A28CB] via-[#5C16C5] to-[#3B1187] border border-white/20 shadow-[0_16px_48px_rgba(122,40,203,0.35)]"
      >
        {/* Specular Mirror Glass Sheen Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/25 to-transparent pointer-events-none rounded-t-[32px]" />
        
        {/* Card Outline Icon in Frosted Capsule */}
        <div className="relative z-10 w-13 h-9 sm:w-14 sm:h-9.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mb-3 shadow-inner">
          <div className="w-7 h-4.5 rounded-[5px] border border-white/80 flex items-center justify-between px-1">
            <div className="w-1.5 h-1.5 rounded-xs bg-white/80" />
            <div className="w-2.5 h-0.5 rounded-xs bg-white/60" />
          </div>
        </div>

        {/* Total Assets Label */}
        <div className="relative z-10 text-[11px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-white/70 mb-1">
          TOTAL ASSETS
        </div>

        {/* Big Display Value in BHFT */}
        <div className="relative z-10 text-4xl sm:text-5xl font-black text-white tracking-tight flex items-baseline justify-center gap-2 font-sans">
          <span>{displayTotalBHFT}</span>
          <span className="text-xl sm:text-2xl font-extrabold text-amber-300 tracking-normal">BHFT</span>
        </div>

        {/* Equivalent calculation in USDT */}
        <div className="relative z-10 mt-2.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-semibold text-white/95 font-mono shadow-sm">
          <span className="text-emerald-400 font-bold">≈</span>
          <span>{displayTotalUSDT} USDT</span>
          <span className="text-[11px] text-white/50 font-normal">(@ 0.50 USDT / BHFT)</span>
        </div>

        {/* Sub-label showing breakdown pill */}
        <div className="relative z-10 mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] text-white/80 font-mono flex-wrap justify-center">
          <span>BHFT: {(bhftBalance || 0).toFixed(2)}</span>
          <span className="opacity-40">•</span>
          <span>BNB: ≈ {((bnbUsdValue || 0) / 0.50).toFixed(2)} BHFT</span>
          {usdtAmount > 0 && (
            <>
              <span className="opacity-40">•</span>
              <span>USDT: ≈ {(usdtAmount / 0.50).toFixed(2)} BHFT</span>
            </>
          )}
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 2. ACTION ICONS CONTAINER (Receive, Send, Transfer, P2P)   */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-[24px] sm:rounded-[28px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 shadow-xl"
      >
        <div className="grid grid-cols-4 gap-2 text-center">
          
          {/* Action 1: Receive */}
          <button
            onClick={() => {
              setActiveModal('receive');
              setReceiveStep('options');
            }}
            className="group flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#1A1B2E] border border-violet-500/20 group-hover:border-violet-400/60 group-hover:bg-violet-600/30 flex items-center justify-center text-violet-300 group-hover:text-white transition-all shadow-md">
              <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:translate-y-0.5" />
            </div>
            <span className="text-xs text-slate-300 font-medium mt-2">Receive</span>
          </button>

          {/* Action 2: Send */}
          <button
            onClick={() => {
              setActiveModal('send');
              setSendAsset('BNB');
              setSendError(null);
            }}
            className="group flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#1A1B2E] border border-violet-500/20 group-hover:border-violet-400/60 group-hover:bg-violet-600/30 flex items-center justify-center text-violet-300 group-hover:text-white transition-all shadow-md">
              <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:-translate-y-0.5" />
            </div>
            <span className="text-xs text-slate-300 font-medium mt-2">Send</span>
          </button>

          {/* Action 3: Transfer (Quick Swap / OTC) */}
          <button
            onClick={() => setActiveModal('transfer')}
            className="group flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#1A1B2E] border border-violet-500/20 group-hover:border-violet-400/60 group-hover:bg-violet-600/30 flex items-center justify-center text-violet-300 group-hover:text-white transition-all shadow-md">
              <Send className="w-5 h-5 sm:w-5 sm:h-5 -rotate-12 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <span className="text-xs text-slate-300 font-medium mt-2">Transfer</span>
          </button>

          {/* Action 4: P2P */}
          <button
            onClick={() => setActiveModal('p2p')}
            className="group flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#1A1B2E] border border-violet-500/20 group-hover:border-violet-400/60 group-hover:bg-violet-600/30 flex items-center justify-center text-violet-300 group-hover:text-white transition-all shadow-md">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-105" />
            </div>
            <span className="text-xs text-slate-300 font-medium mt-2">P2P</span>
          </button>

        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 3. TRANSACTION HISTORY ROW                                */}
      {/* ========================================================= */}
      <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14 }}
        onClick={() => setActiveModal('history')}
        className="w-full rounded-[22px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between hover:bg-[#1A1B2E] transition-all cursor-pointer shadow-lg active:scale-[0.99] text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <span className="text-base font-bold text-white tracking-wide">Transaction History</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </motion.button>

      {/* ========================================================= */}
      {/* 4. WITHDRAW HISTORY ROW                                   */}
      {/* ========================================================= */}
      <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        onClick={() => setActiveModal('withdraw')}
        className="w-full rounded-[22px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between hover:bg-[#1A1B2E] transition-all cursor-pointer shadow-lg active:scale-[0.99] text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <ArrowUp className="w-5 h-5" />
          </div>
          <span className="text-base font-bold text-white tracking-wide">Withdraw History</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </motion.button>

      {/* ========================================================= */}
      {/* 5. TOKEN MARKET SECTION                                   */}
      {/* ========================================================= */}
      <div className="pt-2 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <BarChart2 className="w-4 h-4 text-slate-400" />
            <span>TOKEN MARKET</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Live BEP-20</span>
        </div>

        {/* BHFT Token Card (Matches the purple 'L' card in screenshot) */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedTokenDetail('BHFT')}
          className="rounded-[22px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between hover:border-violet-500/40 transition-all cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-3.5 overflow-hidden">
            {/* Round Purple Avatar with Letter 'B' / BHFT Icon */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#7828C8] to-[#9353D3] border border-violet-400/40 flex items-center justify-center font-black text-white text-xl shadow-lg shrink-0">
              B
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">BHFT</span>
                <span className="text-[10px] bg-amber-500/20 text-[#F3BA2F] border border-[#F3BA2F]/30 px-1.5 py-0.2 rounded font-mono font-bold">
                  $0.50 PEG
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">BinanceHarvest Token</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-white text-base font-mono">
              {(bhftBalance || 101.00).toFixed(2)} BHFT
            </div>
            <div className="text-xs text-emerald-400/80 font-mono">
              ≈ {((bhftBalance || 101.00) * 0.50).toFixed(2)} USDT
            </div>
          </div>
        </motion.div>

        {/* BNB Native Coin Card */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedTokenDetail('BNB')}
          className="rounded-[22px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between hover:border-amber-500/40 transition-all cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-3.5 overflow-hidden">
            <AppLogo className="w-12 h-12" rounded="rounded-full" />
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">BNB</span>
                <span className="text-[10px] bg-white/10 text-slate-300 border border-white/10 px-1.5 py-0.2 rounded font-mono">
                  GAS
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">Binance Smart Chain Native</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-white text-base font-mono">
              {bnbAmount.toFixed(4)} BNB
            </div>
            <div className="text-xs text-emerald-400/80 font-mono">
              ≈ {bnbUsdValue.toFixed(2)} USDT
            </div>
          </div>
        </motion.div>

        {/* USDT BEP-20 Card */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedTokenDetail('USDT')}
          className="rounded-[22px] bg-[#12131F]/90 backdrop-blur-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between hover:border-emerald-500/40 transition-all cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-3.5 overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#26A17B] to-[#13C296] text-white font-black flex items-center justify-center text-xl shadow-lg shrink-0">
              ₮
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">USDT</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                  BEP-20
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">Tether USD (BSC)</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-white text-base font-mono">
              {usdtAmount.toFixed(2)} USDT
            </div>
            <div className="text-xs text-amber-400/80 font-mono">
              ≈ {(usdtAmount / 0.50).toFixed(2)} BHFT
            </div>
          </div>
        </motion.div>
      </div>

      {/* ========================================================= */}
      {/* 6. THEME SWITCHER & READABILITY PREFERENCES               */}
      {/* ========================================================= */}
      <div className="p-4 rounded-2xl bg-[#12131F]/60 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-[#F3BA2F]">
              <Contrast className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Display Theme</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  theme === 'high-contrast' 
                    ? 'bg-amber-400 text-black shadow-sm' 
                    : 'bg-white/10 text-slate-300 border border-white/15'
                }`}>
                  {theme === 'high-contrast' ? 'HIGH-CONTRAST' : 'DEFAULT DARK'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Switch between stealth dark glass and high-contrast text readability
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Switcher Controls */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => handleToggleTheme('dark')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-white/15 text-white shadow-sm border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-[#F3BA2F]' : ''}`} />
            <span>Default Dark</span>
            {theme === 'dark' && <Check className="w-3 h-3 text-[#F3BA2F] ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleToggleTheme('high-contrast')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              theme === 'high-contrast'
                ? 'bg-[#F3BA2F] text-black shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Contrast className="w-3.5 h-3.5" />
            <span>High Contrast</span>
            {theme === 'high-contrast' && <Check className="w-3 h-3 text-black ml-0.5" />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. ACCOUNT & NETWORK CONTROL BUTTON (Settings Drawer)     */}
      {/* ========================================================= */}
      <div className="pt-2">
        <button
          onClick={() => setActiveModal('settings')}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#12131F]/60 hover:bg-[#12131F]/90 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
            <span>Network, Badges & Account Security</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <span>Configure</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: RECEIVE MODAL                                    */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'receive' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-5 custom-scrollbar"
            >
              {/* STEP 1: OPTIONS (Receive BNB or Receive BHFT) */}
              {receiveStep === 'options' && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                        <ArrowDown className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">Receive Assets</h3>
                        <p className="text-xs text-slate-400">Choose deposit asset</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModal('none')}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Option 1: Receive BNB */}
                    <button
                      onClick={() => setReceiveStep('bnb')}
                      className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/40 flex items-center justify-between transition cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5">
                        <AppLogo className="w-12 h-12" rounded="rounded-full" />
                        <div className="text-left">
                          <div className="font-bold text-white text-base group-hover:text-amber-400 transition">Receive BNB</div>
                          <div className="text-xs text-slate-400">Binance Smart Chain (BEP-20 / Gas)</div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
                    </button>

                    {/* Option 2: Receive BHFT */}
                    <button
                      onClick={() => setReceiveStep('bhft')}
                      className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/40 flex items-center justify-between transition cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#7828C8] to-[#9353D3] text-white font-black flex items-center justify-center text-xl shadow-md shrink-0">
                          B
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base group-hover:text-violet-400 transition">Receive BHFT</span>
                            <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold">
                              Coming Soon
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">BinanceHarvest Token (BEP-20)</div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>
                </>
              )}

              {/* STEP 2: RECEIVE BNB (Shows user's BNB address with 1-click copy) */}
              {receiveStep === 'bnb' && (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setReceiveStep('options')}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-white font-semibold transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <div className="text-center">
                      <h3 className="font-bold text-white text-base">Receive BNB</h3>
                      <p className="text-[11px] text-amber-400 font-mono">Binance Smart Chain (BEP-20)</p>
                    </div>
                    <button
                      onClick={() => setActiveModal('none')}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="p-3 bg-white rounded-2xl shadow-xl">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(walletAddress || '0x0000000000000000000000000000000000000000')}`}
                        alt="BSC Wallet QR Code"
                        className="w-38 h-38 object-contain rounded-lg"
                      />
                    </div>
                    <div className="mt-4 text-center w-full">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                        Your BNB (BSC) Wallet Address
                      </div>
                      <div 
                        onClick={handleCopyWalletAddress}
                        className="font-mono text-xs text-amber-400 break-all bg-black/50 hover:bg-black/70 px-3 py-2.5 rounded-xl border border-white/15 cursor-pointer transition flex items-center justify-between gap-2"
                        title="Click to copy"
                      >
                        <span className="truncate">{walletAddress || '0x0000000000000000000000000000000000000000'}</span>
                        <Copy className="w-4 h-4 shrink-0 text-amber-400" />
                      </div>
                    </div>
                  </div>

                  {/* One-time click copy button */}
                  <button
                    onClick={handleCopyWalletAddress}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
                  >
                    {addressCopied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-black" />
                        <span>Address Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-black" />
                        <span>Copy BNB Address</span>
                      </>
                    )}
                  </button>

                  {/* Security Notice */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>Send only BNB via Binance Smart Chain (BSC / BEP-20) to this address. Sending funds via other networks may result in permanent loss.</span>
                  </div>
                </>
              )}

              {/* STEP 3: RECEIVE BHFT (Friendly Coming Soon Message) */}
              {receiveStep === 'bhft' && (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setReceiveStep('options')}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-white font-semibold transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <div className="text-center">
                      <h3 className="font-bold text-white text-base">Receive BHFT</h3>
                      <p className="text-[11px] text-violet-400 font-mono">BinanceHarvest Token</p>
                    </div>
                    <button
                      onClick={() => setActiveModal('none')}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Centered Purple Badge & Friendly Message */}
                  <div className="flex flex-col items-center text-center py-2 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#7828C8] to-[#9353D3] border-2 border-violet-400/40 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-purple-600/30">
                      B
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">Receive BHFT</h4>
                      <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                        Direct BEP-20 BHFT deposits are currently being finalized for our mainnet smart contract launch.
                      </p>
                      <p className="text-xs text-violet-300 font-medium">
                        This feature will be available soon.
                      </p>
                    </div>
                  </div>

                  {/* Divider & Metadata Rows */}
                  <div className="space-y-2.5 pt-1">
                    <div className="border-t border-white/10" />
                    <div className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-400">Planned launch</span>
                      <span className="text-white font-bold">Coming soon</span>
                    </div>
                    <div className="border-t border-white/10" />
                    <div className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-400">Indicative rate</span>
                      <span className="text-white font-bold font-mono">1 BHFT = 500 Points (0.50 USDT)</span>
                    </div>
                    <div className="border-t border-white/10" />
                  </div>

                  {/* Action to import token in advance */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleCopyTokenContract}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {contractCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                      <span>{contractCopied ? 'Copied' : 'Copy Contract'}</span>
                    </button>
                    <button
                      onClick={handleAddTokenToWallet}
                      disabled={addingToken}
                      className="py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-violet-600/30 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>{addingToken ? 'Adding...' : 'Add to MetaMask'}</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: SEND MODAL (Direct on-chain BSC transfer)         */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'send' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-5 custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                    <ArrowUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Send Crypto Asset</h3>
                    <p className="text-xs text-slate-400">Direct on-chain BSC transfer</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Asset Selector */}
              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-semibold">Select Token</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSendAsset('BNB');
                      setSendError(null);
                    }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                      sendAsset === 'BNB'
                        ? 'bg-amber-500/30 border-amber-400 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                    <span>BNB (Native Gas)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSendAsset('BHFT');
                      setSendError(null);
                    }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                      sendAsset === 'BHFT'
                        ? 'bg-violet-600/30 border-violet-400 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" />
                    <span>BHFT (BEP-20)</span>
                  </button>
                </div>
              </div>

              {/* BHFT CHOSEN -> FRIENDLY COMING SOON VIEW */}
              {sendAsset === 'BHFT' ? (
                <div className="space-y-4 py-2">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-[#7828C8] to-[#9353D3] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-purple-600/30">
                      B
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">BHFT Transfers</h4>
                      <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                        Direct on-chain BHFT token transfers are being finalized. Currently, you can transfer native BNB on Binance Smart Chain.
                      </p>
                      <p className="text-xs text-violet-300 font-medium">
                        This feature will be available soon.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="border-t border-white/10" />
                    <div className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-400">Planned launch</span>
                      <span className="text-white font-bold">Coming soon</span>
                    </div>
                    <div className="border-t border-white/10" />
                    <div className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-400">Indicative rate</span>
                      <span className="text-white font-bold font-mono">1 BHFT = 500 Points (0.50 USDT)</span>
                    </div>
                    <div className="border-t border-white/10" />
                  </div>

                  <button
                    onClick={() => {
                      setSendAsset('BNB');
                      setSendError(null);
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-black font-extrabold text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    Switch to BNB Transfer
                  </button>
                </div>
              ) : (
                /* BNB CHOSEN -> DIRECT ON-CHAIN TRANSFER WITH LIVE GAS & VALIDATION */
                <div className="space-y-4">
                  {/* Recipient Input with Live Validation Feedback */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                      <span>Recipient Address (BSC)</span>
                      {sendRecipient.trim().length > 0 && (
                        <span>
                          {isAddressSelf ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Own Wallet
                            </span>
                          ) : isAddressValid ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Valid BSC Address
                            </span>
                          ) : (
                            <span className="text-red-400 font-semibold">Invalid BSC Address</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={sendRecipient}
                        onChange={(e) => setSendRecipient(e.target.value)}
                        placeholder="0x..."
                        className={`w-full bg-slate-950/70 border rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition ${
                          sendRecipient.trim().length === 0
                            ? 'border-white/15 focus:border-violet-500'
                            : isAddressValid
                            ? 'border-emerald-500/50 focus:border-emerald-400'
                            : 'border-red-500/50 focus:border-red-400'
                        }`}
                      />
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setSendRecipient(text);
                          } catch {}
                        }}
                        className="absolute right-2 top-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-violet-300 transition cursor-pointer"
                      >
                        PASTE
                      </button>
                    </div>
                    {sendRecipient.trim().length > 0 && !isAddressValid && (
                      <p className="text-[11px] text-red-400">
                        Please enter a valid 42-character 0x Binance Smart Chain address.
                      </p>
                    )}
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                      <span>Transfer Amount</span>
                      <span className="font-mono">
                        Avail: {bnbAmount.toFixed(4)} BNB (≈ ${(bnbAmount * (bnbPrice || 600)).toFixed(2)})
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-950/70 border border-white/15 rounded-xl px-4 py-3 font-mono font-bold text-base text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg font-mono">BNB</span>
                        <button
                          onClick={() => {
                            const maxBnb = Math.max(0, bnbAmount - Number(estimatedGasFeeBNB) - 0.0001);
                            setSendAmount(maxBnb > 0 ? maxBnb.toFixed(4) : "0");
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition cursor-pointer"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Live Gas Estimation Card */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Live BSC Gas Fee:</span>
                      <span className="text-white font-bold">~{estimatedGasFeeBNB} BNB</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Gas in USD (@ ${bnbPrice.toFixed(2)}):</span>
                      <span>≈ ${gasFeeUSD} USD</span>
                    </div>
                    <div className="border-t border-white/10 pt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold">Max Total:</span>
                      <span className="text-amber-400 font-bold">
                        ≈ {(Number(sendAmount || 0) + Number(estimatedGasFeeBNB)).toFixed(4)} BNB
                      </span>
                    </div>
                  </div>

                  {/* Error & Success indicators */}
                  {sendError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                      {sendError}
                    </div>
                  )}
                  {sendTxHash && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Transfer Confirmed!
                      </div>
                      <a
                        href={`https://bscscan.com/tx/${sendTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 underline font-mono text-[11px] block truncate"
                      >
                        Tx: {sendTxHash}
                      </a>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleExecuteSend}
                    disabled={isSending || !sendAmount || Number(sendAmount) <= 0 || !isAddressValid}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-sm shadow-xl shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Broadcasting to BSC Mainnet...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-black" />
                        <span>Send BNB Now</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: TRANSFER / SWAP MODAL (PancakeSwap Engine)       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'transfer' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-5 custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                    <Send className="w-5 h-5 -rotate-12" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Instant Protocol Transfer</h3>
                    <p className="text-xs text-slate-400">PancakeSwap Liquidity Router V2</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* From USDT */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>From: USDT (BEP-20)</span>
                    <span className="font-mono">Balance: {usdtBalance} USDT</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={usdtInput}
                      onChange={(e) => setUsdtInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950/70 border border-white/15 rounded-xl px-4 py-3 font-mono font-bold text-base text-white focus:outline-none focus:border-violet-500 transition"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg">USDT</span>
                      <button
                        onClick={() => setUsdtInput(usdtBalance)}
                        className="px-2 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-[10px] font-bold"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>

                {/* Arrow Divider */}
                <div className="flex justify-center -my-1">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/15 flex items-center justify-center text-violet-400">
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </div>

                {/* To BNB */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>To: BNB (Native)</span>
                    <span className="font-mono">1 BNB ≈ ${bnbPrice.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-slate-950/70 border border-white/15 rounded-xl px-4 py-3 font-mono font-bold text-base text-white flex items-center justify-between">
                    {loadingQuote ? (
                      <span className="text-slate-500 text-xs animate-pulse">Calculating quote...</span>
                    ) : (
                      <span>{estimatedBnb}</span>
                    )}
                    <span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg">BNB</span>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2">
                {["5", "10", "20", "50"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setUsdtInput(preset)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                      usdtInput === preset
                        ? 'bg-violet-600/30 border-violet-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              {swapError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{swapError}</span>
                  </div>
                  {(swapError.includes("wrong network") || swapError.includes("Binance Smart Chain") || swapError.includes("NETWORK_MISMATCH")) && (
                    <button
                      onClick={async () => {
                        await switchToBSC();
                        fetchBalances();
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Switch Wallet to BSC Mainnet (Chain 56)</span>
                    </button>
                  )}
                </div>
              )}

              {swapSuccessHash && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  Swap Complete! Hash: {swapSuccessHash.substring(0, 12)}...
                </div>
              )}

              <button
                onClick={handleExecuteSwap}
                disabled={swapping || loadingQuote || !usdtInput || Number(usdtInput) <= 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-violet-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {swapping ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing PancakeSwap Swap...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpDown className="w-4 h-4" />
                    <span>Swap USDT to BNB</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: P2P TRADING (Matches Uploaded Screenshot)       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'p2p' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-5 custom-scrollbar"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-xl tracking-tight">P2P Trading</h3>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Center Icon & Description */}
              <div className="flex flex-col items-center text-center py-2 space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#6C22D6] flex items-center justify-center text-white shadow-xl shadow-purple-600/30">
                  <Users className="w-9 h-9 text-white" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-300 font-medium">
                    Buy and sell BHFT directly with other users.
                  </p>
                  <p className="text-sm text-slate-400">
                    This feature is being finalized.
                  </p>
                </div>
              </div>

              {/* Divider & Metadata Rows matching screenshot */}
              <div className="space-y-3 pt-1">
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-slate-400">Planned launch</span>
                  <span className="text-white font-bold">Coming soon</span>
                </div>
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-slate-400">Indicative rate</span>
                  <span className="text-white font-bold font-mono">2 BHFT / USDT</span>
                </div>
                <div className="border-t border-white/10" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 5: TRANSACTION HISTORY MODAL                        */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'history' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] flex flex-col rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-4"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Transaction History</h3>
                    <p className="text-xs text-slate-400">Audit logs on Binance Smart Chain</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {loadingTx ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                    <span>Loading ledger records...</span>
                  </div>
                ) : txList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No transactions recorded yet. Start mining or claim daily streaks to populate records.
                  </div>
                ) : (
                  txList.map((tx, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">{tx.type}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">CONFIRMED</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{tx.details || "On-Chain Interaction"}</div>
                        <div className="text-[10px] text-slate-500">{new Date(tx.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-amber-400 font-mono">+{tx.amountBNB} {tx.type === 'UPGRADE' ? 'BNB' : 'BHFT'}</div>
                        {tx.txHash && (
                          <a
                            href={`https://bscscan.com/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-violet-300 hover:underline"
                          >
                            <span>BscScan</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 6: WITHDRAW HISTORY MODAL                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'withdraw' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] flex flex-col rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-4"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                    <ArrowUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Withdraw History</h3>
                    <p className="text-xs text-slate-400">Settlement batch records</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status summary */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Account Settlement Status</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${
                    user.isVerified || user.withdrawalStatus === 'APPROVED' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {user.isVerified || user.withdrawalStatus === 'APPROVED' ? 'VERIFIED • COMING SOON' :
                     user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? 'PENDING APPROVAL' :
                     (user.withdrawalStatus || 'NOT_STARTED')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">BHFT Withdrawals</span>
                  <span className="text-violet-300 font-bold">Coming Soon (Mainnet Launch)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Min. Threshold</span>
                  <span className="text-white font-bold">100.00 BHFT (≈ 50.00 USDT)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Accumulated Mined</span>
                  <span className="text-amber-400 font-bold">{(user.miningBalance || 0).toFixed(2)} BHFT</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">Daily Mining Settlement Pool</span>
                    <span className="text-purple-400 font-mono text-[10px]">COMING SOON</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Direct BEP-20 BHFT batch distributions will launch on mainnet</div>
                  <div className="text-[10px] text-slate-500 font-mono">Target: {walletAddress ? `${walletAddress.substring(0, 10)}...` : 'Connected Wallet'}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">Protocol Verification (KYC)</span>
                    <span className={`font-mono text-[10px] ${user.isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {user.isVerified ? 'VERIFIED & WHITELISTED' : 'PENDING'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{user.isVerified ? '$20.00 protocol verification completed on BSC' : 'Pending verification payment on Dashboard'}</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 7: TOKEN DETAIL DRAWER                              */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedTokenDetail !== 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-4 custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600/30 border border-violet-400/40 flex items-center justify-center font-bold text-white">
                    {selectedTokenDetail[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{selectedTokenDetail} Overview</h3>
                    <p className="text-xs text-slate-400">Binance Smart Chain (BEP-20)</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTokenDetail('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedTokenDetail === 'BHFT' ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contract Address:</span>
                      <span className="text-amber-400 font-bold truncate max-w-[180px]">{BHFT_TOKEN_ADDRESS}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Decimals:</span>
                      <span className="text-white">{BHFT_TOKEN_DECIMALS}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Supply:</span>
                      <span className="text-emerald-400 font-bold">{BHFT_TOTAL_SUPPLY} BHFT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pegged Value:</span>
                      <span className="text-white">1 BHFT = 500 PTS = 0.50 USDT</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyTokenContract}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      {contractCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                      <span>{contractCopied ? 'Copied' : 'Copy Contract'}</span>
                    </button>
                    <a
                      href={`https://bscscan.com/token/${BHFT_TOKEN_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <ExternalLink className="w-4 h-4 text-amber-400" />
                      <span>BscScan</span>
                    </a>
                  </div>

                  <button
                    onClick={handleAddTokenToWallet}
                    disabled={addingToken}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-violet-600/30"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{addingToken ? 'Adding...' : 'Import to MetaMask'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Network:</span>
                      <span className="text-white">Binance Smart Chain (Chain ID: 56)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Oracle Price:</span>
                      <span className="text-emerald-400 font-bold">{selectedTokenDetail === 'BNB' ? `${bnbPrice.toFixed(2)} USDT` : '1.00 USDT'}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 8: SETTINGS & ACCOUNT SECURITY                      */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activeModal === 'settings' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] bg-[#12131F]/95 backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-4 custom-scrollbar"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Account & Security</h3>
                    <p className="text-xs text-slate-400">Configuration and preferences</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Wallet Info */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="text-xs text-slate-400">Connected Wallet Address</div>
                <div className="font-mono text-xs text-white break-all">{walletAddress || 'Not Connected'}</div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSwitchNetwork}
                    disabled={switchingNetwork}
                    className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center justify-center gap-1.5 transition"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{switchingNetwork ? 'Checking...' : 'Verify BSC Mainnet'}</span>
                  </button>
                  <button
                    onClick={onDisconnectWallet}
                    className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Push Notifications */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {notificationState === 'granted' ? <Bell className="w-5 h-5 text-emerald-400" /> : <BellOff className="w-5 h-5 text-slate-500" />}
                  <div>
                    <div className="text-xs font-bold text-white">Browser Notifications</div>
                    <div className="text-[10px] text-slate-400">Mining finish & level up alerts</div>
                  </div>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  disabled={notificationState === 'unsupported'}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                >
                  {notificationState === 'granted' ? 'Enabled' : 'Enable'}
                </button>
              </div>

              {/* Theme & Display Contrast Switcher */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Contrast className="w-4 h-4 text-[#F3BA2F]" />
                    <div>
                      <div className="text-xs font-bold text-white">Display Theme</div>
                      <div className="text-[10px] text-slate-400">Toggle high-contrast for easier reading</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                    theme === 'high-contrast' ? 'bg-[#F3BA2F] text-black' : 'bg-white/10 text-slate-300'
                  }`}>
                    {theme === 'high-contrast' ? 'High Contrast' : 'Default Dark'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTheme('dark')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Default Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTheme('high-contrast')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      theme === 'high-contrast'
                        ? 'bg-[#F3BA2F] border-[#F3BA2F] text-black font-extrabold'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Contrast className="w-3.5 h-3.5" />
                    <span>High Contrast</span>
                  </button>
                </div>
              </div>

              {/* Achievements */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Unlocked Achievements ({unlockedAchievements.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ACHIEVEMENTS_DATA.slice(0, 4).map((a) => {
                    const isUnlocked = unlockedAchievements.includes(a.id);
                    return (
                      <div key={a.id} className={`p-2.5 rounded-xl border text-xs ${isUnlocked ? 'bg-white/5 border-white/20 text-white' : 'bg-black/20 border-white/5 text-slate-500'}`}>
                        <div className="text-base mb-1">{a.icon}</div>
                        <div className="font-bold truncate">{a.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {onOpenAuth && (
                <button
                  onClick={() => {
                    setActiveModal('none');
                    onOpenAuth();
                  }}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition"
                >
                  Switch / Sign In to Account
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
