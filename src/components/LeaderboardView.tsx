import React from 'react';
import { Trophy, Zap, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface LeaderboardViewProps {
  user: UserProfile;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user }) => {
  const topMiners = [
    { rank: 1, address: '0x3F71...8a29', tier: 6, bhft: 485.00, usdEarned: '$242.50 USD' },
    { rank: 2, address: '0x8B22...1c40', tier: 5, bhft: 312.00, usdEarned: '$156.00 USD' },
    { rank: 3, address: '0x9E10...4f77', tier: 5, bhft: 298.50, usdEarned: '$149.25 USD' },
    { rank: 4, address: user.walletAddress ? `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}` : '0xYOUR...WALLET', tier: user.currentTier, bhft: user.miningBalance || 0, usdEarned: `$${((user.miningBalance || 0) * 0.5).toFixed(2)} USD`, isYou: true },
    { rank: 5, address: '0x1C49...9d88', tier: 4, bhft: 154.00, usdEarned: '$77.00 USD' },
    { rank: 6, address: '0x7A82...3b12', tier: 3, bhft: 89.00, usdEarned: '$44.50 USD' },
  ];

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-6">
      
      {/* Header */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Global Leaderboard
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Top BinanceHarvest Miners
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Rankings are updated in real-time across Binance Smart Chain nodes based on verified mining output and active tiers.
        </p>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 bg-white/5">
                <th className="py-4 px-6">Rank</th>
                <th className="py-4 px-6">Miner Address</th>
                <th className="py-4 px-6">Tier</th>
                <th className="py-4 px-6">Mined BHFT</th>
                <th className="py-4 px-6 text-right">Pegged USD Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topMiners.map((m) => (
                <tr
                  key={m.rank}
                  className={`transition-colors ${
                    m.isYou ? 'bg-amber-500/10 font-semibold' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="py-4 px-6 font-mono font-bold text-amber-400">
                    #{m.rank}
                  </td>
                  <td className="py-4 px-6 font-mono text-white flex items-center gap-2">
                    {m.address}
                    {m.isYou && (
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-slate-200 border border-white/10">
                      Tier {m.tier}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-200">
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
      </div>

    </div>
  );
};
