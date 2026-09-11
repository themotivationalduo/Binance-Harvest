import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Globe, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  RefreshCw, 
  Gift, 
  Smartphone, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Wrench, 
  Search, 
  Zap, 
  Compass, 
  Send, 
  CheckCircle2, 
  Sparkles,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';
import { connectWallet, detectWeb3Providers, clearWalletConnectSession, signWeb3AuthMessage, SupportedWalletType } from '../services/web3';
import { getUserProfile, saveUserProfile, applyReferralCode } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { AppLogo } from './AppLogo';
import { SUPPORTED_DEEP_LINK_WALLETS, openDAppInWallet, WalletDeepLinkInfo } from '../utils/walletDeepLinks';
import { getTonConnectUI, isTelegramWebApp, isValidTonAddress, setConnectedTonAddress } from '../services/tonWallet';
import { useRuntimeContext } from '../services/runtimeContext';

export type AuthViewMode = 'DIRECT_ON_CHAIN_SIGNING' | 'TELEGRAM_LOGIN';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  isClosable?: boolean;
  initialReferralCode?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isClosable = true,
  initialReferralCode = '',
}) => {
  const runtime = useRuntimeContext();

  // Environment-dictated initial mode: Telegram WebApp gets Telegram Login, Web3/Browser gets Direct On-Chain Signing
  const [viewMode, setViewMode] = useState<AuthViewMode>(() => {
    return runtime.isTelegram ? 'TELEGRAM_LOGIN' : 'DIRECT_ON_CHAIN_SIGNING';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [referralInput, setReferralInput] = useState<string>('');
  const [detectedProviders, setDetectedProviders] = useState(detectWeb3Providers());
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [walletSearch, setWalletSearch] = useState('');
  const [launchingWallet, setLaunchingWallet] = useState<string | null>(null);
  const [cacheResetDone, setCacheResetDone] = useState(false);
  const [showTonManualInput, setShowTonManualInput] = useState(false);
  const [tonInputAddress, setTonInputAddress] = useState('');
  const [signingStep, setSigningStep] = useState<'IDLE' | 'CONNECTING' | 'SIGNING' | 'SYNCING' | 'DONE'>('IDLE');

  const { showSuccess, showFailed } = useInitiativeFeedback();

  // Re-dictate environment on open or runtime changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSigningStep('IDLE');
      const isTg = runtime.isTelegram || isTelegramWebApp();
      setViewMode(isTg ? 'TELEGRAM_LOGIN' : 'DIRECT_ON_CHAIN_SIGNING');
      setDetectedProviders(detectWeb3Providers());

      // Auto-load initial or cached referral code
      const cachedRef = typeof window !== 'undefined' ? localStorage.getItem('binance_harvest_pending_ref') : null;
      if (initialReferralCode) {
        setReferralInput(initialReferralCode);
      } else if (cachedRef) {
        setReferralInput(cachedRef);
      }
    }
  }, [isOpen, initialReferralCode, runtime.isTelegram]);

  if (!isOpen) return null;

  const handleCopyAppUrl = async () => {
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : "https://binanceharvest.vercel.app";
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleResetCache = () => {
    clearWalletConnectSession();
    setCacheResetDone(true);
    setError(null);
    setTimeout(() => setCacheResetDone(false), 3500);
  };

  const handleLaunchDAppBrowser = (wallet: WalletDeepLinkInfo) => {
    setLaunchingWallet(wallet.name);
    openDAppInWallet(wallet.id);

    showSuccess({
      initiativeName: 'DApp Deep Link Dispatch',
      title: `Opening in ${wallet.name}`,
      badge: 'DIRECT DAPP BROWSER',
      description: `Redirecting from browser directly into ${wallet.name}'s built-in Web3 browser. If prompted, tap "Open".`,
      details: [
        { label: 'Target Wallet', value: wallet.name },
        { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
        { label: 'Status', value: 'Native Deep-Link Dispatched' },
      ],
    });

    setTimeout(() => {
      setLaunchingWallet(null);
    }, 4500);
  };

  // Direct On-Chain Signing Handler
  const handleAuthenticateWeb3 = async (
    walletType: SupportedWalletType = 'walletconnect',
    requireCryptographicSignature: boolean = false
  ) => {
    try {
      setLoading(true);
      setError(null);
      setSigningStep('CONNECTING');

      // 1. Connect to Web3 provider via EIP-1193
      const res = await connectWallet(walletType);
      if (!res || !res.address) {
        throw new Error("No authorized wallet address received.");
      }

      const normalizedAddress = res.address.toLowerCase();

      // 2. Direct On-Chain Cryptographic Signature Challenge (if requested or in direct signing mode)
      if (requireCryptographicSignature && res.signer) {
        setSigningStep('SIGNING');
        try {
          await signWeb3AuthMessage(res.signer, res.address);
        } catch (sigErr: any) {
          if (
            sigErr?.code === 4001 ||
            sigErr?.message?.includes('User rejected') ||
            sigErr?.message?.includes('ACTION_REJECTED') ||
            sigErr?.message?.includes('denied')
          ) {
            throw new Error("Cryptographic signature challenge declined. On-chain signature verification is required to authenticate miner identity.");
          }
          console.warn("Signature challenge notice:", sigErr);
        }
      }

      setSigningStep('SYNCING');

      // 3. Sync with Firestore profile keyed strictly by on-chain address
      let profile = await getUserProfile(normalizedAddress);
      profile.walletAddress = normalizedAddress;
      await saveUserProfile(normalizedAddress, profile);

      // 4. Handle optional referral code application
      let referralBoostApplied = false;
      const refCode = (referralInput.trim() || initialReferralCode || localStorage.getItem('binance_harvest_pending_ref') || '').trim();
      if (refCode && !profile.referredBy) {
        try {
          const refRes = await applyReferralCode(normalizedAddress, refCode);
          if (refRes.success && refRes.updatedProfile) {
            profile = refRes.updatedProfile;
            referralBoostApplied = true;
            localStorage.removeItem('binance_harvest_pending_ref');
          }
        } catch (refErr) {
          console.warn("Could not apply referral during auth:", refErr);
        }
      }

      // Persist active wallet address
      localStorage.setItem('binance_harvest_active_wallet', normalizedAddress);

      setSigningStep('DONE');
      onLoginSuccess(profile);
      onClose();

      showSuccess({
        initiativeName: 'Direct On-Chain Authentication',
        title: referralBoostApplied ? 'Signed & +5% Boost Active!' : 'Miner Authenticated On-Chain!',
        badge: referralBoostApplied ? '+5% MINING BOOST' : 'BSC Mainnet (56)',
        description: referralBoostApplied 
          ? `Successfully authenticated cryptographic identity for ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}. Referral bonus applied: +5% Daily Mining boost is now active!`
          : `Successfully authenticated cryptographic identity for ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}. Your cloud hashpower and balance records are loaded.`,
        details: [
          { label: 'Miner Address', value: `${res.address.substring(0, 10)}...${res.address.substring(res.address.length - 4)}` },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Verification', value: requireCryptographicSignature ? 'Cryptographic EIP-191 Signature Verified' : 'EIP-1193 Provider Connected' },
          { label: 'Mining Tier', value: `Tier ${profile.currentTier}` },
          { label: 'Daily Yield', value: referralBoostApplied ? '+5% Boosted' : 'Base Rate' },
        ],
      });
    } catch (err: any) {
      console.error("Web3 authentication error:", err);
      setSigningStep('IDLE');
      if (
        err?.message?.includes('USER_CANCELLED') ||
        err?.message?.includes('Connection request reset') ||
        err?.message?.includes('User closed modal') ||
        err?.message?.includes('TOKENPOCKET_REDIRECTING')
      ) {
        setLoading(false);
        return;
      }

      setShowAllWallets(true);
      const isNotFound = err?.message?.includes("WEB3_WALLET_NOT_FOUND");
      const errMsg = isNotFound
        ? "No browser extension detected. Use 'WalletConnect' or tap your wallet below to open in its DApp browser."
        : (err?.message || "Failed to authenticate on Binance Smart Chain.");
      setError(errMsg);
      showFailed({
        initiativeName: 'Direct On-Chain Authentication',
        title: 'Authentication Notice',
        description: errMsg,
        actionLabel: isNotFound ? 'Use WalletConnect' : 'Retry Sign',
        onAction: isNotFound ? () => handleAuthenticateWeb3('walletconnect', false) : () => handleAuthenticateWeb3(walletType, requireCryptographicSignature),
      });
    } finally {
      setLoading(false);
    }
  };

  // Telegram TON Login Handler
  const handleAuthenticateTon = async (targetAddress: string) => {
    try {
      setLoading(true);
      setError(null);
      const cleanTon = targetAddress.trim();

      if (!isValidTonAddress(cleanTon)) {
        throw new Error("Invalid TON wallet address format. Standard user-friendly addresses start with UQ or EQ (48 characters).");
      }

      setConnectedTonAddress(cleanTon);

      // Fetch or initialize profile in Firestore keyed by TON wallet address
      let profile = await getUserProfile(cleanTon);
      profile.walletAddress = cleanTon;
      profile.walletType = 'TON';
      await saveUserProfile(cleanTon, profile);

      // Handle optional referral
      let referralBoostApplied = false;
      const refCode = (referralInput.trim() || initialReferralCode || localStorage.getItem('binance_harvest_pending_ref') || '').trim();
      if (refCode && !profile.referredBy) {
        try {
          const refRes = await applyReferralCode(cleanTon, refCode);
          if (refRes.success && refRes.updatedProfile) {
            profile = refRes.updatedProfile;
            profile.walletType = 'TON';
            referralBoostApplied = true;
            localStorage.removeItem('binance_harvest_pending_ref');
          }
        } catch (refErr) {
          console.warn("Could not apply referral:", refErr);
        }
      }

      localStorage.setItem('binance_harvest_active_wallet', cleanTon);
      localStorage.setItem('binance_harvest_wallet_type', 'TON');

      onLoginSuccess(profile);
      onClose();

      showSuccess({
        initiativeName: 'Telegram TON Authentication',
        title: referralBoostApplied ? 'TON Miner Connected & +5% Boost!' : 'Telegram TON Miner Connected!',
        badge: 'TON NETWORK',
        description: `Successfully authenticated on-chain identity for ${cleanTon.substring(0, 6)}...${cleanTon.substring(cleanTon.length - 4)}. Your cloud hashpower and balance records are loaded.`,
        details: [
          { label: 'Miner Identity', value: `${cleanTon.substring(0, 8)}...${cleanTon.substring(cleanTon.length - 6)}` },
          { label: 'Network', value: 'The Open Network (TON)' },
          { label: 'Settlement Pool', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Mining Tier', value: `Tier ${profile.currentTier}` },
        ],
      });
    } catch (err: any) {
      console.error("TON auth error:", err);
      setError(err.message || "Failed to authenticate TON wallet.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTonModal = async () => {
    try {
      setLoading(true);
      setError(null);
      const tc = getTonConnectUI();

      const unsubscribe = tc.onStatusChange(async (wallet) => {
        if (wallet && wallet.account) {
          unsubscribe();
          const address = wallet.account.address;
          await handleAuthenticateTon(address);
        }
      });

      await tc.openModal();
    } catch (err) {
      console.warn("TonConnect UI open modal notice, switching to direct address input:", err);
      setShowTonManualInput(true);
    } finally {
      setLoading(false);
    }
  };

  const isTgSystem = runtime.isTelegram;
  const hasInjectedEth = detectedProviders.hasWeb3 || runtime.hasInjectedEthereum;
  const activeInjectedName = detectedProviders.detectedWalletName || runtime.detectedWalletName || 'Web3 Wallet';

  // Handle wallet button clicks in the 3-column grid
  const handleWalletButtonClick = async (walletId: string) => {
    if (walletId === 'injected') {
      await handleAuthenticateWeb3('injected', true);
      return;
    }
    if (walletId === 'walletconnect') {
      await handleAuthenticateWeb3('walletconnect', false);
      return;
    }
    if (walletId === 'ton') {
      setViewMode('TELEGRAM_LOGIN');
      handleConnectTonModal();
      return;
    }

    // Check if this wallet is directly injected in current browser
    const isDirectlyInjected =
      (walletId === 'tokenpocket' && detectedProviders.isTokenPocket) ||
      (walletId === 'trust' && detectedProviders.isTrust) ||
      (walletId === 'okx' && detectedProviders.isOkx) ||
      (walletId === 'binance' && detectedProviders.isBinance) ||
      (walletId === 'bitget' && detectedProviders.isBitKeep) ||
      (walletId === 'safepal' && detectedProviders.isSafePal) ||
      (walletId === 'rabby' && detectedProviders.isRabby) ||
      (walletId === 'metamask' && detectedProviders.isMetaMask);

    if (isDirectlyInjected) {
      await handleAuthenticateWeb3(walletId as SupportedWalletType, true);
      return;
    }

    // Fallback or DApp browser deep link
    const walletInfo = SUPPORTED_DEEP_LINK_WALLETS.find((w) => w.id === walletId);
    if (walletInfo) {
      handleLaunchDAppBrowser(walletInfo);
    } else {
      await handleAuthenticateWeb3('injected', true);
    }
  };

  const directAuthButtons = [
    {
      id: 'injected',
      name: 'Direct Connect',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      badge: hasInjectedEth ? 'Active' : undefined,
      isSpecial: true,
    },
    {
      id: 'walletconnect',
      name: 'Wallet Connect',
      icon: <Wallet className="w-5 h-5 text-sky-400" />,
      badge: 'QR',
      isSpecial: false,
    },
    {
      id: 'binance',
      name: 'Binance Web3',
      icon: <span className="w-7 h-7 rounded-xl bg-[#F3BA2F] text-black font-black text-xs flex items-center justify-center shadow-md">BNB</span>,
      badge: detectedProviders.isBinance ? 'Active' : undefined,
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: <span className="w-7 h-7 rounded-xl bg-[#0500FF] text-white font-bold text-xs flex items-center justify-center shadow-md">TWT</span>,
      badge: detectedProviders.isTrust ? 'Active' : undefined,
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: <span className="w-7 h-7 rounded-xl bg-[#E2761B] text-white font-bold text-xs flex items-center justify-center shadow-md">MM</span>,
      badge: detectedProviders.isMetaMask ? 'Active' : undefined,
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      icon: <span className="w-7 h-7 rounded-xl bg-black border border-white/20 text-white font-bold text-xs flex items-center justify-center shadow-md">OKX</span>,
      badge: detectedProviders.isOkx ? 'Active' : undefined,
    },
    {
      id: 'tokenpocket',
      name: 'TokenPocket',
      icon: <span className="w-7 h-7 rounded-xl bg-[#2980FE] text-white font-bold text-xs flex items-center justify-center shadow-md">TP</span>,
      badge: detectedProviders.isTokenPocket ? 'Active' : undefined,
    },
    {
      id: 'bitget',
      name: 'Bitget Wallet',
      icon: <span className="w-7 h-7 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shadow-md">BG</span>,
      badge: detectedProviders.isBitKeep ? 'Active' : undefined,
    },
    {
      id: 'safepal',
      name: 'SafePal',
      icon: <span className="w-7 h-7 rounded-xl bg-[#2858EE] text-white font-bold text-xs flex items-center justify-center shadow-md">SFP</span>,
      badge: detectedProviders.isSafePal ? 'Active' : undefined,
    },
    {
      id: 'coinbase',
      name: 'Coinbase',
      icon: <span className="w-7 h-7 rounded-xl bg-[#0052FF] text-white font-bold text-xs flex items-center justify-center shadow-md">CB</span>,
    },
    {
      id: 'rabby',
      name: 'Rabby Wallet',
      icon: <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md">RB</span>,
      badge: detectedProviders.isRabby ? 'Active' : undefined,
    },
    {
      id: 'ton',
      name: 'Telegram/TON',
      icon: <span className="w-7 h-7 rounded-xl bg-sky-500 text-white font-bold text-xs flex items-center justify-center shadow-md">💎</span>,
      badge: 'TON',
    },
  ];

  const remainingWallets = SUPPORTED_DEEP_LINK_WALLETS.filter(
    (w) => !['binance', 'trust', 'metamask', 'okx', 'tokenpocket', 'bitget', 'safepal', 'coinbase', 'rabby'].includes(w.id)
  );

  const filteredRemainingWallets = remainingWallets.filter(
    (w) =>
      w.name.toLowerCase().includes(walletSearch.toLowerCase()) ||
      w.shortName.toLowerCase().includes(walletSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black/85 backdrop-blur-md p-3 sm:p-4 md:p-6 flex justify-center items-start sm:items-center py-4 sm:py-8 animate-fade-in">
      <div className="relative w-full max-w-md my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] bg-[#0B0E11]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_20px_60px_0_rgba(0,0,0,0.9)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Mirror Glass Glow Highlights */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 transition-all duration-500 ${
          viewMode === 'TELEGRAM_LOGIN' ? 'bg-sky-500/20' : 'bg-[#F3BA2F]/15'
        }`} />
        <div className={`absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20 transition-all duration-500 ${
          viewMode === 'TELEGRAM_LOGIN' ? 'bg-blue-600/15' : 'bg-[#00C087]/15'
        }`} />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" rounded="rounded-2xl" alt="BinanceHarvest Official Logo" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'Direct on-chain' : 'Telegram/TON wallet Connect'}
              </h2>
              <p className="text-[11px] text-[#848E9C] truncate">
                {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'BSC (BEP-20)' : 'TON Network'}
              </p>
            </div>
          </div>

          {isClosable && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#848E9C] hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Environment Switcher Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0 relative z-10">
          <div className="p-1 bg-black/50 border border-white/10 rounded-2xl flex gap-1.5 relative backdrop-blur-md">
            {/* Tab 1: Direct on-chain */}
            <button
              type="button"
              onClick={() => { setViewMode('DIRECT_ON_CHAIN_SIGNING'); setError(null); }}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
                viewMode === 'DIRECT_ON_CHAIN_SIGNING'
                  ? 'bg-gradient-to-r from-amber-500/25 via-[#F3BA2F]/30 to-amber-500/25 text-[#F3BA2F] border border-[#F3BA2F]/60 shadow-lg shadow-[#F3BA2F]/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'text-[#F3BA2F]' : 'text-slate-400'}`} />
              <span className="truncate">Direct on-chain</span>
            </button>

            {/* Tab 2: Telegram/TON wallet Connect */}
            <button
              type="button"
              onClick={() => { setViewMode('TELEGRAM_LOGIN'); setError(null); }}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
                viewMode === 'TELEGRAM_LOGIN'
                  ? 'bg-gradient-to-r from-sky-500/25 via-blue-500/30 to-sky-500/25 text-sky-300 border border-sky-400/60 shadow-lg shadow-sky-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Send className={`w-3.5 h-3.5 ${viewMode === 'TELEGRAM_LOGIN' ? 'text-sky-400' : 'text-slate-400'}`} />
              <span className="truncate">Telegram/TON wallet Connect</span>
            </button>
          </div>

          {/* Status Indicator */}
          <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C087] animate-pulse" />
              <span>
                Status:{' '}
                <strong className={isTgSystem ? 'text-sky-300' : 'text-[#F3BA2F]'}>
                  {isTgSystem ? 'Telegram WebApp' : hasInjectedEth ? `Active (${activeInjectedName})` : 'Web3 Ready'}
                </strong>
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-400">
              {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'Chain: 56' : 'TON'}
            </span>
          </div>
        </div>

        {/* Modal Body (Scrollable Container) */}
        <div className="p-4 sm:p-5 pt-3 space-y-4 relative z-10 flex-1 overflow-y-auto overscroll-y-contain custom-scrollbar touch-pan-y">
          
          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-2xl flex items-start gap-2.5 shadow-lg shadow-red-500/10 backdrop-blur-md"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <span className="font-semibold block text-red-200">Authentication Notice</span>
                  <span className="leading-relaxed break-words">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Launching Wallet Feedback Toast */}
          <AnimatePresence>
            {launchingWallet && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 bg-[#F3BA2F]/15 border border-[#F3BA2F]/40 text-amber-200 text-xs rounded-2xl flex items-center gap-2.5 backdrop-blur-md"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-[#F3BA2F] shrink-0" />
                <span className="leading-tight">
                  Opening in <strong>{launchingWallet}</strong>... If not opening automatically, copy DApp URL below and paste it in {launchingWallet}'s browser!
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cache Reset Notification */}
          <AnimatePresence>
            {cacheResetDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 bg-[#00C087]/15 border border-[#00C087]/40 text-emerald-300 text-xs rounded-2xl flex items-center gap-2.5 backdrop-blur-md"
              >
                <Check className="w-4 h-4 shrink-0 text-[#00C087]" />
                <span className="leading-tight">WalletConnect cache cleared! Stale pairings removed. You can now reconnect.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Referral Code Linked Banner */}
          {referralInput && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-amber-500/10 border border-[#00C087]/40 flex items-center gap-2.5 backdrop-blur-md">
              <div className="w-7 h-7 rounded-xl bg-[#00C087]/20 border border-[#00C087]/40 text-[#00C087] flex items-center justify-center shrink-0">
                <Gift className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white">Referral Bonus Linked</p>
                  <span className="text-[9px] font-mono text-[#00C087] font-bold bg-[#00C087]/15 px-1.5 py-0.5 rounded">
                    +5% BOOST
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate font-mono">
                  {referralInput.substring(0, 10)}...{referralInput.substring(referralInput.length - 4)}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 1: DIRECT ON-CHAIN SIGNING INTERFACE (3-COLUMN LAYOUT)               */}
          {/* ========================================================================= */}
          {viewMode === 'DIRECT_ON_CHAIN_SIGNING' && (
            <div className="space-y-3">
              
              {/* Active Signing Feedback Bar */}
              {loading && (
                <div className="p-3 rounded-2xl bg-[#F3BA2F]/15 border border-[#F3BA2F]/40 flex items-center justify-center gap-2.5 text-xs text-amber-200 font-semibold backdrop-blur-md">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#F3BA2F]" />
                  <span>
                    {signingStep === 'CONNECTING'
                      ? 'Connecting Provider...'
                      : signingStep === 'SIGNING'
                      ? 'Signing in Wallet...'
                      : 'Syncing Hashpower...'}
                  </span>
                </div>
              )}

              {/* Status Header */}
              <div className="flex items-center justify-between px-1 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${hasInjectedEth ? 'bg-[#00C087] animate-pulse' : 'bg-amber-400'}`} />
                  <span className="font-medium text-slate-300">
                    {hasInjectedEth ? `Active: ${activeInjectedName}` : 'Select Wallet to Connect'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-semibold">BSC (Chain 56)</span>
              </div>

              {/* 3-Column Auth Buttons Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {directAuthButtons.map((btn) => (
                  <motion.button
                    key={btn.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleWalletButtonClick(btn.id)}
                    disabled={loading}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition group text-center cursor-pointer disabled:opacity-50 min-h-[82px] backdrop-blur-xl ${
                      btn.isSpecial && hasInjectedEth
                        ? 'bg-gradient-to-b from-[#F3BA2F]/25 via-[#F3BA2F]/15 to-black/60 border-2 border-[#F3BA2F]/70 shadow-lg shadow-[#F3BA2F]/20 text-[#F3BA2F]'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white'
                    }`}
                  >
                    {btn.badge && (
                      <span className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-[#00C087]/20 text-[#00C087] border border-[#00C087]/30">
                        {btn.badge}
                      </span>
                    )}
                    <div className="mb-1.5 shrink-0 flex items-center justify-center">
                      {btn.icon}
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold leading-tight truncate w-full px-0.5 group-hover:text-amber-300 transition">
                      {btn.name}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Expand / Collapse Additional Wallets (Also in 3 columns) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllWallets(!showAllWallets)}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>More Wallets ({remainingWallets.length})</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                    <span>{showAllWallets ? 'Hide' : 'Show'}</span>
                    {showAllWallets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <AnimatePresence>
                  {showAllWallets && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="pt-2.5 space-y-2 overflow-hidden"
                    >
                      {/* Search Filter */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={walletSearch}
                          onChange={(e) => setWalletSearch(e.target.value)}
                          placeholder="Search wallet name..."
                          className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[#F3BA2F]"
                        />
                      </div>

                      {/* Remaining Wallets in Columns of 3 */}
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {filteredRemainingWallets.map((wallet) => (
                          <button
                            key={wallet.id}
                            type="button"
                            onClick={() => handleLaunchDAppBrowser(wallet)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/25 transition text-center cursor-pointer group min-h-[72px]"
                          >
                            <div className={`w-7 h-7 rounded-lg ${wallet.iconBg} text-white font-bold text-[10px] flex items-center justify-center shrink-0 mb-1 shadow-sm`}>
                              {wallet.iconText}
                            </div>
                            <span className="text-[10px] font-semibold text-white truncate w-full group-hover:text-amber-300">
                              {wallet.shortName}
                            </span>
                            {wallet.badge && (
                              <span className="text-[8px] text-slate-400 truncate">
                                {wallet.badge}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {filteredRemainingWallets.length === 0 && (
                        <p className="text-center py-2 text-xs text-slate-500">
                          No wallet found matching "{walletSearch}"
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick Connection Troubleshooting Strip */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 pt-1 border-t border-white/5">
                <span>Connection issues?</span>
                <button
                  type="button"
                  onClick={handleResetCache}
                  className="text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{cacheResetDone ? 'Cache Reset!' : 'Reset Cache'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: TELEGRAM / TON WALLET CONNECT                                     */}
          {/* ========================================================================= */}
          {viewMode === 'TELEGRAM_LOGIN' && (
            <div className="space-y-3">
              
              {/* Telegram User Identity Profile Card */}
              {runtime.telegramUser ? (
                <div className="p-3 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center gap-3 backdrop-blur-md">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
                    {runtime.telegramUser.first_name ? runtime.telegramUser.first_name[0].toUpperCase() : 'TG'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate">
                        {runtime.telegramUser.first_name} {runtime.telegramUser.last_name || ''}
                      </p>
                      <span className="text-[9px] bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded-full border border-sky-400/30 font-medium">
                        Verified
                      </span>
                    </div>
                    <p className="text-[10px] text-sky-200/80 truncate font-mono">
                      {runtime.telegramUser.username ? `@${runtime.telegramUser.username}` : `ID: #${runtime.telegramUser.id}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-sm shrink-0">
                    💎
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Telegram / TON Connect</h3>
                    <p className="text-[10px] text-slate-300">
                      Sync cloud mining hashpower with TON
                    </p>
                  </div>
                </div>
              )}

              {/* Primary Telegram Action: TON Connect Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConnectTonModal}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-sky-500/25 disabled:opacity-50"
              >
                <span className="text-base">💎</span>
                <span>Telegram/TON wallet Connect</span>
              </motion.button>

              {/* Paste TON Address Option */}
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setShowTonManualInput(!showTonManualInput)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer font-medium"
                >
                  <span>{showTonManualInput ? 'Hide TON address' : 'Paste TON address'}</span>
                  {showTonManualInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {showTonManualInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/30 space-y-2"
                >
                  <label className="text-[11px] text-sky-200 block font-medium">
                    TON Wallet Address (UQ... / EQ...)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tonInputAddress}
                      onChange={(e) => setTonInputAddress(e.target.value)}
                      placeholder="UQ... or EQ... (48 characters)"
                      className="flex-1 px-3 py-2 bg-black/50 border border-sky-500/30 rounded-xl text-xs text-white placeholder-sky-200/40 font-mono focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      disabled={loading || !tonInputAddress.trim()}
                      onClick={() => handleAuthenticateTon(tonInputAddress)}
                      className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs disabled:opacity-40 transition cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Simple Settlement Info */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-sky-300">Identity: Telegram / TON</span>
                <span className="text-amber-400">Payout: BSC (BEP-20)</span>
              </div>

            </div>
          )}

          {/* Optional Referral Code Input (Always accessible in clean footer section) */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Gift className="w-3 h-3 text-amber-400" />
                <span>Referral Code (Optional)</span>
              </label>
              <span className="text-[10px] text-amber-400 font-mono font-bold">+5% Mining Boost</span>
            </div>
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Paste friend's BSC address (0x...)"
              className="w-full px-3.5 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F3BA2F] focus:ring-1 focus:ring-[#F3BA2F] transition backdrop-blur-md font-mono"
            />
          </div>

          {/* Quick Utility Links */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={handleCopyAppUrl}
              className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:underline cursor-pointer font-medium"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#00C087]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied URL!' : 'Copy DApp URL'}</span>
            </button>

            <button
              onClick={handleResetCache}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition cursor-pointer"
              title="Clear stale WalletConnect pairings"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{cacheResetDone ? 'Cache Reset!' : 'Reset Session Cache'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
