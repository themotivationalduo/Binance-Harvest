import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Zap, 
  Users, 
  Crown, 
  Sparkles, 
  Flame, 
  UserCheck, 
  Shield, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  TrendingUp, 
  Award,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, REFERRAL_MILESTONES, ReferralMilestone } from '../types';
import { getTopReferrersLeaderboard, TopReferrerItem, getMilestoneForReferrals } from '../services/firebase';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';

interface LeaderboardViewProps {
  user: UserProfile;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'referrers' | 'miners'>('referrers');
  const [topReferrers, setTopReferrers] = useState<TopReferrerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { showSuccess } = useInitiativeFeedback();

  const userReferralCount = Number(user.referralCount ?? (user.referredUsers ? user.referredUsers.length : 0));
  const userBoostPercent = (userReferralCount * 5) + (user.referredBy ? 5 : 0);
  const currentMilestone = getMilestoneForReferrals(userReferralCount);

  // Find next milestone
  const nextMilestone = [...REFERRAL_MILESTONES]
    .reverse()
    .find(m => m.minReferrals > userReferralCount);

  const fetchReferrers = async (manual = false) => {
    try {
      setLoading(true);
      const data = await getTopReferrersLeaderboard(user.walletAddress);
      setTopReferrers(data);
      if (manual) {
        showSuccess({
          initiativeName: 'Syndicate Leaderboard',
          title: 'Leaderboard Synchronized',
          badge: 'Live Rankings',
          description: 'Refreshed global BSC referral metrics and syndicate speed milestones.',
        });
      }
    } catch (e) {
      console.error("Failed to fetch top referrers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrers(false);
  }, [user.walletAddress, user.referralCount]);

  const copyReferralLink = () => {
    const origin = window.location.origin;
    const link = `${origin}/?ref=${user.walletAddress}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showSuccess({
      initiativeName: 'Referral Link',
      title: 'Link Copied!',
      badge: '+5% Per Invite',
      description: 'Share your BEP-20 link. Both you and your referee get an instant +5% mining speed boost.',
    });
  };

  const topMiners = [
    { rank: 1, address: '0x3F7159c2980757d54b8e21D09A87C3e309738a29', tier: 6, bhft: 485.00, usdEarned: '$242.50 USD', hashrate: '12.8 GH/s' },
    { rank: 2, address: '0x8B228f447A9c1482E2b152DcA7f6775678681c40', tier: 5, bhft: 312.00, usdEarned: '$156.00 USD', hashrate: '9.4 GH/s' },
    { rank: 3, address: '0x9E10fbc286c478413AcE2e15A9e9A6b2F4f74f77', tier: 5, bhft: 298.50, usdEarned: '$149.25 USD', hashrate: '8.9 GH/s' },
    { 
      rank: 4, 
      address: user.walletAddress ? `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}` : '0xYOUR...WALLET', 
      tier: user.currentTier, 
      bhft: user.miningBalance || 0, 
      usdEarned: `$${((user.miningBalance || 0) * 0.5).toFixed(2)} USD`, 
      hashrate: `${(user.currentTier * 1.5).toFixed(1)} GH/s`,
      isYou: true 
    },
    { rank: 5, address: '0x1C497c36F32eDa462208E776F6D4164b3E489d88', tier: 4, bhft: 154.00, usdEarned: '$77.00 USD', hashrate: '5.2 GH/s' },
    { rank: 6, address: '0x7A82d2C7e80D3A635dF756475685B5b38F243b12', tier: 3, bhft: 89.00, usdEarned: '$44.50 USD', hashrate: '3.6 GH/s' },
  ];

  // Helper for milestone badge UI
  const renderMilestoneBadge = (milestone: ReferralMilestone, size: 'sm' | 'md' = 'sm') => {
    const isDiamond = milestone.badge === 'DIAMOND';
    const isGold = milestone.badge === 'GOLD';
    const isSilver = milestone.badge === 'SILVER';
    const isBronze = milestone.badge === 'BRONZE';

    let bgStyle = 'bg-slate-800 text-slate-300 border-slate-700';
    let icon = <Shield className="w-3.5 h-3.5" />;

    if (isDiamond) {
      bgStyle = 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20';
      icon = <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />;
    } else if (isGold) {
      bgStyle = 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20';
      icon = <Crown className="w-3.5 h-3.5 text-amber-400" />;
    } else if (isSilver) {
      bgStyle = 'bg-gradient-to-r from-slate-400/20 to-slate-300/20 text-slate-200 border-slate-400/40';
      icon = <Zap className="w-3.5 h-3.5 text-slate-300" />;
    } else if (isBronze) {
      bgStyle = 'bg-gradient-to-r from-orange-500/20 to-amber-700/20 text-orange-300 border-orange-500/40';
      icon = <Flame className="w-3.5 h-3.5 text-orange-400" />;
    } else if (milestone.badge === 'STARTER') {
      bgStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      icon = <UserCheck className="w-3.5 h-3.5 text-emerald-400" />;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border ${bgStyle} ${size === 'md' ? 'text-xs px-3 py-1.5' : 'text-[11px]'}`}>
        {icon}
        <span>{milestone.name}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-36 sm:pb-40 max-w-7xl mx-auto px-4 pt-6 overflow-y-auto">
      
