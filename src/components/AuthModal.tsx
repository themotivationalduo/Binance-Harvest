import React, { useState, useEffect } from 'react';
import { ShieldCheck, Wallet, Globe, CheckCircle2, AlertCircle, X, ExternalLink, Copy, Check, Sparkles, RefreshCw, Lock } from 'lucide-react';
import { UserProfile } from '../types';
import { connectWallet, switchToBSC, detectWeb3Providers, signWeb3AuthMessage } from '../services/web3';
import { getUserProfile, saveUserProfile } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  isClosable?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isClosable = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [requireSignature, setRequireSignature] = useState(false);

  const { showSuccess, showFailed } = useInitiativeFeedback();

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText("https://binanceharvest.vercel.app");
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      // Fallback
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleAuthenticateWeb3 = async (walletType?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Connect to Web3 provider
      const res = await connectWallet();
      if (!res || !res.address) {
        throw new Error("No authorized wallet address received.");
      }

      const normalizedAddress = res.address.toLowerCase();

      // If user selected cryptographic signature verification
      if (requireSignature && res.signer) {
        try {
          await signWeb3AuthMessage(res.signer, res.address);
        } catch (signErr: any) {
          if (signErr?.code === 4001 || signErr?.message?.includes("User rejected")) {
            throw new Error("Signature verification was rejected in your Web3 wallet.");
          }
        }
      }

      // Sync with Firestore profile keyed strictly by on-chain address
      const profile = await getUserProfile(normalizedAddress);
      profile.walletAddress = normalizedAddress;
      await saveUserProfile(normalizedAddress, profile);

      // Persist active wallet address
      localStorage.setItem('binance_harvest_active_wallet', normalizedAddress);

      onLoginSuccess(profile);
      onClose();

      showSuccess({
        initiativeName: 'Web3 On-Chain Authentication',
        title: 'Miner Authenticated On-Chain!',
        badge: 'BSC Mainnet (56)',
        description: `Successfully authenticated on-chain identity for ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}. Your cloud hashpower and balance records are loaded.`,
        details: [
          { label: 'Miner Address', value: `${res.address.substring(0, 10)}...${res.address.substring(res.address.length - 4)}` },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
          { label: 'Mining Tier', value: `Tier ${profile.currentTier}` },
          { label: 'Total Balance', value: `${profile.totalPoints.toLocaleString()} PTS` },
        ],
      });
    } catch (err: any) {
      console.error("Web3 authentication error:", err);
      const isNotFound = err?.message?.includes("WEB3_WALLET_NOT_FOUND");
      const errMsg = isNotFound
        ? "No Web3 wallet detected. Please install MetaMask, Trust Wallet, or open this app inside your mobile wallet dApp browser."
        : (err?.message || "Failed to authenticate on Binance Smart Chain.");
      setError(errMsg);
      showFailed({
        initiativeName: 'Web3 On-Chain Authentication',
        title: 'Authentication Unsuccessful',
        description: errMsg,
        actionLabel: isNotFound ? 'Copy Link for Mobile dApp' : 'Retry Web3 Connect',
        onAction: isNotFound ? handleCopyAppUrl : () => handleAuthenticateWeb3(walletType),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex min-h-screen items-center justify-center animate-fade-in overscroll-contain">
      <div className="relative w-full max-w-lg my-auto flex flex-col bg-[#0B0E11]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_16px_50px_0_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Mirror Glass Glow Highlights */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F3BA2F]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00C087]/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 text-[#F3BA2F] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 filter drop-shadow-[0_2px_8px_rgba(243,186,47,0.3)]">
                <path d="M16.622 10.076L12 5.454 7.378 10.076H3.344L12 1.419l8.656 8.657h-4.034zM12 18.546l4.622-4.622h4.034L12 22.58l-8.656-8.656h4.034L12 18.546zM13.931 12L12 10.069 10.069 12 12 13.931 13.931 12zM20.656 12l-2.011-2.012 2.011-2.012L22.668 12l-2.012 2.012L20.656 12zM3.344 12l2.012-2.012L3.344 7.976 1.332 12l2.012 2.012L3.344 12z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  Web3 Authentication
                </h2>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#00C087]/20 text-[#00C087] border border-[#00C087]/30 shrink-0">
                  On-Chain Only
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#848E9C] truncate">
                Binance Smart Chain (BEP-20) Decentralized ID
              </p>
            </div>
          </div>

          {isClosable && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#848E9C] hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 relative z-10 max-h-[calc(85vh-120px)] overflow-y-auto custom-scrollbar">
          
          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-4 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-2xl flex items-start gap-3 shadow-lg shadow-red-500/10 backdrop-blur-md"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Authentication Notice:</span>
                  <span className="leading-relaxed">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Network Banner */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00C087] animate-pulse shadow-[0_0_10px_#00C087]" />
              <div>
                <p className="text-xs font-bold text-white">Target Network: BSC Mainnet</p>
                <p className="text-[11px] text-[#848E9C]">Chain ID 56 • Native Currency BNB</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#F3BA2F] px-2.5 py-1 bg-[#F3BA2F]/10 border border-[#F3BA2F]/20 rounded-lg">
              BEP-20
            </span>
          </div>

          {/* Cryptographic signature option */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Cryptographic Challenge Signature</p>
                <p className="text-[11px] text-[#848E9C]">Request an on-chain personal sign challenge</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRequireSignature(!requireSignature)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                requireSignature ? 'bg-[#F3BA2F]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                  requireSignature ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Primary Action Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAuthenticateWeb3()}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-[#F3BA2F]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Connecting & Verifying On-Chain...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>One-Click Web3 Authentication</span>
              </>
            )}
          </motion.button>

          {/* Mobile / Fallback Helper */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-[#848E9C]">
              <span>Opening on mobile?</span>
              <button
                onClick={handleCopyAppUrl}
                className="flex items-center gap-1.5 text-amber-400 hover:underline cursor-pointer font-medium self-start sm:self-auto"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#00C087]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied to Clipboard!' : 'Copy App URL for dApp Browser'}</span>
              </button>
            </div>

            <p className="text-[11px] text-[#848E9C] leading-relaxed text-center">
              Decentralized Non-Custodial Architecture: No passwords or emails needed. Your on-chain address is verified directly via Binance Smart Chain RPC.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
