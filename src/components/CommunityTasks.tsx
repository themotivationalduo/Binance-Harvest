import React, { useState } from 'react';
import { UserProfile } from '../types';
import { CheckCircle2, Loader2, Twitter, Send, Users, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { triggerMiningRewardConfetti } from '../utils/confetti';

interface CommunityTasksProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

const SOCIAL_TASKS = [
  {
    id: 'twitter_main',
    title: 'Follow on X (Twitter)',
    description: 'Follow @BINANCEHARVEST',
    reward: 1, // 1 BHFT
    link: 'https://x.com/BINANCEHARVEST',
    icon: Twitter,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20'
  },
  {
    id: 'twitter_backup',
    title: 'Follow Backup X',
    description: 'Follow @BINANCEHARVESTB',
    reward: 1,
    link: 'https://x.com/BINANCEHARVESTB',
    icon: Twitter,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20'
  },
  {
    id: 'telegram',
    title: 'Join Telegram',
    description: 'Join our official channel',
    reward: 1,
    link: 'https://t.me/binanceharvest',
    icon: Send,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  }
];

export const CommunityTasks: React.FC<CommunityTasksProps> = ({ user, onUpdateUser }) => {
  const { showSuccess } = useInitiativeFeedback();
  const completedTasks = user.completedSocialTasks || [];

  // Track which tasks the user has clicked "Go" on to show the "Claim" button
  const [visitedTasks, setVisitedTasks] = useState<string[]>([]);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  const handleVisit = (taskId: string, url: string) => {
    window.open(url, '_blank');
    if (!visitedTasks.includes(taskId)) {
      setVisitedTasks((prev) => [...prev, taskId]);
    }
  };

  const handleClaim = (task: typeof SOCIAL_TASKS[0]) => {
    setIsClaiming(task.id);
    
    setTimeout(() => {
      const newCompleted = [...completedTasks, task.id];
      const newBalance = (user.miningBalance || 0) + task.reward;
      const newTotalPoints = (user.totalPoints || 0) + (task.reward * 500); // 1 BHFT = 500 PTS
      
      onUpdateUser({
        completedSocialTasks: newCompleted,
        miningBalance: newBalance,
        totalPoints: newTotalPoints
      });

      setIsClaiming(null);
      triggerMiningRewardConfetti();
      showSuccess({
        initiativeName: 'Community Airdrop',
        title: 'Task Completed!',
        badge: `+${task.reward} BHFT`,
        description: `Thank you for completing the ${task.title} task. You have been rewarded with ${task.reward} BHFT directly to your balance.`,
      });
    }, 800);
  };

  return (
    <div className="bg-[#1E2329]/80 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 lg:p-8 mb-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Users className="w-48 h-48 text-[#F3BA2F]" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
            Community Airdrop Tasks
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Support the growth of the BinanceHarvest network and earn instant BHFT airdrops directly to your mining balance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {SOCIAL_TASKS.map((task) => {
          const isCompleted = completedTasks.includes(task.id);
          const isVisited = visitedTasks.includes(task.id);
          const Icon = task.icon;

          return (
            <div key={task.id} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-black/40 border-white/10'} flex flex-col justify-between transition-all duration-300`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : task.bg + ' ' + task.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    +{task.reward} BHFT
                  </div>
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{task.title}</h3>
                <p className="text-xs text-slate-400 mb-4">{task.description}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-white/5">
                {isCompleted ? (
                  <button disabled className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Completed & Claimed</span>
                  </button>
                ) : isVisited ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleClaim(task)}
                    disabled={isClaiming === task.id}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-[#F3BA2F]/20"
                  >
                    {isClaiming === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <span>Verify & Claim BHFT</span>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleVisit(task.id, task.link)}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <span>Complete Task</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </motion.button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
