import { UserProfile, TransactionRecord } from '../types';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name or emoji
  color: string;
}

export const ACHIEVEMENTS_DATA: Achievement[] = [
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Joined the platform in its early stages.',
    icon: '🐣',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  },
  {
    id: 'diamond_hands',
    title: 'Diamond Hands',
    description: 'Accumulated over 100,000 Points.',
    icon: '💎',
    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
  },
  {
    id: 'whale_miner',
    title: 'Whale Miner',
    description: 'Accumulated over 1,000,000 Points.',
    icon: '🐋',
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  },
  {
    id: 'streak_master',
    title: 'Streak Master',
    description: 'Maintained a 7-day login streak.',
    icon: '🔥',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
  },
  {
    id: 'dedication',
    title: 'Pure Dedication',
    description: 'Maintained a 30-day login streak.',
    icon: '🏆',
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20'
  },
  {
    id: 'first_blood',
    title: 'First Withdrawal',
    description: 'Successfully verified account for treasury settlement.',
    icon: '🏦',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
  },
  {
    id: 'rig_commander',
    title: 'Rig Commander',
    description: 'Upgraded to Tier 3 or higher.',
    icon: '⚡',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
  }
];

export function evaluateAchievements(user: UserProfile, transactions: TransactionRecord[] = []): string[] {
  const unlocked = new Set<string>();

  unlocked.add('early_bird');

  if (user.totalPoints >= 100000) unlocked.add('diamond_hands');
  if (user.totalPoints >= 1000000) unlocked.add('whale_miner');

  if (user.loginStreak >= 7) unlocked.add('streak_master');
  if (user.loginStreak >= 30) unlocked.add('dedication');

  const hasWithdrawal = transactions.some(tx => tx.type === 'WITHDRAW_FEE' && tx.status === 'SUCCESS');
  if (hasWithdrawal || user.withdrawalStatus !== 'NOT_STARTED') {
    unlocked.add('first_blood');
  }

  if (user.currentTier >= 3) {
    unlocked.add('rig_commander');
  }

  return Array.from(unlocked);
}
