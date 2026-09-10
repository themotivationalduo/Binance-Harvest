import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { updateUserProfileFields } from '../services/firebase';
import { triggerStreakRewardConfetti } from '../utils/confetti';
import { 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Gift, 
  Lock, 
  Coins, 
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface DailyLoginStreakProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void | Promise<void>;
}

// Escalating 7-day milestone ladder starting from 100 points
export const STREAK_REWARDS_7DAY = [
  { day: 1, points: 100, label: 'Day 1', highlight: false },
  { day: 2, points: 200, label: 'Day 2', highlight: false },
  { day: 3, points: 350, label: 'Day 3', highlight: false },
  { day: 4, points: 500, label: 'Day 4', highlight: false },
  { day: 5, points: 750, label: 'Day 5', highlight: false },
  { day: 6, points: 1000, label: 'Day 6', highlight: false },
  { day: 7, points: 1500, label: 'Day 7 Jackpot', highlight: true },
];

export function getStreakRewardPoints(streakDay: number): number {
  if (streakDay <= 0) return 100;
  if (streakDay <= 7) {
    return STREAK_REWARDS_7DAY[streakDay - 1].points;
  }
  // Continues scaling for veterans beyond day 7
  return 1500 + (streakDay - 7) * 100;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DailyLoginStreak: React.FC<DailyLoginStreakProps> = ({ user, onUpdateUser }) => {
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [isClaiming, setIsClaiming] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

  const lastClaimMs = useMemo(() => {
    if (!user.lastStreakClaimDate) return 0;
    const date = user.lastStreakClaimDate.includes('T') 
      ? new Date(user.lastStreakClaimDate)
      : new Date(user.lastStreakClaimDate + 'T00:00:00Z');
    return date.getTime();
  }, [user.lastStreakClaimDate]);

  const timeSinceLastClaimMs = nowMs - lastClaimMs;
  const alreadyClaimedToday = lastClaimMs !== 0 && timeSinceLastClaimMs < ONE_DAY_MS;
  const isConsecutive = lastClaimMs !== 0 && timeSinceLastClaimMs < TWO_DAYS_MS;

  const timeUntilReset = useMemo(() => {
    if (!alreadyClaimedToday) return '00:00:00';
    const diff = ONE_DAY_MS - timeSinceLastClaimMs;
    if (diff <= 0) return '00:00:00';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [alreadyClaimedToday, timeSinceLastClaimMs]);

  // Next streak level to be claimed
  const targetStreak = useMemo(() => {
    if (alreadyClaimedToday) {
      return user.loginStreak || 1;
    }
    if (isConsecutive) {
      return (user.loginStreak || 0) + 1;
    }
    // If not claimed yesterday or today, resets to day 1
    return 1;
  }, [alreadyClaimedToday, isConsecutive, user.loginStreak]);

  const pointsToClaim = useMemo(() => {
    return getStreakRewardPoints(targetStreak);
  }, [targetStreak]);

  // Normalized 7-day cycle position for visual progress
  // E.g. streak 1 = cycle day 1, streak 7 = cycle day 7, streak 8 = cycle day 1
  const cycleDay = useMemo(() => {
    const s = user.loginStreak || 0;
    if (s === 0) return 0;
    const rem = s % 7;
    return rem === 0 ? 7 : rem;
  }, [user.loginStreak]);

  const handleClaimStreak = async () => {
    if (alreadyClaimedToday || isClaiming) return;

    try {
      setIsClaiming(true);

      const newStreak = isConsecutive ? (user.loginStreak || 0) + 1 : 1;
      const earnedBonus = getStreakRewardPoints(newStreak);
      const newTotalPoints = (user.totalPoints || 0) + earnedBonus;
      const newTotalStreakClaimed = (user.totalStreakPointsClaimed || 0) + earnedBonus;

      const userIdentifier = user.walletAddress || 'anonymous_miner';

      // Persist directly to Firestore
      const updatedFields: Partial<UserProfile> = {
        totalPoints: newTotalPoints,
        loginStreak: newStreak,
        lastStreakClaimDate: new Date().toISOString(),
        totalStreakPointsClaimed: newTotalStreakClaimed,
      };

      await updateUserProfileFields(userIdentifier, updatedFields);
      await onUpdateUser(updatedFields);

      // Trigger glorious streak celebration confetti
      triggerStreakRewardConfetti();

      // Trigger glorious success feedback animation
      showSuccess({
        initiativeName: 'Daily Mining Streak',
        title: `Day ${newStreak} Streak Claimed!`,
        badge: `+${earnedBonus.toLocaleString()} PTS`,
        description: `Consecutive visit streak verified! Your daily bonus of ${earnedBonus.toLocaleString()} mining points has been credited to your balance.`,
        details: [
          { label: 'Consecutive Streak', value: `Day ${newStreak} 🔥` },
          { label: 'Bonus Reward', value: `+${earnedBonus.toLocaleString()} PTS (≈ ${(earnedBonus / 500).toFixed(2)} BHFT ≈ $${(earnedBonus / 1000).toFixed(2)} USD)` },
          { label: 'New Total Balance', value: `${newTotalPoints.toLocaleString()} PTS` },
          { label: 'Next Reward Tomorrow', value: `+${getStreakRewardPoints(newStreak + 1).toLocaleString()} PTS` },
          { label: 'Cloud Storage', value: 'Saved to Secure Ledger' },
        ],
      });
    } catch (err: any) {
      console.error('Failed to claim streak:', err);
      const errMsg = err?.message || 'Network error saving daily streak. Please try again.';
      showFailed({
        initiativeName: 'Daily Mining Streak',
        title: 'Streak Claim Failed',
        description: errMsg,
        actionLabel: 'Retry Claim',
        onAction: () => handleClaimStreak(),
        details: [
          { label: 'Target Day', value: `Day ${targetStreak}` },
          { label: 'Points', value: `+${pointsToClaim.toLocaleString()} PTS` },
        ],
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-white/[0.01] p-5 sm:p-6 backdrop-blur-xl shadow-2xl shadow-black/40">
      {/* Mirror Glass Glow & Light Reflection */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-[#00C087]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Header Info */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-600/10 shadow-lg shadow-amber-500/20">
            <Flame className="h-6 w-6 text-[#F3BA2F] animate-pulse" />
            {(user.loginStreak || 0) > 0 && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F3BA2F] text-[10px] font-black text-black ring-2 ring-[#1E2329]">
                {user.loginStreak}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                Daily Mining Streak
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                <Flame className="h-3 w-3 fill-amber-400 text-amber-400" />
                {user.loginStreak || 0} Day{(user.loginStreak || 0) === 1 ? '' : 's'} Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Visit consecutively every day to collect escalating bonus points starting from <strong className="text-[#F3BA2F]">100 PTS</strong> up to <strong className="text-amber-400">1,500 PTS</strong>. Stored and synced in real-time.
            </p>
          </div>
        </div>

        {/* Streak Total Stats Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400">
              <Coins className="h-3.5 w-3.5 text-[#F3BA2F]" />
              <span>Streak Rewards</span>
            </div>
            <p className="text-sm font-bold text-white mono mt-0.5">
              +{(user.totalStreakPointsClaimed || 0).toLocaleString()} <span className="text-[10px] text-[#F3BA2F]">PTS</span>
            </p>
          </div>
        </div>
      </div>

      {/* 7-Day Visual Progression Track */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3 mb-6">
        {STREAK_REWARDS_7DAY.map((item) => {
          const isCurrentTarget = !alreadyClaimedToday && item.day === targetStreak;
          const isCompleted = alreadyClaimedToday
            ? cycleDay >= item.day
            : isConsecutive
            ? cycleDay >= item.day
            : false;
          const isJackpot = item.highlight;

          return (
            <motion.div
              key={item.day}
              whileHover={{ scale: 1.02 }}
              className={`relative flex flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all duration-200 backdrop-blur-md ${
                isCompleted
                  ? 'border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : isCurrentTarget
                  ? 'border-2 border-[#F3BA2F] bg-gradient-to-b from-[#F3BA2F]/20 to-amber-600/10 text-white shadow-lg shadow-[#F3BA2F]/25 ring-2 ring-[#F3BA2F]/30'
                  : 'border border-white/5 bg-black/20 text-slate-400 opacity-80'
              }`}
            >
              {/* Day Label & Status Icon */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[11px] font-bold tracking-wide">
                  {item.label}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : isCurrentTarget ? (
                  <Sparkles className="h-4 w-4 text-[#F3BA2F] animate-spin-slow shrink-0" />
                ) : isJackpot ? (
                  <Gift className="h-4 w-4 text-amber-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                )}
              </div>

              {/* Points Amount Badge */}
              <div className="mt-1">
                <span
                  className={`inline-block text-xs sm:text-sm font-black mono tracking-tight ${
                    isCompleted
                      ? 'text-emerald-300 line-through opacity-80'
                      : isCurrentTarget
                      ? 'text-[#F3BA2F] text-sm'
                      : isJackpot
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  +{item.points.toLocaleString()}
                </span>
                <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  Points
                </span>
              </div>

              {/* Status Tag */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                {isCompleted ? (
                  <span className="text-emerald-400 font-semibold">Claimed</span>
                ) : isCurrentTarget ? (
                  <span className="text-[#F3BA2F] font-black animate-pulse">Available</span>
                ) : (
                  <span className="text-slate-500 font-medium">Locked</span>
                )}
                {isJackpot && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                    Jackpot
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Claim Action Bar & Countdown */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-3 text-xs text-slate-300 w-full sm:w-auto">
          {alreadyClaimedToday ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-emerald-400">Claimed for today!</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Next reward unlocks in <strong className="text-white mono">{timeUntilReset}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-[#F3BA2F] border border-amber-500/30">
                <Gift className="h-4 w-4 animate-bounce" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  Today's Reward: <span className="text-[#F3BA2F]">+{pointsToClaim.toLocaleString()} Mining Points</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  {user.lastStreakClaimDate && !isConsecutive && !alreadyClaimedToday
                    ? 'Previous streak ended. Resetting to Day 1 start.'
                    : `Claim to secure your Day ${targetStreak} streak!`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Claim Button */}
        <div className="w-full sm:w-auto shrink-0">
          <motion.button
            whileHover={!alreadyClaimedToday && !isClaiming ? { scale: 1.03 } : {}}
            whileTap={!alreadyClaimedToday && !isClaiming ? { scale: 0.97 } : {}}
            onClick={handleClaimStreak}
            disabled={alreadyClaimedToday || isClaiming}
            className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition duration-200 cursor-pointer ${
              alreadyClaimedToday
                ? 'bg-white/5 border border-white/10 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-amber-400 text-slate-950 shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300'
            }`}
          >
            {isClaiming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Syncing Ledger...</span>
              </>
            ) : alreadyClaimedToday ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Streak Secured for Today</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-slate-950" />
                <span>Claim Day {targetStreak} Bonus (+{pointsToClaim.toLocaleString()} PTS)</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};
