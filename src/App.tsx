import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { BottomNav, ActiveTab } from './components/BottomNav';
import { TabSkeleton } from './components/TabSkeleton';
import { UserProfile, ADMIN_WALLETS } from './types';
import { fetchLiveBNBPrice, connectWallet, disconnectWallet, reconnectExistingWallet, getRealWalletBalance, TREASURY_WALLET } from './services/web3';
import { getUserProfile, updateUserProfileFields, subscribeToUserProfile } from './services/firebase';
import { useInitiativeFeedback } from './context/InitiativeFeedbackContext';
import { resolveInitialRoute, VALID_TABS } from './utils/referral';
import { getStoredTheme, applyTheme } from './utils/theme';
import { clearTonWalletSession } from './services/tonWallet';

// Dynamic lazy imports for ultra-fast bundle size & instant initial paint
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TiersView = lazy(() => import('./components/TiersView').then(m => ({ default: m.TiersView })));
const TreasuryView = lazy(() => import('./components/TreasuryView').then(m => ({ default: m.TreasuryView })));
const LeaderboardView = lazy(() => import('./components/LeaderboardView').then(m => ({ default: m.LeaderboardView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const TransactionHistory = lazy(() => import('./components/TransactionHistory').then(m => ({ default: m.TransactionHistory })));
const HelpView = lazy(() => import('./components/HelpView').then(m => ({ default: m.HelpView })));
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const routeInfo = resolveInitialRoute();
    return routeInfo.activeTab;
  });
  const [pendingReferralCode, setPendingReferralCode] = useState<string>(() => {
    const routeInfo = resolveInitialRoute();
    if (routeInfo.referralCode) {
      return routeInfo.referralCode;
    }
    return typeof window !== 'undefined' ? (localStorage.getItem('binance_harvest_pending_ref') || '') : '';
  });

  useEffect(() => {
    // Apply persisted theme preference on mount
    applyTheme(getStoredTheme());

    // Check auth status synchronously
    const isAuthenticated = Boolean(localStorage.getItem('binance_harvest_active_wallet'));
    
    // 1. Resolve and normalize initial routing, handling all referral formats or malformed URLs gracefully
    const routeInfo = resolveInitialRoute(isAuthenticated);

    if (routeInfo.referralCode) {
      setPendingReferralCode(routeInfo.referralCode);
      localStorage.setItem('binance_harvest_pending_ref', routeInfo.referralCode);
      setShowAuthModal(true);
    }

    if (routeInfo.needsHistoryReplace) {
      // Gracefully redirect all non-tab, malformed, or referral URLs to /dashboard or /auth without 404s
      window.history.replaceState(null, '', routeInfo.targetUrl);
      setActiveTab(routeInfo.activeTab);
    }

    if (routeInfo.showAuth) {
      setShowAuthModal(true);
    }

    // 2. Browser history popstate handler for back/forward navigation
    const handlePopState = () => {
      const isAuth = Boolean(localStorage.getItem('binance_harvest_active_wallet'));
      const fallbackInfo = resolveInitialRoute(isAuth);
      
      const path = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
      const valid = VALID_TABS.includes(path as any);
      
      if (valid) {
        setActiveTab(path as ActiveTab);
      } else {
        // Unknown or malformed path -> smoothly fallback to dashboard or auth
        window.history.replaceState(null, '', fallbackInfo.targetUrl);
        setActiveTab(fallbackInfo.activeTab);
        if (fallbackInfo.showAuth) {
          setShowAuthModal(true);
        } else {
          setShowAuthModal(false);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [bnbPrice, setBnbPrice] = useState<number>(600.00);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0.0000');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  
  // Entire user account starts afresh (Tier 1, 0 points)
  const [user, setUser] = useState<UserProfile>({
    walletAddress: '',
    currentTier: 1,
    miningBalance: 0,
    totalPoints: 0,
    miningBalanceBNB: 0,
    lastClaimDate: new Date().toISOString().split('T')[0],
    withdrawalStatus: 'NOT_STARTED',
    treasuryWalletAddress: TREASURY_WALLET,
    isVerified: false,
    loginStreak: 0,
    lastStreakClaimDate: '',
    totalStreakPointsClaimed: 0,
    createdAt: new Date().toISOString(),
  });

  // Prompt user to register on mount if no session found
  useEffect(() => {
    const registeredWallet = localStorage.getItem('binance_harvest_active_wallet');
    if (!registeredWallet) {
      setShowAuthModal(true);
    } else {
      getUserProfile(registeredWallet).then((profile) => setUser(profile));
    }
  }, []);

  // Real-time Firestore profile and referral listener
  useEffect(() => {
    if (!walletAddress) return;
    const unsubscribe = subscribeToUserProfile(walletAddress, (updatedProfile) => {
      setUser((prev) => {
        const prevCount = prev.referralCount || 0;
        const newCount = updatedProfile.referralCount || 0;
        if (newCount > prevCount && prev.walletAddress) {
          showSuccess({
            initiativeName: 'Referral Hash Booster',
            title: 'New Referee Joined! 🚀',
            badge: '+5% DAILY MINING BOOST',
            description: `A new miner just registered on BSC using your referral link! Your referral count is now ${newCount} (+${newCount * 5}% Hashpower Yield Boost active).`,
            details: [
              { label: 'Total Referrals', value: `${newCount} Miners` },
              { label: 'Mining Speed', value: `+${(newCount * 5) + (updatedProfile.referredBy ? 5 : 0)}% Boosted` },
              { label: 'Network', value: 'Binance Smart Chain (BEP-20)' },
            ],
          });
        }
        return updatedProfile;
      });
    });

    return () => unsubscribe();
  }, [walletAddress, showSuccess]);

  // Auto-refresh feature polling for updated mining balance calculations, user profile, and prices every 30 seconds
  const pollMiningCalculations = async () => {
    try {
      const price = await fetchLiveBNBPrice();
      setBnbPrice(price);

      const activeWallet = walletAddress || localStorage.getItem('binance_harvest_active_wallet');
      if (activeWallet) {
        const [updatedProfile, bal] = await Promise.all([
          getUserProfile(activeWallet),
          getRealWalletBalance(activeWallet).catch(() => null)
        ]);
        if (updatedProfile) {
          setUser(updatedProfile);
        }
        if (bal !== null && bal !== undefined) {
          setWalletBalance(bal);
        }
      }
    } catch (e) {
      console.warn("Auto-refresh poll error:", e);
    }
  };

  useEffect(() => {
    pollMiningCalculations();
    const interval = setInterval(pollMiningCalculations, 30000); // 30-second polling interval
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Sync real wallet balance when wallet address changes
  const syncWalletBalance = async (addr: string) => {
    const isTon = addr.startsWith('UQ') || addr.startsWith('EQ') || addr.startsWith('kQ') || localStorage.getItem('binance_harvest_wallet_type') === 'TON';
    if (isTon) {
      setWalletBalance('TON Miner');
      return;
    }
    try {
      const bal = await getRealWalletBalance(addr);
      setWalletBalance(bal);
    } catch (e) {
      console.warn("Could not fetch wallet balance:", e);
    }
  };

  // Restore saved wallet on mount and listen to provider events
  useEffect(() => {
    const saved = localStorage.getItem('binance_harvest_active_wallet');
    const isTon = saved && (saved.startsWith('UQ') || saved.startsWith('EQ') || saved.startsWith('kQ') || localStorage.getItem('binance_harvest_wallet_type') === 'TON');
    if (saved) {
      setWalletAddress(saved);
      syncWalletBalance(saved);
      if (!isTon) {
        reconnectExistingWallet().catch((e) => {
          console.warn("Silent session restoration attempt:", e);
        });
      }
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          const newAddr = accounts[0];
          setWalletAddress(newAddr);
          localStorage.setItem('binance_harvest_active_wallet', newAddr);
          syncWalletBalance(newAddr);
          const profile = await updateUserProfileFields(newAddr, { walletAddress: newAddr });
          setUser(profile);
        } else {
          setWalletAddress(null);
          localStorage.removeItem('binance_harvest_active_wallet');
          setWalletBalance('0.0000');
          setUser({
            walletAddress: '',
            currentTier: 1,
            miningBalance: 0,
            totalPoints: 0,
            miningBalanceBNB: 0,
            lastClaimDate: new Date().toISOString().split('T')[0],
            withdrawalStatus: 'NOT_STARTED',
            treasuryWalletAddress: TREASURY_WALLET,
            isVerified: false,
            loginStreak: 0,
            lastStreakClaimDate: '',
            totalStreakPointsClaimed: 0,
            createdAt: new Date().toISOString(),
          });
          setActiveTab('dashboard');
          setShowAuthModal(true);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      eth.on?.('accountsChanged', handleAccountsChanged);
      eth.on?.('chainChanged', handleChainChanged);

      return () => {
        eth.removeListener?.('accountsChanged', handleAccountsChanged);
        eth.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const handleConnectWallet = async () => {
    setShowAuthModal(true);
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
    } catch (e) {
      console.warn("Disconnect error:", e);
    }
    clearTonWalletSession();
    setWalletAddress(null);
    setWalletBalance('0.0000');
    localStorage.removeItem('binance_harvest_active_wallet');
    localStorage.removeItem('binance_harvest_wallet_type');
    setUser({
      walletAddress: '',
      currentTier: 1,
      miningBalance: 0,
      totalPoints: 0,
      miningBalanceBNB: 0,
      lastClaimDate: new Date().toISOString().split('T')[0],
      withdrawalStatus: 'NOT_STARTED',
      treasuryWalletAddress: TREASURY_WALLET,
      isVerified: false,
      loginStreak: 0,
      lastStreakClaimDate: '',
      totalStreakPointsClaimed: 0,
      createdAt: new Date().toISOString(),
    });
    setActiveTab('dashboard');
    setShowAuthModal(true);

    showSuccess({
      initiativeName: 'Web3 Wallet Session',
      title: 'Wallet Disconnected',
      description: 'Your Web3 wallet has been safely disconnected from this session and you have been returned to the authentication page.',
    });
  };

  const handleUpdateUser = async (updatedFields: Partial<UserProfile>) => {
    const identifier = user.walletAddress;
    if (identifier) {
      const newProfile = await updateUserProfileFields(identifier, updatedFields);
      setUser(newProfile);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    // If user clicks any feature and is not authenticated/registered, prompt auth modal
    if (!user.walletAddress) {
      setShowAuthModal(true);
    }
    setActiveTab(tab);
    window.history.pushState(null, '', `/${tab}`);
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#EAECEF] relative selection:bg-[#F3BA2F] selection:text-black">
      
      {/* Auth Modal (Mandatory Registration/Login) */}
      <Suspense fallback={null}>
        <AuthModal
          isOpen={showAuthModal || !user.walletAddress}
          isClosable={!!user.walletAddress}
          initialReferralCode={pendingReferralCode}
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={(profile) => {
            setUser(profile);
            if (profile.walletAddress) {
              setWalletAddress(profile.walletAddress);
              syncWalletBalance(profile.walletAddress);
              const currentPath = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
              if (currentPath === 'auth' || currentPath === 'login' || currentPath === '') {
                window.history.replaceState(null, '', '/dashboard');
                setActiveTab('dashboard');
              }
            }
          }}
        />
      </Suspense>

      {/* Web3 Error / Help Modal */}
      {walletError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="max-w-md w-full my-auto max-h-[90vh] overflow-y-auto custom-scrollbar bg-slate-900/95 border border-white/20 p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-lg">
              <span className="p-2 rounded-xl bg-amber-500/20">⚠️</span>
              <h3>Web3 Wallet Notice</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {walletError}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  setWalletError(null);
                  setShowAuthModal(true);
                }}
                className="flex-1 py-2.5 px-4 bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Connect / Select Wallet
              </button>
              <button
                onClick={() => setWalletError(null)}
                className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        walletAddress={walletAddress}
        walletBalance={walletBalance}
        bnbPrice={bnbPrice}
        isConnecting={isConnecting}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
      />

      {/* Main Content Area */}
      <main className="relative z-10 w-full min-h-[calc(100vh-64px)] overflow-x-hidden">
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'dashboard' && (
            <Dashboard
              user={user}
              bnbPrice={bnbPrice}
              onUpdateUser={handleUpdateUser}
              onNavigateToTiers={() => handleTabChange('tiers')}
              onPollMiningCalculations={pollMiningCalculations}
            />
          )}
          {activeTab === 'tiers' && (
            <TiersView
              user={user}
              bnbPrice={bnbPrice}
              onUpdateUser={handleUpdateUser}
            />
          )}
          {activeTab === 'treasury' && (
            <TreasuryView
              user={user}
              bnbPrice={bnbPrice}
            />
          )}
          {activeTab === 'leaderboard' && (
            <LeaderboardView
              user={user}
            />
          )}
          {activeTab === 'history' && (
            <TransactionHistory
              user={user}
            />
          )}
          {activeTab === 'help' && (
            <HelpView />
          )}
          {activeTab === 'wallet' && (
            <ProfileView
              user={user}
              bnbPrice={bnbPrice}
              walletAddress={walletAddress}
              walletBalance={walletBalance}
              onConnectWallet={handleConnectWallet}
              onDisconnectWallet={handleDisconnectWallet}
              onOpenAuth={() => setShowAuthModal(true)}
            />
          )}
          {activeTab === 'admin' && ADMIN_WALLETS.includes((user.walletAddress || '').toLowerCase()) && (
            <AdminView />
          )}
        </Suspense>
      </main>

      {/* Floating Bottom Navigation Bar */}
      {!showAuthModal && (
        <BottomNav 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          isAdmin={ADMIN_WALLETS.includes((user.walletAddress || '').toLowerCase())} 
        />
      )}

    </div>
  );
}

