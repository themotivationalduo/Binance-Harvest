import React, { useState, useEffect } from 'react';
import { Wallet, Globe, AlertCircle, X, Copy, Check, RefreshCw, Gift } from 'lucide-react';
import { UserProfile } from '../types';
import { connectWallet } from '../services/web3';
import { getUserProfile, saveUserProfile, applyReferralCode } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { AppLogo } from './AppLogo';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [referralInput, setReferralInput] = useState<string>('');

  const { showSuccess, showFailed } = useInitiativeFeedback();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Auto-load initial or cached referral code
      const cachedRef = typeof window !== 'undefined' ? localStorage.getItem('binance_harvest_pending_ref') : null;
      if (initialReferralCode) {
        setReferralInput(initialReferralCode);
      } else if (cachedRef) {
        setReferralInput(cachedRef);
      }
    }
  }, [isOpen, initialReferralCode]);

  if (!isOpen) return null;

  const handleCopyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText("https://binanceharvest.vercel.app");
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleAuthenticateWeb3 = async (walletType: 'walletconnect' | 'metamask' = 'walletconnect') => {
    try {
      setLoading(true);
      setError(null);

      // Connect to Web3 provider
      const res = await connectWallet(walletType);
      if (!res || !res.address) {
        throw new Error("No authorized wallet address received.");
      }

      const normalizedAddress = res.address.toLowerCase();

      // Sync with Firestore profile keyed strictly by on-chain address
      let profile = await getUserProfile(normalizedAddress);
      profile.walletAddress = normalizedAddress;
      await saveUserProfile(normalizedAddress, profile);

      // Handle optional referral code application
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

      onLoginSuccess(profile);
      onClose();

      showSuccess({
        initiativeName: 'Web3 On-Chain Authentication',
        title: referralBoostApplied ? 'Authenticated & +5% Boost Active!' : 'Miner Authenticated On-Chain!',
        badge: referralBoostApplied ? '+5% MINING BOOST' : 'BSC Mainnet (56)',
        description: referralBoostApplied 
          ? `Successfully authenticated on-chain identity for ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}. Referral bonus applied: +5% Daily Mining boost is now active!`
          : `Successfully authenticated on-chain identity for ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}. Your cloud hashpower and balance records are loaded.`,
        details: [
          { label: 'Miner Address', value: `${res.address.substring(0, 10)}...${res.address.substring(res.address.length - 4)}` },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Provider', value: walletType === 'walletconnect' ? 'WalletConnect' : 'Browser Extension' },
          { label: 'Mining Tier', value: `Tier ${profile.currentTier}` },
          { label: 'Daily Yield', value: referralBoostApplied ? '+5% Boosted' : 'Base Rate' },
        ],
      });
    } catch (err: any) {
      console.error("Web3 authentication error:", err);
      // Cleanly handle user closing the AppKit modal without scary error toast
      if (
        err?.message?.includes('USER_CANCELLED') ||
        err?.message?.includes('Connection request reset') ||
        err?.message?.includes('User closed modal')
      ) {
        setLoading(false);
        return;
      }

      const isNotFound = err?.message?.includes("WEB3_WALLET_NOT_FOUND");
      const errMsg = isNotFound
        ? "No browser extension detected. Please use 'WalletConnect' to connect your mobile wallet."
        : (err?.message || "Failed to authenticate on Binance Smart Chain.");
      setError(errMsg);
      showFailed({
        initiativeName: 'Web3 On-Chain Authentication',
        title: 'Authentication Unsuccessful',
        description: errMsg,
        actionLabel: isNotFound ? 'Use WalletConnect' : 'Retry Connect',
        onAction: isNotFound ? () => handleAuthenticateWeb3('walletconnect') : () => handleAuthenticateWeb3(walletType),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex min-h-screen items-center justify-center animate-fade-in overscroll-contain">
      <div className="relative w-full max-w-md my-auto flex flex-col bg-[#0B0E11]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_16px_50px_0_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Mirror Glass Glow Highlights */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-[#F3BA2F]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#00C087]/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16"></div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" rounded="rounded-2xl" alt="BinanceHarvest Official Logo" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                Connect Wallet
              </h2>
              <p className="text-[11px] text-[#848E9C] truncate">
                Binance Smart Chain (BEP-20)
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 relative z-10 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
          
          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-2xl flex items-start gap-2.5 shadow-lg shadow-red-500/10 backdrop-blur-md"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold block">Notice</span>
                  <span className="leading-relaxed break-words">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Referral Code Detected Banner */}
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

          {/* Network Banner */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#00C087] animate-pulse shadow-[0_0_8px_#00C087]" />
              <p className="text-xs font-medium text-white">BSC Mainnet (Chain ID 56)</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#F3BA2F] px-2 py-0.5 bg-[#F3BA2F]/10 border border-[#F3BA2F]/20 rounded-lg">
              BNB
            </span>
          </div>

          {/* Optional Referral Code Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Gift className="w-3 h-3 text-amber-400" />
                <span>Referral Code (Optional)</span>
              </label>
              <span className="text-[10px] text-amber-400 font-mono">+5% Mining Boost</span>
            </div>
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Paste friend's BSC address (0x...)"
              className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F3BA2F] focus:ring-1 focus:ring-[#F3BA2F] transition backdrop-blur-md"
            />
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col gap-2.5 pt-1">
            {/* WalletConnect Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAuthenticateWeb3('walletconnect')}
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-[#F3BA2F]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 text-slate-950" />
                  <span>WalletConnect</span>
                </>
              )}
            </motion.button>

            {/* Browser Extension Wallet connect */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAuthenticateWeb3('metamask')}
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-4 h-4 text-[#F3BA2F]" />
              <span>Browser Extension Wallet connect</span>
            </motion.button>
          </div>

          {/* Mobile / Helper */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-center">
            <button
              onClick={handleCopyAppUrl}
              className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:underline cursor-pointer font-medium"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#00C087]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied to Clipboard!' : 'Copy App URL for dApp Browser'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

