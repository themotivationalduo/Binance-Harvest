import React, { useState } from 'react';
import { UserProfile, TierInfo, ALL_TIERS } from '../types';
import { Zap, ShieldCheck, CheckCircle2, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { sendBNBTransaction, switchToBSC, getOrInitSigner } from '../services/web3';
import { addTransactionRecord } from '../services/firebase';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { sendPushNotification } from '../services/notifications';
import { parseWeb3Error } from '../utils/errorParser';

interface TiersViewProps {
  user: UserProfile;
  bnbPrice: number;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

export const TiersView: React.FC<TiersViewProps> = ({ user, bnbPrice, onUpdateUser }) => {
  const [upgradingTier, setUpgradingTier] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { showSuccess, showFailed } = useInitiativeFeedback();

  const handleUpgrade = async (targetTier: number) => {
    setMessage(null);
    const targetTierInfo = ALL_TIERS.find((t) => t.tier === targetTier);

    if (!targetTierInfo) return;

    if (targetTier !== user.currentTier + 1) {
      const err = 'You must upgrade tiers sequentially.';
      setMessage({ type: 'error', text: err });
      showFailed({
        initiativeName: 'Tier Upgrade Protocol',
        title: 'Sequential Upgrade Required',
        badge: `Active: Tier ${user.currentTier}`,
        description: `Mining rigs must be upgraded in order. Please upgrade to Tier ${user.currentTier + 1} to unlock subsequent power levels.`,
        details: [
          { label: 'Current Tier', value: `Tier ${user.currentTier}` },
          { label: 'Required Next Tier', value: `Tier ${user.currentTier + 1}` },
        ],
      });
      return;
    }

    if (!user.walletAddress) {
      const err = 'Please connect your MetaMask wallet first.';
      setMessage({ type: 'error', text: err });
      showFailed({
        initiativeName: 'Tier Upgrade Protocol',
        title: 'MetaMask Wallet Required',
        description: 'You must connect your Binance Smart Chain Web3 wallet before initiating an on-chain upgrade transaction.',
        actionLabel: 'Connect Wallet',
      });
      return;
    }

    const costUSD = targetTierInfo.upgradeCostUSD;

    try {
      setUpgradingTier(targetTier);
      let signer: ethers.Signer | null = null;
      try {
        signer = await getOrInitSigner();
      } catch (e) {
        console.warn("Could not get signer, using verified transaction mode:", e);
      }

      // Dynamic USD upgrade fee sent to Treasury Wallet
      const { txHash } = await sendBNBTransaction(signer, costUSD, bnbPrice);
      const bnbAmount = Number((costUSD / (bnbPrice || 600)).toFixed(5));

      // Record transaction in audit history
      await addTransactionRecord(user.email || user.walletAddress, {
        type: 'UPGRADE',
        amountBNB: bnbAmount,
        amountUSD: costUSD,
        txHash: txHash,
        status: 'SUCCESS',
      });

      // Success -> Increment tier
      await onUpdateUser({
        currentTier: targetTier,
      });

      sendPushNotification("Mining Rig Upgraded! 🚀", {
        body: `Congratulations! Your cloud miner upgraded to ${targetTierInfo?.name || `Tier ${targetTier}`}. Your daily points are now doubled!`,
      });

      const succ = `Successfully upgraded to Tier ${targetTier}! TxHash: ${txHash.substring(0, 10)}...`;
      setMessage({
        type: 'success',
        text: succ,
      });
      setUpgradingTier(null);

      // Trigger glorious Success Animation
      showSuccess({
        initiativeName: 'Mining Rig Activation',
        title: `Tier ${targetTier} Activated!`,
        badge: `Tier ${targetTier}`,
        description: `Congratulations! Your cloud mining power has doubled. Your daily yield is now ${(targetTierInfo?.bhftPerDay || 0).toFixed(2)} BHFT per day!`,
        txHash: txHash,
        details: [
          { label: 'Upgraded Rig', value: targetTierInfo?.name || `Tier ${targetTier}` },
          { label: 'Upgrade Cost', value: `$${costUSD.toFixed(2)} USD (${bnbAmount} BNB)` },
          { label: 'New Daily Yield', value: `${(targetTierInfo?.bhftPerDay || 0).toFixed(2)} BHFT/day` },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
        ],
      });
    } catch (err: any) {
      console.error("Upgrade error:", err);
      const parsed = parseWeb3Error(err);
      setMessage({
        type: 'error',
        text: parsed.message,
      });
      setUpgradingTier(null);

      // Trigger Failed Animation
      showFailed({
        initiativeName: 'Tier Upgrade Protocol',
        title: parsed.title,
        badge: 'Upgrade Failed',
        description: parsed.message,
        requirements: parsed.requirements,
        rawDetails: parsed.rawDetails,
        actionLabel: parsed.actionLabel,
        onAction: parsed.suggestedAction === 'switch_network' ? async () => {
          await switchToBSC();
        } : () => handleUpgrade(targetTier),
        details: [
          { label: 'Target Rig', value: targetTierInfo?.name || `Tier ${targetTier}` },
          { label: 'Required Fee', value: `$${costUSD.toFixed(2)} USD (${(costUSD / bnbPrice).toFixed(5)} BNB)` },
          { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
        ],
      });
    }
  };

  return (
    <div className="space-y-6 pb-36 sm:pb-40 max-w-7xl mx-auto px-4 pt-6 overflow-y-auto">
      
      {/* Header */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            Mining Rig Tiers
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Upgrade Mining Power
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upgrade your mining tier sequentially up to <strong className="text-amber-400">Tier 20</strong> to dramatically boost your daily BHFT output.
        </p>
      </div>

      {/* Inline Notifications */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={
              message.type === 'success'
                ? { opacity: 1, y: 0 }
                : { opacity: 1, x: [-8, 8, -6, 6, -3, 3, 0] }
            }
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className={`p-4 rounded-2xl border text-sm flex items-center gap-3 shadow-lg backdrop-blur-md ${
              message.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-emerald-500/10'
                : 'bg-red-500/15 border-red-500/30 text-red-300 shadow-red-500/10'
            }`}
          >
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_TIERS.map((t) => {
          const isCurrent = user.currentTier === t.tier;
          const isUnlocked = user.currentTier >= t.tier;
          const isNext = t.tier === user.currentTier + 1;
          const costInBNB = t.upgradeCostUSD / bnbPrice;

          return (
            <div
              key={t.tier}
              className={`relative rounded-3xl backdrop-blur-xl border p-6 flex flex-col justify-between transition-all duration-300 ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-2xl shadow-amber-500/10'
                  : 'bg-slate-900/60 border-white/10 hover:border-white/20'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                  Active Tier
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 font-black text-lg">
                    T{t.tier}
                  </div>
                  <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded-full text-slate-300 border border-white/5">
                    {t.multiplier} Output
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{t.name}</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Generates <strong className="text-amber-400">{(t.bhftPerDay || 0).toFixed(2)} BHFT</strong> every 24 hours.
                </p>

                <div className="space-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Weekly Yield:</span>
                    <strong className="text-[#00C087] font-bold font-mono">${t.weeklyYieldUSD.toFixed(2)} USD / week</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Upgrade Fee:</span>
                    <span className="font-mono text-amber-400 font-bold">{t.upgradeCostUSD === 0 ? '0 BNB' : `${costInBNB.toFixed(5)} BNB`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiat Equivalent:</span>
                    <span className="font-mono text-slate-400">{t.upgradeCostUSD === 0 ? 'FREE (Start)' : `≈ $${t.upgradeCostUSD.toFixed(2)} USD`}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                {isUnlocked ? (
                  <div className="w-full py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold text-center text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Unlocked</span>
                  </div>
                ) : isNext ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleUpgrade(t.tier)}
                    disabled={upgradingTier !== null}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition disabled:opacity-50 cursor-pointer"
                  >
                    {upgradingTier === t.tier ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Signing on BSC ({costInBNB.toFixed(5)} BNB)...</span>
                      </>
                    ) : (
                      <>
                        <span>Upgrade Now ({costInBNB.toFixed(5)} BNB)</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="w-full py-3 rounded-2xl bg-slate-800/50 border border-white/5 text-slate-500 font-medium text-center text-sm">
                    Upgrade previous tier first
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
