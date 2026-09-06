import React from 'react';
import { UserProfile } from '../types';
import { User, Wallet, Globe, Shield, CheckCircle2, RefreshCw } from 'lucide-react';
import { switchToBSC, TREASURY_WALLET } from '../services/web3';

interface ProfileViewProps {
  user: UserProfile;
  bnbPrice: number;
  walletAddress: string | null;
  walletBalance?: string;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onOpenAuth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  bnbPrice,
  walletAddress,
  walletBalance,
  onConnectWallet,
  onDisconnectWallet,
  onOpenAuth,
}) => {
  const [switchingNetwork, setSwitchingNetwork] = React.useState(false);

  const handleSwitch = async () => {
    setSwitchingNetwork(true);
    await switchToBSC();
    setSwitchingNetwork(false);
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-6">
      
      {/* Header */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-400" />
            Miner Profile & Wallet
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Account Settings
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your Web3 connection, Binance Smart Chain configuration, and profile credentials.
        </p>
      </div>

      {/* Wallet Card */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-6">
        <h3 className="text-lg font-bold text-white">Web3 Connection</h3>

        {walletAddress ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-white/10">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs text-slate-400">Connected Wallet (BSC Mainnet)</div>
                  <div className="font-mono text-white text-sm sm:text-base font-semibold truncate">{walletAddress}</div>
                  {walletBalance && (
                    <div className="text-xs font-mono font-bold text-[#F3BA2F] mt-0.5">
                      Balance: {Number(walletBalance).toFixed(4)} BNB (≈ ${(Number(walletBalance) * bnbPrice).toFixed(2)} USD)
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onDisconnectWallet}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition self-start sm:self-auto shrink-0"
              >
                Disconnect
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xs text-slate-400">Active Network</div>
                  <div className="font-bold text-white text-sm">Binance Smart Chain Mainnet (Chain ID: 56)</div>
                </div>
              </div>
              <button
                onClick={handleSwitch}
                disabled={switchingNetwork}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center justify-center gap-2"
              >
                {switchingNetwork && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Verify BSC Network</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-slate-400 text-sm">No wallet connected. Connect your MetaMask wallet to start mining on Binance Smart Chain.</p>
            <button
              onClick={onConnectWallet}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition"
            >
              Connect MetaMask Now
            </button>
          </div>
        )}
      </div>

      {/* Account Details */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 lg:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Miner Credentials & Authentication</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage your authenticated miner account or switch profile credentials.</p>
          </div>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Switch / Sign In to Account</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Assigned Email</div>
            <div className="font-mono text-white break-all">{user.email}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Account Created</div>
            <div className="font-mono text-white">{new Date(user.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

    </div>
  );
};
