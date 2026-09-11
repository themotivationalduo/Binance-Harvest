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
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
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

      setShowTroubleshooting(true);
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

  const filteredWallets = SUPPORTED_DEEP_LINK_WALLETS.filter(w => 
    w.name.toLowerCase().includes(walletSearch.toLowerCase()) ||
    w.shortName.toLowerCase().includes(walletSearch.toLowerCase()) ||
    w.description.toLowerCase().includes(walletSearch.toLowerCase())
  );

  const popularWallets = SUPPORTED_DEEP_LINK_WALLETS.filter(w => w.category === 'popular').slice(0, 6);

  const isTgSystem = runtime.isTelegram;
  const hasInjectedEth = detectedProviders.hasWeb3 || runtime.hasInjectedEthereum;
  const activeInjectedName = detectedProviders.detectedWalletName || runtime.detectedWalletName || 'Injected Web3 Provider';

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

        {/* Modal Header (Pinned at Top) */}
        <div className="p-4 sm:p-5 pb-3 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" rounded="rounded-2xl" alt="BinanceHarvest Official Logo" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'Direct On-Chain Signing' : 'Telegram Miner Login'}
              </h2>
              <p className="text-[11px] text-[#848E9C] truncate">
                {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'Binance Smart Chain (BEP-20)' : 'The Open Network (TON) & BSC Pool'}
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

        {/* System Environment Switcher (Clean Interface Differentiation) */}
        <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0 relative z-10">
          <div className="p-1 bg-black/50 border border-white/10 rounded-2xl flex gap-1.5 relative backdrop-blur-md">
            {/* Tab 1: Direct On-Chain Signing */}
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
              <span className="truncate">Direct On-Chain</span>
              {!isTgSystem && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#00C087]/20 text-[#00C087] border border-[#00C087]/30 font-mono font-bold hidden xs:inline-block">
                  AUTO
                </span>
              )}
            </button>

            {/* Tab 2: Telegram Login */}
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
              <span className="truncate">Telegram Login</span>
              {isTgSystem && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/30 font-mono font-bold hidden xs:inline-block">
                  AUTO
                </span>
              )}
            </button>
          </div>

          {/* System Dictation Status Pill */}
          <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C087] animate-pulse" />
              <span>
                System Dictated:{' '}
                <strong className={isTgSystem ? 'text-sky-300' : 'text-[#F3BA2F]'}>
                  {isTgSystem ? 'Telegram Mini App Webview' : hasInjectedEth ? `Web3 Provider (${activeInjectedName})` : 'DApp Browser / Remote Web3'}
                </strong>
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 hidden sm:inline-block">
              {viewMode === 'DIRECT_ON_CHAIN_SIGNING' ? 'Chain ID: 56' : 'TON Network'}
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
          {/* VIEW 1: DIRECT ON-CHAIN SIGNING INTERFACE                                 */}
          {/* ========================================================================= */}
          {viewMode === 'DIRECT_ON_CHAIN_SIGNING' && (
            <div className="space-y-3.5">
              
              {/* Primary Direct On-Chain Signing Hero Card (when Web3 provider is detected) */}
              {hasInjectedEth ? (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-[#F3BA2F]/15 via-[#1E2329] to-[#0B0E11] border-2 border-[#F3BA2F]/60 shadow-[0_8px_32px_rgba(243,186,47,0.25)] relative overflow-hidden backdrop-blur-xl">
                  {/* Subtle Background Circuit Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#F3BA2F]/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00C087] animate-ping" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F3BA2F]">
                        Direct On-Chain Signing Ready
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#00C087] bg-[#00C087]/15 border border-[#00C087]/30 px-2 py-0.5 rounded-full">
                      EIP-1193 + EIP-191
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#F3BA2F] text-black flex items-center justify-center font-black shrink-0 shadow-md">
                      <Zap className="w-5 h-5 fill-black" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {activeInjectedName}
                      </h3>
                      <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                        Initiate a 1-tap cryptographic handshake on Binance Smart Chain to verify your miner address and load cloud hashpower.
                      </p>
                    </div>
                  </div>

                  {/* 3-Step Live Signing Sequence Indicator */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-black/50 border border-white/10 rounded-xl mb-3 text-[9px] font-mono">
                    <div className={`p-1.5 rounded-lg text-center ${signingStep === 'CONNECTING' ? 'bg-[#F3BA2F]/20 text-[#F3BA2F] border border-[#F3BA2F]/40' : signingStep !== 'IDLE' ? 'text-[#00C087]' : 'text-slate-400'}`}>
                      <span>1. Handshake</span>
                    </div>
                    <div className={`p-1.5 rounded-lg text-center ${signingStep === 'SIGNING' ? 'bg-[#F3BA2F]/20 text-[#F3BA2F] border border-[#F3BA2F]/40' : (signingStep === 'SYNCING' || signingStep === 'DONE') ? 'text-[#00C087]' : 'text-slate-400'}`}>
                      <span>2. Signature</span>
                    </div>
                    <div className={`p-1.5 rounded-lg text-center ${signingStep === 'SYNCING' ? 'bg-[#00C087]/20 text-[#00C087] border border-[#00C087]/40' : signingStep === 'DONE' ? 'text-[#00C087]' : 'text-slate-400'}`}>
                      <span>3. Synchronize</span>
                    </div>
                  </div>

                  {/* Primary 1-Tap Action Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAuthenticateWeb3(detectedProviders.isTokenPocket ? 'tokenpocket' : 'metamask', true)}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-[#F3BA2F] to-amber-300 hover:brightness-110 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#F3BA2F]/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>
                          {signingStep === 'CONNECTING' ? 'Connecting Provider...' : signingStep === 'SIGNING' ? 'Signing Cryptographic Challenge...' : 'Syncing Cloud Hashpower...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-black" />
                        <span>Initiate Direct On-Chain Signing</span>
                      </>
                    )}
                  </motion.button>
                </div>
              ) : (
                /* No Injected Wallet in current browser -> Clean 안내 */
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <Globe className="w-4 h-4" />
                    <span>Remote Web3 / Mobile Browser Detected</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Direct browser extension was not detected in this window. Connect seamlessly via <strong>WalletConnect</strong> or launch directly inside your Web3 wallet's built-in DApp browser.
                  </p>
                </div>
              )}

              {/* Secondary Option: WalletConnect Universal Modal */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAuthenticateWeb3('walletconnect', false)}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-black hover:bg-slate-800 border border-white/15 text-white font-bold text-xs shadow-md transition flex items-center justify-between cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-400/30">
                    <Wallet className="w-4 h-4 text-blue-300" />
                  </div>
                  <div className="text-left">
                    <span className="block leading-tight text-white">WalletConnect (Mobile Wallets)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Trust, SafePal, Rainbow, OKX & 300+ Wallets</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-mono border border-white/15">
                  SCAN QR
                </span>
              </motion.button>

              {/* Browser Extension Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAuthenticateWeb3('metamask', true)}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Globe className="w-3.5 h-3.5 text-[#F3BA2F]" />
                <span>Browser Extension (MetaMask / Binance / OKX)</span>
              </motion.button>

              {/* Direct DApp Browser Launcher for over 20 Web3 Wallets */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/15 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#F3BA2F]/20 border border-[#F3BA2F]/40 flex items-center justify-center text-[#F3BA2F]">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        Open in Wallet DApp Browser
                        <span className="text-[9px] px-1.5 py-0.2 bg-[#00C087]/20 text-[#00C087] rounded border border-[#00C087]/30 font-bold">
                          24 WALLETS
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Bypasses redirect drops via direct URL deep link
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top 6 Popular Wallets Quick Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {popularWallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      type="button"
                      onClick={() => handleLaunchDAppBrowser(wallet)}
                      className="p-2 rounded-xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/25 transition flex items-center gap-2 text-left cursor-pointer group"
                    >
                      <div className={`w-6 h-6 rounded-lg ${wallet.iconBg} text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm`}>
                        {wallet.iconText}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-white truncate group-hover:text-[#F3BA2F] transition">
                          {wallet.shortName}
                        </p>
                        <span className="text-[9px] text-slate-400 block truncate">
                          {wallet.badge || 'DApp Browser'}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white shrink-0 transition" />
                    </button>
                  ))}
                </div>

                {/* Expand / Collapse All 24 Wallets */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAllWallets(!showAllWallets)}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-[#F3BA2F]" />
                      <span>
                        {showAllWallets ? 'Hide Wallet Directory' : 'Browse All 24 Web3 Wallets'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#F3BA2F] font-mono">
                      <span>24 Supported</span>
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
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={walletSearch}
                            onChange={(e) => setWalletSearch(e.target.value)}
                            placeholder="Search 24 wallets (Trust, SafePal, 1inch, OKX...)"
                            className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[#F3BA2F]"
                          />
                        </div>

                        {/* Filtered Wallets Scrollable List */}
                        <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                          {filteredWallets.map((wallet) => (
                            <button
                              key={wallet.id}
                              type="button"
                              onClick={() => handleLaunchDAppBrowser(wallet)}
                              className="w-full p-2 rounded-xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/20 transition flex items-center justify-between text-left cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-6 h-6 rounded-lg ${wallet.iconBg} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                                  {wallet.iconText}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-white truncate group-hover:text-[#F3BA2F]">
                                    {wallet.name}
                                  </p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {wallet.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                {wallet.badge && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                                    {wallet.badge}
                                  </span>
                                )}
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                              </div>
                            </button>
                          ))}

                          {filteredWallets.length === 0 && (
                            <p className="text-center py-4 text-xs text-slate-500">
                              No wallet matching "{walletSearch}". Try copying the DApp URL below!
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Universal Web3 Wallet Troubleshooting Guide (Accordion) */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="w-full p-3 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Connection Issues? Universal Wallet Fix Guide</span>
                  </div>
                  {showTroubleshooting ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                <AnimatePresence>
                  {showTroubleshooting && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-3 space-y-2.5 text-[11px] text-slate-300 border-t border-white/5 pt-2"
                    >
                      <div className="space-y-2">
                        {/* Fix 1: Network Selection */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                            <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px]">1</span>
                            <span>Switch Network to Binance Smart Chain (BSC / BNB)</span>
                          </div>
                          <p className="text-slate-400 text-[10px] pl-5 leading-normal">
                            Set your wallet network to <strong>Binance Smart Chain (BEP-20 / Chain ID 56)</strong>.
                          </p>
                        </div>

                        {/* Fix 2: Stale Cache Reset */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                              <span className="w-4 h-4 rounded-full bg-sky-400/20 text-sky-300 flex items-center justify-center text-[10px]">2</span>
                              <span>Clear Stale WalletConnect Session Cache</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleResetCache}
                              className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-[10px] border border-sky-400/30 transition cursor-pointer"
                            >
                              {cacheResetDone ? 'Reset Done!' : 'Clear Cache'}
                            </button>
                          </div>
                          <p className="text-slate-400 text-[10px] pl-5 leading-normal">
                            Clears expired handshake sessions in browser storage.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: TELEGRAM LOGIN INTERFACE                                         */}
          {/* ========================================================================= */}
          {viewMode === 'TELEGRAM_LOGIN' && (
            <div className="space-y-3.5">
              
              {/* Telegram User Identity Profile Card */}
              {runtime.telegramUser ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/15 via-blue-500/10 to-transparent border border-sky-400/30 flex items-center gap-3 backdrop-blur-md">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-black text-base flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0">
                    {runtime.telegramUser.first_name ? runtime.telegramUser.first_name[0].toUpperCase() : 'TG'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate">
                        {runtime.telegramUser.first_name} {runtime.telegramUser.last_name || ''}
                      </p>
                      <span className="text-[9px] bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded-full border border-sky-400/30 flex items-center gap-0.5 font-medium">
                        <ShieldCheck className="w-2.5 h-2.5" /> Verified TG WebApp
                      </span>
                    </div>
                    <p className="text-[10px] text-sky-200/80 truncate font-mono">
                      {runtime.telegramUser.username ? `@${runtime.telegramUser.username}` : `Telegram ID: #${runtime.telegramUser.id}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-base shrink-0">
                    💎
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Telegram Cloud Miner Session</h3>
                    <p className="text-[10px] text-slate-300 leading-normal">
                      Connect via TonConnect or enter your TON address to sync cloud mining hashpower.
                    </p>
                  </div>
                </div>
              )}

              {/* Primary Telegram Action: TON Connect Modal Button */}
              <div className="rounded-2xl p-0.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 shadow-xl shadow-sky-500/25">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConnectTonModal}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-[14px] bg-[#0c192c] hover:bg-[#0f213a] text-white font-bold text-sm transition flex items-center justify-between cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-sky-500/40">
                      💎
                    </div>
                    <div className="text-left">
                      <span className="block leading-tight text-white flex items-center gap-1.5 font-extrabold">
                        Connect TON Wallet
                      </span>
                      <span className="text-[10px] text-sky-200 font-normal">
                        Tonkeeper • Telegram @wallet • TonConnect
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                    1-TAP CONNECT
                  </span>
                </motion.button>
              </div>

              {/* Manual TON Address Input Trigger */}
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setShowTonManualInput(!showTonManualInput)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>{showTonManualInput ? 'Hide TON address input' : 'Paste TON address directly'}</span>
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
                    Enter TON Wallet Address (UQ... / EQ...)
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
                  <p className="text-[10px] text-sky-300/70">
                    Instantly initializes cloud hashpower for your Telegram profile.
                  </p>
                </motion.div>
              )}

              {/* Telegram Cross-Chain Settlement Architecture Banner */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-sky-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>Cross-Chain Cloud Mining Architecture</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your Telegram miner session operates with zero browser extension requirements. Hashpower is calculated in real-time, and rewards settle seamlessly through our Binance Smart Chain (BEP-20) treasury pool.
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
                  <span>Identity: Telegram / TON</span>
                  <span className="text-amber-400">Payout: BSC (BEP-20)</span>
                </div>
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
