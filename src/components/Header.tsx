import React, { useEffect, useState } from 'react';
import { Shield, Zap, Wallet, Globe, ExternalLink, RefreshCw } from 'lucide-react';

interface HeaderProps {
  walletAddress: string | null;
  walletBalance?: string;
  bnbPrice: number;
  isConnecting: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  walletAddress,
  walletBalance,
  bnbPrice,
  isConnecting,
  onConnectWallet,
  onDisconnectWallet,
}) => {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const pingBSC = async () => {
      try {
        const start = performance.now();
        await fetch('https://bsc-dataseed.binance.org/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: "2.0", method: "net_version", params: [], id: 1 })
        });
        const end = performance.now();
        if (mounted) setLatency(Math.round(end - start));
      } catch (err) {
        if (mounted) setLatency(-1);
      }
    };

    pingBSC();
    const interval = setInterval(pingBSC, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const getLatencyColor = () => {
    if (latency === null) return 'bg-amber-400';
    if (latency === -1 || latency >= 800) return 'bg-red-500';
    if (latency >= 300) return 'bg-amber-400';
    return 'bg-[#00C087]';
  };

  const getLatencyText = () => {
    if (latency === null) return 'Pinging...';
    if (latency === -1) return 'Offline';
    return `${latency}ms`;
  };

  return (
    <header className="h-[64px] border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-[#0B0E11]/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 text-[#F3BA2F] flex items-center justify-center filter drop-shadow-[0_2px_8px_rgba(243,186,47,0.3)]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M16.622 10.076L12 5.454 7.378 10.076H3.344L12 1.419l8.656 8.657h-4.034zM12 18.546l4.622-4.622h4.034L12 22.58l-8.656-8.656h4.034L12 18.546zM13.931 12L12 10.069 10.069 12 12 13.931 13.931 12zM20.656 12l-2.011-2.012 2.011-2.012L22.668 12l-2.012 2.012L20.656 12zM3.344 12l2.012-2.012L3.344 7.976 1.332 12l2.012 2.012L3.344 12z"/>
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Binance<span className="text-[#F3BA2F]">Harvest</span></span>
      </div>

      <div className="hidden sm:flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md" title={`RPC Latency: ${getLatencyText()}`}>
          <div className={`w-2 h-2 rounded-full ${getLatencyColor()} ${latency !== null && latency < 300 ? 'animate-pulse' : ''}`}></div>
          <span className="text-xs font-medium text-slate-200">BSC Mainnet ({getLatencyText()})</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
          <Globe className="w-3.5 h-3.5 text-[#F3BA2F]" />
          <span className="text-xs text-[#848E9C]">BNB:</span>
          <span className="text-xs font-mono font-bold text-[#F3BA2F]">${bnbPrice.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {walletAddress ? (
          <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-[#00C087]" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs text-slate-200 font-mono">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </span>
              {walletBalance && (
                <span className="text-[10px] sm:text-xs font-mono font-bold text-[#F3BA2F]">
                  {Number(walletBalance).toFixed(4)} BNB
                </span>
              )}
            </div>
            <button
              onClick={onDisconnectWallet}
              title="Disconnect Wallet"
              className="p-1 hover:bg-white/10 rounded-lg text-[#848E9C] hover:text-red-400 transition ml-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onConnectWallet}
            disabled={isConnecting}
            className="bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold px-3 sm:px-4 py-2 rounded-xl text-xs transition active:scale-95 disabled:opacity-50 shadow-lg shadow-[#F3BA2F]/20"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
};

