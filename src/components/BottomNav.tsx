import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Landmark, Trophy, User, History, HelpCircle } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'tiers' | 'treasury' | 'leaderboard' | 'profile' | 'history' | 'help';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let scrollTimeout: any = null;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsVisible(true);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [lastScrollY]);

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Mining', icon: Cpu },
    { id: 'tiers' as ActiveTab, label: 'Tiers', icon: Zap },
    { id: 'treasury' as ActiveTab, label: 'Treasury', icon: Landmark },
    { id: 'leaderboard' as ActiveTab, label: 'Ranks', icon: Trophy },
    { id: 'history' as ActiveTab, label: 'Audit', icon: History },
    { id: 'help' as ActiveTab, label: 'Help', icon: HelpCircle },
    { id: 'profile' as ActiveTab, label: 'Wallet', icon: User },
  ];

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[96vw] transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}
    >
      <nav className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl bg-[#1E2329]/80 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] ring-1 ring-white/10 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? 'bg-[#F3BA2F] text-black shadow-lg shadow-[#F3BA2F]/25 scale-105 font-bold'
                  : 'text-[#848E9C] hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-[#F3BA2F]'}`} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};



