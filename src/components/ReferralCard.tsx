import React, { useState } from 'react';
import { UserProfile } from '../types';
import { 
  Users, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Gift,
  ShieldCheck,
  TrendingUp,
  MessageCircle
} from 'lucide-react';
import { applyReferralCode } from '../services/firebase';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { motion, AnimatePresence } from 'motion/react';

interface ReferralCardProps {
  user: UserProfile;
  baseDailyBHFT: number;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({
  user,
  baseDailyBHFT,
  onUpdateUser,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [inputSuccess, setInputSuccess] = useState<string | null>(null);
  const { showSuccess, showFailed } = useInitiativeFeedback();

  const userAddress = user.walletAddress || '';
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/ref-${userAddress}`
    : `https://binanceharvest.vercel.app/ref-${userAddress}`;

  // Multiplier math
  const referralCount = user.referralCount || 0;
  const referrerBonusPct = referralCount * 5;
  const refereeBonusPct = user.referredBy ? 5 : 0;
  const totalBonusPct = referrerBonusPct + refereeBonusPct;
  const totalMultiplier = 1 + (totalBonusPct / 100);
  const boostedDailyBHFT = baseDailyBHFT * totalMultiplier;

  const handleCopyLink = async () => {
    if (!userAddress) {
      setInputError('Please connect your Web3 wallet first to get your personal referral link.');
      setTimeout(() => setInputError(null), 4000);
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const shareText = `⛏️ Join BinanceHarvest to cloud mine BHFT on Binance Smart Chain! Use my referral link for an instant +5% Daily Mining boost: ${referralLink}`;

  const handleShareTelegram = () => {
    if (!userAddress) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShareTwitter = () => {
    if (!userAddress) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!userAddress) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleApplyReferral = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setInputError(null);
    setInputSuccess(null);

    if (!userAddress) {
      setInputError('Please connect your Web3 wallet before applying a referral code.');
      return;
    }

    if (!manualCode.trim()) {
      setInputError('Please enter a valid referrer BSC address or referral link.');
      return;
    }

    const cleanedCode = manualCode.trim();
    if (cleanedCode.toLowerCase() === userAddress.toLowerCase() || cleanedCode.includes(userAddress.toLowerCase())) {
      setInputError('You cannot use your own referral code!');
      return;
    }

    try {
      setIsApplying(true);
      const res = await applyReferralCode(userAddress, cleanedCode);
      if (!res.success) {
        setInputError(res.message);
        showFailed({
          initiativeName: 'Referral Program',
          title: 'Referral Code Failed',
          description: res.message,
        });
        setIsApplying(false);
        return;
      }

      // Update state locally
      if (res.updatedProfile) {
        onUpdateUser(res.updatedProfile);
      } else {
        onUpdateUser({
          referredBy: res.referrerAddress,
          referralBonusPercent: ((user.referralCount || 0) * 5) + 5,
        });
      }

      setInputSuccess(res.message);
      setManualCode('');
      setIsApplying(false);

      showSuccess({
        initiativeName: 'Referral Program',
        title: '+5% Mining Boost Activated!',
        badge: '+5% DAILY YIELD',
        description: `Successfully linked referrer ${res.referrerAddress?.substring(0, 6)}...${res.referrerAddress?.substring(38)}. You and your referrer both earned a permanent +5% Daily Mining boost!`,
        details: [
          { label: 'Referrer Address', value: `${res.referrerAddress?.substring(0, 10)}...` },
          { label: 'Referee Boost', value: '+5% Permanent' },
          { label: 'Updated Daily Mining', value: `${(baseDailyBHFT * 1.05).toFixed(4)} BHFT/day` },
        ],
      });
    } catch (err: any) {
      setInputError(err?.message || 'Failed to apply referral code.');
      setIsApplying(false);
    }
  };

  return (
    <div id="referral-program-section" className="rounded-3xl bg-[#181A20]/80 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-5 sm:p-7 relative overflow-hidden transition-all duration-300">
      
      {/* Mirror Glass Glow Backgrounds */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-[#F3BA2F]/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-24 -mt-24" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-[#00C087]/10 via-[#00C087]/5 to-transparent rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-[#F3BA2F]/30 to-amber-400/10 border border-[#F3BA2F]/40 flex items-center justify-center text-[#F3BA2F] shrink-0 shadow-lg shadow-[#F3BA2F]/10">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Referral Program & Hash Booster
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3BA2F]/15 text-[#F3BA2F] border border-[#F3BA2F]/30 flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-[#F3BA2F]" />
                +5% Per Referral
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Invite friends with your BSC wallet link. Earn a permanent <strong className="text-amber-300 font-semibold">+5% Daily Mining increase</strong> for every single referee, and your friends also get an instant <strong className="text-[#00C087] font-semibold">+5% boost</strong>!
            </p>
          </div>
        </div>

        {/* Global Multiplier Pill */}
        <div className="flex flex-col sm:items-end justify-center bg-white/[0.03] border border-white/10 px-4 py-2.5 rounded-2xl shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Active Mining Boost</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-black mono text-[#F3BA2F]">+{totalBonusPct}%</span>
            <span className="text-xs text-[#00C087] font-semibold">({totalMultiplier.toFixed(2)}x yield)</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-5 relative z-10">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Successfully Referred Users</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black mono text-white">{referralCount}</span>
            <span className="text-xs text-slate-400">{referralCount === 1 ? 'User' : 'Users'}</span>
          </div>
          <p className="text-[10px] text-amber-400/90 mt-1 font-mono">+{referrerBonusPct}% Mining Increase</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Mining Increase Bonus</span>
            <Gift className="w-4 h-4 text-[#00C087]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black mono text-[#00C087]">
              +{totalBonusPct}%
            </span>
            <span className="text-xs text-emerald-400/80 font-bold">Total Boost</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            {user.referredBy ? `Includes +5% referee link bonus` : `${referrerBonusPct}% from invites (+5% per user)`}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Boosted Daily Mining</span>
            <TrendingUp className="w-4 h-4 text-[#F3BA2F]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black mono text-[#F3BA2F]">{boostedDailyBHFT.toFixed(4)}</span>
            <span className="text-xs font-semibold text-amber-300/80">BHFT/d</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Base: {baseDailyBHFT.toFixed(4)} BHFT/d</p>
        </div>
      </div>

      {/* Referral Link Copy & Share Area */}
      <div className="space-y-3 relative z-10 pt-1">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span>Your Unique Referral Link</span>
          {userAddress && (
            <span className="text-[10px] font-mono text-amber-400 font-normal">
              BEP-20 Identifier: {userAddress.substring(0, 6)}...{userAddress.substring(38)}
            </span>
          )}
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 overflow-hidden backdrop-blur-md">
            <span className="text-xs mono text-amber-300/90 truncate select-all">
              {userAddress ? referralLink : 'Connect wallet to generate referral link'}
            </span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyLink}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-amber-600 hover:brightness-110 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#F3BA2F]/20 shrink-0 cursor-pointer transition"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-black stroke-[3]" />
                <span>Copied Link!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-black" />
                <span>Copy Referral Link</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Quick Social Share Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] text-slate-400 font-medium">Quick Share:</span>
          <button
            onClick={handleShareTelegram}
            disabled={!userAddress}
            className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Telegram</span>
          </button>
          <button
            onClick={handleShareTwitter}
            disabled={!userAddress}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>X (Twitter)</span>
          </button>
          <button
            onClick={handleShareWhatsApp}
            disabled={!userAddress}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Manual Referral Input / Already Applied Status */}
      <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
        {user.referredBy ? (
          <div className="p-4 rounded-2xl bg-[#00C087]/10 border border-[#00C087]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00C087]/20 border border-[#00C087]/40 text-[#00C087] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Referred by:</span>
                  <span className="font-mono text-[#00C087]">
                    {user.referredBy.substring(0, 6)}...{user.referredBy.substring(user.referredBy.length - 4)}
                  </span>
                </p>
                <p className="text-[11px] text-slate-300">
                  Your +5% Referee Daily Mining boost is permanently active on your account!
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#00C087]/20 border border-[#00C087]/30 text-[#00C087] text-[10px] font-bold font-mono self-start sm:self-auto">
              +5% BOOST LOCKED
            </span>
          </div>
        ) : (
          <form onSubmit={handleApplyReferral} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>Enter Friend's Referral Code</span>
              </label>
              <span className="text-[10px] text-slate-400">Get +5% instant Daily Mining boost</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  setInputError(null);
                }}
                placeholder="Paste referrer's BSC wallet address (0x...) or link"
                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F3BA2F] focus:ring-1 focus:ring-[#F3BA2F] transition backdrop-blur-md"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isApplying || !manualCode.trim()}
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F3BA2F]" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Apply Code (+5%)</span>
                  </>
                )}
              </motion.button>
            </div>

            <AnimatePresence>
              {inputError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inputError}</span>
                </motion.div>
              )}
              {inputSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 rounded-xl bg-[#00C087]/15 border border-[#00C087]/30 text-[#00C087] text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{inputSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>

      {/* Referred Friends List (if any) */}
      {user.referredUsers && user.referredUsers.length > 0 && (
        <div className="mt-5 pt-5 border-t border-white/10 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Referred Friends ({user.referredUsers.length})</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono">+{user.referredUsers.length * 5}% Hash Boost Added</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {user.referredUsers.map((refAddr, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                    #{idx + 1}
                  </div>
                  <span className="font-mono text-slate-300 text-[11px] truncate">
                    {refAddr.substring(0, 6)}...{refAddr.substring(refAddr.length - 4)}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#00C087] bg-[#00C087]/10 px-2 py-0.5 rounded-md shrink-0">
                  +5% Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
