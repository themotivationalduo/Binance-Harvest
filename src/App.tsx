import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, ActiveTab } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { TiersView } from './components/TiersView';
import { TreasuryView } from './components/TreasuryView';
import { LeaderboardView } from './components/LeaderboardView';
import { ProfileView } from './components/ProfileView';
import { TransactionHistory } from './components/TransactionHistory';
import { HelpView } from './components/HelpView';
import { AuthModal } from './components/AuthModal';
import { AdminView } from './components/AdminView';
import { UserProfile, ADMIN_WALLETS } from './types';
import { fetchLiveBNBPrice, connectWallet, getRealWalletBalance, TREASURY_WALLET } from './services/web3';
import { getUserProfile, updateUserProfileFields } from './services/firebase';
import { useInitiativeFeedback } from './context/InitiativeFeedbackContext';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const path = window.location.pathname.substring(1);
    const validTabs = ['dashboard', 'tiers', 'treasury', 'leaderboard', 'history', 'help', 'wallet'];
    return validTabs.includes(path) ? (path as ActiveTab) : 'dashboard';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.substring(1);
      const validTabs = ['dashboard', 'tiers', 'treasury', 'leaderboard', 'history', 'help', 'wallet'];
      setActiveTab(validTabs.includes(path) ? (path as ActiveTab) : 'dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    
    // Set initial URL if empty
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', '/dashboard');
    }
    
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

  // Fetch BNB price on mount and every 60 seconds
  useEffect(() => {
    const updatePrice = async () => {
      const price = await fetchLiveBNBPrice();
      setBnbPrice(price);
    };
    updatePrice();
    const interval = setInterval(updatePrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Sync real wallet balance when wallet address changes
  const syncWalletBalance = async (addr: string) => {
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
    if (saved) {
      setWalletAddress(saved);
      syncWalletBalance(saved);
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
    try {
      setIsConnecting(true);
      setWalletError(null);
      const res = await connectWallet();
      if (res && res.address) {
        setWalletAddress(res.address);
        localStorage.setItem('binance_harvest_active_wallet', res.address);
        syncWalletBalance(res.address);
        const profile = await updateUserProfileFields(res.address, { walletAddress: res.address });
        setUser(profile);

        showSuccess({
          initiativeName: 'Web3 Wallet Initialization',
          title: 'Binance Smart Chain Connected!',
          badge: 'Chain ID 56',
          description: `Successfully linked BSC Web3 wallet ${res.address.substring(0, 6)}...${res.address.substring(res.address.length - 4)}.`,
          details: [
            { label: 'Wallet', value: `${res.address.substring(0, 10)}...` },
            { label: 'Network', value: 'Binance Smart Chain' },
            { label: 'Status', value: 'Ready for On-Chain Transactions' },
          ],
        });
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      const isNotFound = err?.message?.includes("WEB3_WALLET_NOT_FOUND");
      const errDetail = isNotFound
        ? "MetaMask or a Web3 provider was not detected in this browser frame. To execute real on-chain BSC transactions, please install MetaMask or open this application in a new browser tab with your Web3 wallet active."
        : (err?.message || "Failed to connect Web3 wallet. Please make sure you are on Binance Smart Chain Mainnet.");
      setWalletError(errDetail);

      showFailed({
        initiativeName: 'Web3 Wallet Initialization',
        title: 'Connection Failed',
        description: errDetail,
        actionLabel: 'Retry Connection',
        onAction: () => handleConnectWallet(),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setWalletBalance('0.0000');
    localStorage.removeItem('binance_harvest_active_wallet');
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
      <AuthModal
        isOpen={showAuthModal || !user.walletAddress}
        isClosable={!!user.walletAddress}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={(profile) => {
          setUser(profile);
          if (profile.walletAddress) {
            setWalletAddress(profile.walletAddress);
            syncWalletBalance(profile.walletAddress);
          }
        }}
      />

      {/* Web3 Error / Help Modal */}
      {walletError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900/95 border border-white/20 p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-lg">
              <span className="p-2 rounded-xl bg-amber-500/20">⚠️</span>
              <h3>Web3 Wallet Notice</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {walletError}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 px-4 bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold text-xs rounded-xl transition"
              >
                Get MetaMask
              </a>
              <button
                onClick={() => setWalletError(null)}
                className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition"
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
      <main className="relative z-10">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            bnbPrice={bnbPrice}
            onUpdateUser={handleUpdateUser}
            onNavigateToTiers={() => handleTabChange('tiers')}
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
      </main>

      {/* Floating Bottom Navigation Bar */}
      {(user.walletAddress && !showAuthModal) && (
        <BottomNav 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          isAdmin={ADMIN_WALLETS.includes((user.walletAddress || '').toLowerCase())} 
        />
      )}

    </div>
  );
}

