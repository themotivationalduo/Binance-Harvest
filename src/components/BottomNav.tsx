import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Landmark, Trophy, User, History, HelpCircle, ShieldAlert } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'tiers' | 'treasury' | 'leaderboard' | 'wallet' | 'history' | 'help' | 'admin';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, isAdmin }) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Mining', icon: Cpu },
    { id: 'tiers' as ActiveTab, label: 'Tiers', icon: Zap },
    { id: 'treasury' as ActiveTab, label: 'Treasury', icon: Landmark },
    { id: 'leaderboard' as ActiveTab, label: 'Ranks', icon: Trophy },
    { id: 'history' as ActiveTab, label: 'Audit', icon: History },
    { id: 'wallet' as ActiveTab, label: 'Wallet', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin' as ActiveTab, label: 'Admin', icon: ShieldAlert });
  }

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[96vw] transition-all duration-300 transform translate-y-0 opacity-100 pointer-events-auto"
    >
      <nav className="flex items-center justify-between w-full sm:justify-center sm:gap-4 overflow-hidden py-2 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`flex items-center justify-center w-[12vw] h-[12vw] max-w-[56px] max-h-[56px] sm:w-14 sm:h-14 rounded-full border shadow-lg backdrop-blur-xl transition-all duration-300 shrink-0 ${
                isActive
                  ? 'bg-[#F3BA2F] border-[#F3BA2F] text-black shadow-[#F3BA2F]/30 scale-[1.15]'
                  : 'bg-[#1E2329]/90 border-white/20 text-[#848E9C] hover:text-white hover:border-white/40 hover:bg-[#1E2329]'
              }`}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isActive ? 'text-black' : 'text-[#F3BA2F]'}`} />
            </button>
          );
        })}
      </nav>
    </div>
  );
};