      {/* Header Banner with Glassmorphism */}
      <div className="relative rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-gradient-to-br from-amber-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-72 h-72 bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Global Rankings & Hall of Fame
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                BEP-20 Network Verified
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              BinanceHarvest Leaderboards
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Real-time rankings for top syndicates and miners across the Binance Smart Chain. Climb the ranks to unlock permanent speed multipliers!
            </p>
          </div>

          {/* Quick Action / Refresh */}
          <div className="flex items-center gap-3 self-start md:self-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchReferrers(true)}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer backdrop-blur-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh Ledger</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyReferralLink}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Share Your Link'}</span>
            </motion.button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('referrers')}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'referrers'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-100'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Top Referrers & Syndicates</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'referrers' ? 'bg-slate-950/30 text-slate-900' : 'bg-amber-500/20 text-amber-300'
            }`}>
              Top 10
            </span>
          </button>

          <button
            onClick={() => setActiveTab('miners')}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'miners'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-100'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Top BHFT Miners</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'miners' ? 'bg-slate-950/30 text-slate-900' : 'bg-white/10 text-slate-300'
            }`}>
              Hash Output
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'referrers' ? (
          <motion.div
            key="referrers-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* User Syndicate Status Card */}
            <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-amber-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Milestone & Rank */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                    <Crown className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Your Syndicate Standing</div>
                    <div className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                      <span>{userReferralCount} Referees</span>
                      {renderMilestoneBadge(currentMilestone)}
                    </div>
                    <div className="text-xs text-amber-400/90 font-mono mt-0.5">
                      Active Boost: +{userBoostPercent}% Hash Rate
                    </div>
                  </div>
                </div>

                {/* Progress to Next Milestone */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">
                      {nextMilestone ? `Next Tier: ${nextMilestone.name}` : 'Highest Tier Reached!'}
                    </span>
                    <span className="font-bold text-amber-300 font-mono">
                      {nextMilestone 
                        ? `${userReferralCount} / ${nextMilestone.minReferrals} Referees` 
                        : '+250% Max Boost'}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-sm"
                      style={{ 
                        width: nextMilestone 
                          ? `${Math.min(100, Math.max(5, (userReferralCount / nextMilestone.minReferrals) * 100))}%` 
                          : '100%' 
                      }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-amber-400" />
                    <span>
                      {nextMilestone 
                        ? `Invite ${nextMilestone.minReferrals - userReferralCount} more to unlock +${nextMilestone.boostPercent}% speed milestone`
                        : 'You are leading at the maximum syndicate tier!'}
                    </span>
                  </div>
                </div>

                {/* Share Link button */}
                <div className="flex md:justify-end">
                  <button
                    onClick={copyReferralLink}
                    className="w-full md:w-auto px-5 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Copy My Referral Code</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Top 10 Referrers Table */}
            <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span>Top 10 Referral Champions</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ranked by total successful BSC invites and active hashpower syndicate speed
                  </p>
                </div>

                <div className="text-xs text-slate-400 font-mono bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/5 self-start sm:self-auto">
                  Updated Live (BEP-20)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-white/5">
                      <th className="py-4 px-4 sm:px-6">Rank</th>
                      <th className="py-4 px-4 sm:px-6">Referrer Address</th>
                      <th className="py-4 px-4 sm:px-6">Total Referrals</th>
                      <th className="py-4 px-4 sm:px-6">Milestone Rank</th>
                      <th className="py-4 px-4 sm:px-6">Hash Speed Boost</th>
                      <th className="py-4 px-4 sm:px-6 text-right">Syndicate Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-2" />
                          Synchronizing Top Referrers...
                        </td>
                      </tr>
                    ) : topReferrers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                          No referral records discovered yet. Be the first to invite!
                        </td>
                      </tr>
                    ) : (
                      topReferrers.map((item) => {
                        const isFirst = item.rank === 1;
                        const isSecond = item.rank === 2;
                        const isThird = item.rank === 3;

                        return (
                          <tr
                            key={item.address}
                            className={`transition-colors ${
                              item.isYou
                                ? 'bg-amber-500/15 font-semibold hover:bg-amber-500/20'
                                : 'hover:bg-white/5'
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-2">
                                {isFirst && (
                                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 font-extrabold text-xs shadow-sm shadow-amber-500/20">
                                    <Crown className="w-4 h-4 text-amber-400" />
                                  </div>
                                )}
                                {isSecond && (
                                  <div className="w-7 h-7 rounded-xl bg-slate-300/20 border border-slate-300/40 flex items-center justify-center text-slate-200 font-extrabold text-xs">
                                    <Trophy className="w-3.5 h-3.5 text-slate-300" />
                                  </div>
                                )}
                                {isThird && (
                                  <div className="w-7 h-7 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-300 font-extrabold text-xs">
                                    <Award className="w-3.5 h-3.5 text-orange-400" />
                                  </div>
                                )}
                                {!isFirst && !isSecond && !isThird && (
                                  <span className="font-mono font-bold text-slate-400 text-sm pl-2">
                                    #{item.rank}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Referrer Address */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`https://bscscan.com/address/${item.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-slate-200 hover:text-amber-300 transition flex items-center gap-1.5"
                                  title="View wallet on BscScan"
                                >
                                  <span>{item.address.substring(0, 6)}...{item.address.substring(item.address.length - 4)}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-500 hover:text-amber-300" />
                                </a>

                                {item.isYou && (
                                  <span className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-2 py-0.5 rounded-full font-extrabold shadow-sm">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Total Referrals */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white font-mono text-sm">
                                  {item.referralCount}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {item.referralCount === 1 ? 'Miner' : 'Miners'}
                                </span>
                              </div>
                            </td>

                            {/* Milestone Rank Indicator */}
                            <td className="py-4 px-4 sm:px-6">
                              {renderMilestoneBadge(item.milestone)}
                            </td>

                            {/* Hash Speed Boost */}
                            <td className="py-4 px-4 sm:px-6">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                                +{item.boostPercent}% Speed
                              </span>
                            </td>

                            {/* Estimated Total Syndicate Yield */}
                            <td className="py-4 px-4 sm:px-6 text-right font-mono font-bold text-amber-400 text-sm">
                              ${item.totalEstimatedEarnedUSD.toFixed(2)} USD
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Milestone Speed Ladder Info Grid */}
            <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Referral Speed Milestone Ladder</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Every invite permanently accelerates your daily BHFT cloud output by +5%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {REFERRAL_MILESTONES.map((milestone) => {
                  const isCurrent = currentMilestone.badge === milestone.badge;
                  return (
                    <div
                      key={milestone.name}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10 scale-[1.02]'
                          : 'bg-slate-900/40 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {renderMilestoneBadge(milestone, 'sm')}
                        <span className="text-[11px] font-mono text-slate-400">
                          {milestone.minReferrals}+ invites
                        </span>
                      </div>

                      <div className="text-sm font-extrabold text-white mt-1">
                        +{milestone.boostPercent}% Mining Speed
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        {milestone.description}
                      </p>

                      {isCurrent && (
                        <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[10px] text-amber-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Current Milestone
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Top Miners Tab */
          <motion.div
            key="miners-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl"
          >
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Top BHFT Cloud Miners</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ranked by verified on-chain mined BHFT and active node hardware tier
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-white/5">
                    <th className="py-4 px-6">Rank</th>
                    <th className="py-4 px-6">Miner Address</th>
                    <th className="py-4 px-6">Hardware Tier</th>
                    <th className="py-4 px-6">Estimated Hashrate</th>
                    <th className="py-4 px-6">Mined BHFT</th>
                    <th className="py-4 px-6 text-right">Pegged USD Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topMiners.map((m) => (
                    <tr
                      key={m.rank}
                      className={`transition-colors ${
                        m.isYou ? 'bg-amber-500/15 font-semibold hover:bg-amber-500/20' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-bold text-amber-400">
                        #{m.rank}
                      </td>
                      <td className="py-4 px-6 font-mono text-white flex items-center gap-2">
                        <span>{m.address}</span>
                        {m.isYou && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-slate-200 border border-white/10 font-medium">
                          Tier {m.tier}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-300 text-xs">
                        {m.hashrate}
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-200 font-bold">
                        {m.bhft.toFixed(2)} BHFT
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-amber-400 font-bold">
                        {m.usdEarned}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
