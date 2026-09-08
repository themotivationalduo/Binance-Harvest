import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Landmark, Trophy, User, History, ShieldAlert } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'tiers' | 'treasury' | 'leaderboard' | 'wallet' | 'history' | 'help' | 'admin';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin?: boolean;
}

interface NavItem {
  id: ActiveTab;
  fullLabel: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, isAdmin }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let ticking = false;
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          // When scrolling is detected, hide floating bar
          if (Math.abs(currentScrollY - lastScrollY) > 6) {
            setIsVisible(false);
          }
          lastScrollY = currentScrollY;

          // When scrolling stops, reveal bar with smooth transition
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          timeoutId = setTimeout(() => {
            setIsVisible(true);
          }, 180);

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const navItems: NavItem[] = [
    { id: 'dashboard', fullLabel: 'Mining', shortLabel: 'Mine', icon: Cpu },
    { id: 'tiers', fullLabel: 'Tiers', shortLabel: 'Tier', icon: Zap },
    { id: 'treasury', fullLabel: 'Treasury', shortLabel: 'Treas', icon: Landmark },
    { id: 'leaderboard', fullLabel: 'Leaderboard', shortLabel: 'Rank', icon: Trophy },
    { id: 'history', fullLabel: 'Audit', shortLabel: 'Audit', icon: History },
    { id: 'wallet', fullLabel: 'Wallet', shortLabel: 'Wallet', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', fullLabel: 'Admin', shortLabel: 'Admin', icon: ShieldAlert });
  }

  return (
    <div
      id="bottom-navigation-bar"
      className={`fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[96vw] sm:max-w-fit px-1 sm:px-0 transition-all duration-300 ease-out transform-gpu will-change-transform ${
        isVisible 
          ? 'translate-y-0 opacity-100 pointer-events-auto' 
          : 'translate-y-24 sm:translate-y-28 opacity-0 pointer-events-none'
      }`}
    >
      <nav 
        id="bottom-navigation-container"
        className="relative flex items-center justify-around sm:justify-center gap-1 sm:gap-2.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-full bg-[#0B0E14]/90 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.25)]"
      >
        {/* Specular Mirror Glass sheen reflection */}
        <div className="absolute top-0 left-0 right-0 h-[35%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-2xl sm:rounded-t-full" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={item.fullLabel}
              aria-label={item.fullLabel}
              className={`relative flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-xl sm:rounded-2xl transition-all duration-200 shrink-0 cursor-pointer select-none group min-w-[44px] xs:min-w-[48px] sm:min-w-[62px] ${
                isActive
                  ? 'bg-gradient-to-b from-[#F3BA2F]/25 to-amber-500/10 border border-[#F3BA2F]/60 text-amber-300 shadow-[0_0_16px_rgba(243,186,47,0.3)] font-bold'
                  : 'bg-transparent border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {/* Icon Container */}
              <div 
                className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-tr from-[#F0B90B] to-amber-300 text-black shadow-md scale-105' 
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              </div>

              {/* Navigation Label with Adaptive Abbreviation */}
              <span 
                className={`text-[9px] xs:text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5 truncate max-w-[52px] sm:max-w-none text-center ${
                  isActive ? 'text-amber-300 font-bold' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {/* Abbreviated label on mobile to prevent overlapping */}
                <span className="sm:hidden">{item.shortLabel}</span>
                {/* Full label on tablet and desktop */}
                <span className="hidden sm:inline">{item.fullLabel}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
