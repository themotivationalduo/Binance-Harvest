import React, { useState } from 'react';
import { 
  FileText, 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Printer, 
  Download, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Globe, 
  Cpu, 
  CheckCircle2,
  Calendar,
  DollarSign,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BHFT_TOKEN_ADDRESS, BHFT_TOKEN_NAME, BHFT_TOKEN_SYMBOL, TREASURY_WALLET } from '../services/web3';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { AppLogo } from './AppLogo';

interface WhitePaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhitePaperModal: React.FC<WhitePaperModalProps> = ({ isOpen, onClose }) => {
  const [copiedContract, setCopiedContract] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('summary');
  const { showCopySuccess } = useInitiativeFeedback();

  if (!isOpen) return null;

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(BHFT_TOKEN_ADDRESS);
      setCopiedContract(true);
      showCopySuccess('BHFT Token Contract');
      setTimeout(() => setCopiedContract(false), 2500);
    } catch {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2500);
    }
  };

  const handleOpenStandaloneHtml = () => {
    window.open('/whitepaper.html', '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open('/whitepaper.html', '_blank');
    if (printWindow) {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const tierProgressionData = [
    { tier: 1, name: 'Cloud Starter Miner', daily: '0.10 BHFT', pct: 20, fee: 'Included Free', usdDaily: '$0.05' },
    { tier: 2, name: 'ASIC Dual MicroRig', daily: '0.25 BHFT', pct: 35, fee: '0.007 BNB', usdDaily: '$0.125' },
    { tier: 3, name: 'HashGrid Pro Cluster', daily: '0.60 BHFT', pct: 55, fee: '0.015 BNB', usdDaily: '$0.30' },
    { tier: 4, name: 'Quantum Core Superminer', daily: '1.50 BHFT', pct: 75, fee: '0.035 BNB', usdDaily: '$0.75' },
    { tier: 5, name: 'MegaVault Titan Rig', daily: '4.00 BHFT', pct: 100, fee: '0.080 BNB', usdDaily: '$2.00' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 flex min-h-screen items-center justify-center animate-fade-in overscroll-contain">
      <div className="relative w-full max-w-4xl my-auto max-h-[92vh] flex flex-col bg-[#0B0E11]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Mirror Glass Glow Backgrounds */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/10 via-[#F3BA2F]/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#00C087]/10 via-[#00C087]/5 to-transparent rounded-full blur-3xl pointer-events-none -ml-32 -mb-32" />

        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10 sm:w-11 sm:h-11" rounded="rounded-2xl" alt="BinanceHarvest" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Official White Paper
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F3BA2F]/20 text-[#F3BA2F] border border-[#F3BA2F]/30">
                  Version 1.0
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  BSC Mainnet
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                BinanceHarvest (BHFT) &bull; September 2025
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenStandaloneHtml}
              title="Open standalone HTML page in new tab"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>HTML Page</span>
            </button>

            <button
              onClick={handlePrint}
              title="Print or save as PDF"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
              aria-label="Close White Paper modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Section Switcher Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-white/10 bg-black/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 text-xs">
          {[
            { id: 'summary', label: '1. Executive Summary' },
            { id: 'problem', label: '2. Problem Statement' },
            { id: 'solution', label: '3. Solution' },
            { id: 'specs', label: '4. Technical Specs & Chart' },
            { id: 'tokenomics', label: '5. Tokenomics' },
            { id: 'roadmap', label: '7. Roadmap' },
            { id: 'advantages', label: '8. Advantages' },
            { id: 'contract', label: '10. Contract & Resources' },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => {
                setActiveSection(sec.id);
                const el = document.getElementById(`wp-${sec.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`px-3 py-1 rounded-xl whitespace-nowrap text-[11px] font-semibold transition cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-[#F3BA2F] text-black shadow-sm'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* White Paper Scrollable Content Area */}
        <div className="p-4 sm:p-8 space-y-8 flex-1 overflow-y-auto overscroll-contain custom-scrollbar text-slate-200 text-sm leading-relaxed">

          {/* Hero Banner / Cover */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/15 via-[#F3BA2F]/10 to-transparent border border-[#F3BA2F]/30 relative overflow-hidden">
            <div className="max-w-2xl relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#F3BA2F] block mb-1">
                Official White Paper &bull; Technical Specification
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                BinanceHarvest (BHFT)
              </h1>
              <p className="text-sm font-semibold text-amber-300 mt-1">
                The Next Generation BEP-20 Mining Ecosystem on Binance Smart Chain
              </p>
              
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-white/10">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Version</span>
                  <span className="font-bold text-white font-mono">1.0</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Date</span>
                  <span className="font-bold text-white">September 2025</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Network</span>
                  <span className="font-bold text-[#F3BA2F]">BSC Mainnet</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Token Standard</span>
                  <span className="font-bold text-[#00C087]">BEP-20</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Executive Summary */}
          <section id="wp-summary" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">1</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Executive Summary</h3>
            </div>
            <p className="text-slate-300">
              <strong className="text-white">BinanceHarvest</strong> is a high-performance, decentralized mining platform built on the <strong className="text-[#F3BA2F]">Binance Smart Chain (BSC)</strong>. It enables users to mine <strong className="text-white">BHFT (BinanceHarvest Future Token)</strong> through a gamified, tier-based system. Unlike traditional proof-of-work models that require expensive hardware, BinanceHarvest utilizes a hybrid digital-consensus model where user engagement and network validation drive token accrual.
            </p>
            <p className="text-slate-300">
              The platform is designed for scalability, featuring automatic tier upgrades, real-time price monitoring, and a transparent treasury system. BHFT is currently in its pre-listing phase, offering early adopters access to value at a discounted entry point before public market distribution.
            </p>
          </section>

          {/* 2. Problem Statement */}
          <section id="wp-problem" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">2</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Problem Statement</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-amber-400 text-xs mb-1">Complexity of Traditional Mining</h4>
                <p className="text-xs text-slate-400">
                  Traditional crypto mining requires specialized hardware (ASICs/GPUs) and significant electricity costs.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-amber-400 text-xs mb-1">High Barrier to Entry for New Tokens</h4>
                <p className="text-xs text-slate-400">
                  Many new tokens launch with volatile prices and low initial liquidity, making it difficult for average users to enter and exit positions profitably.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-amber-400 text-xs mb-1">Lack of Transparency in Cloud Mining</h4>
                <p className="text-xs text-slate-400">
                  The "cloud mining" market is saturated with platforms that obscure their reward distribution mechanisms, leading to trust issues among users.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Solution: The BinanceHarvest Model */}
          <section id="wp-solution" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">3</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Solution: The BinanceHarvest Model</h3>
            </div>
            <p className="text-slate-300">
              BinanceHarvest solves these problems by providing a software-only mining solution on BSC. Users do not need hardware; they only need a digital wallet (e.g., MetaMask, Trust Wallet) and an internet connection.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">BHFT Token</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">A native BEP-20 token pegged to stability with future growth potential.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Tiered Mining System</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Users start at Tier 1 and can upgrade their earning capacity progressively.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Transparent Treasury</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">All mining rewards and upgrade fees are managed via a publicly auditable smart contract on BSCScan.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Real-Time Valuation</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">The platform ensures fair conversion rates between BHFT, BNB, and USD via live spot oracles.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Technical Specifications & Visual Tier Chart */}
          <section id="wp-specs" className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">4</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Technical Specifications & Tier Chart</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase block">Chain</span>
                <span className="font-bold text-white text-xs">BSC Mainnet</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase block">Token Standard</span>
                <span className="font-bold text-[#F3BA2F] text-xs">BEP-20</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase block">Decimals</span>
                <span className="font-bold text-white text-xs font-mono">18</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase block">Total Supply</span>
                <span className="font-bold text-emerald-400 text-xs font-mono">10,000 BHFT</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
              <p><strong className="text-white">The BHFT Token:</strong> BinanceHarvest Future Token (BHFT) &bull; Peg: 1 BHFT &asymp; $0.50 USD &bull; Utility: Used for mining rewards, tier upgrades, hash boosts, and governance voting in future phases.</p>
              <p><strong className="text-white">Mining Algorithm:</strong> Proof-of-Engagement (PoE) algorithm. Instead of computational hashing, value is derived from network verification and staking mechanics. Base Rate is defined by the active Tier level with dynamic adjustments.</p>
              <p><strong className="text-white">Rig Upgrades:</strong> Users can upgrade at any time by paying the fee directly in BNB to the Treasury receiver.</p>
            </div>

            {/* Visual Tier Progression Chart */}
            <div className="p-5 rounded-2xl bg-black/50 border border-[#F3BA2F]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#F3BA2F]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white">Visual Tier Progression Chart</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono">Yield Curve (0.10 - 4.00 BHFT/d)</span>
              </div>

              <div className="space-y-3 pt-2">
                {tierProgressionData.map((item) => (
                  <div key={item.tier} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-white flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[#F3BA2F] text-[10px]">Tier {item.tier}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="font-mono font-bold text-[#F3BA2F]">{item.daily} <span className="text-[10px] text-slate-400 font-normal">({item.usdDaily}/d)</span></span>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-[#F3BA2F] to-[#00C087] rounded-full transition-all duration-700"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. Economic Model & Tokenomics */}
          <section id="wp-tokenomics" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">5</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Economic Model & Tokenomics</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">5.1 Revenue Streams</h4>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc">
                  <li><strong>Tier Upgrades:</strong> A USD fee per upgrade, paid to the Treasury Wallet in native BNB.</li>
                  <li><strong>Withdrawal Verification:</strong> A one-time USD fee paid by users to verify identity and network costs.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">5.2 Reward Distribution</h4>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc">
                  <li><strong>Mining Rewards:</strong> Distributed daily to user wallets based on their Tier level.</li>
                  <li><strong>Treasury Allocation:</strong> 40% of all upgrade and verification fees are retained in the Treasury Wallet to fund future exchange listings, marketing, and liquidity pools.</li>
                  <li><strong>Burn Mechanism (Future):</strong> A portion of transaction fees may be burned to reduce total supply over time, increasing scarcity.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 7. Roadmap */}
          <section id="wp-roadmap" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">7</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Development Roadmap</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-400 text-xs">Phase 1 &bull; Q3 2025</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 font-bold">COMPLETED</span>
                </div>
                <p className="text-xs text-slate-300">
                  Platform Launch on BSC Mainnet. Treasury Wallet Activation. Tier System Live.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-400 text-xs">Phase 2 &bull; Q4 2025</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#F3BA2F]/20 text-[#F3BA2F] font-bold">ACTIVE</span>
                </div>
                <p className="text-xs text-slate-300">
                  Integration of Referral System. Enhanced Dashboard Analytics. Daily Login Streaks.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sky-400 text-xs">Phase 3 &bull; Q1 2026</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-sky-500/20 text-sky-400 font-bold">UPCOMING</span>
                </div>
                <p className="text-xs text-slate-300">
                  BHFT Listing: Listing on PancakeSwap and Uniswap. Automated Liquidity Provisioning.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-purple-400 text-xs">Phase 4 &bull; Q2 2026</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-400 font-bold">PLANNED</span>
                </div>
                <p className="text-xs text-slate-300">
                  Governance Token Launch. Community Voting for Future Upgrades. Global Marketing Expansion.
                </p>
              </div>
            </div>
          </section>

          {/* 8. Why BinanceHarvest? */}
          <section id="wp-advantages" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">8</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Why BinanceHarvest?</h3>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Low Cost, High Yield:</strong> Users start with minimal investment and see immediate growth in their dashboard.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">BSC Efficiency:</strong> Leveraging Binance Smart Chain ensures low gas fees and fast transaction finality compared to Ethereum.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Trust & Transparency:</strong> All smart contract interactions are viewable on BSCScan. The Treasury Wallet address is public.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Pre-Listing Advantage:</strong> Early miners acquire BHFT at pre-market rates, positioning them for potential gains upon exchange listing.
                </div>
              </div>
            </div>
          </section>

          {/* 9. Conclusion */}
          <section id="wp-conclusion" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">9</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Conclusion</h3>
            </div>
            <p className="text-slate-300">
              BinanceHarvest represents the next evolution of cloud mining. By combining the reliability of BSC with a simple, tiered economic model and a proprietary token (BHFT), we are building a sustainable ecosystem for both casual users and crypto enthusiasts. Join us now to mine BHFT before it hits the broader market.
            </p>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-[#F3BA2F]/30 text-xs text-amber-200">
              <span className="font-bold text-[#F3BA2F] block mb-1">Pre-Market Positioning</span>
              This White Paper positions BinanceHarvest as a legitimate crypto project preparing for a real market launch.
            </div>
          </section>

          {/* 10. Contact & Resources */}
          <section id="wp-contract" className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">10</span>
              <h3 className="text-base sm:text-lg font-bold text-white">Contact & Resources</h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Official dApp:</span>
                <a href="https://binanceharvest.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[#F3BA2F] font-bold hover:underline flex items-center gap-1">
                  <span>https://binanceharvest.vercel.app</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-400">Token Contract (BSC Mainnet):</span>
                <div className="flex items-center justify-between gap-2 p-2.5 bg-black/60 rounded-xl border border-white/10 text-xs">
                  <span className="font-mono text-[#F3BA2F] truncate">{BHFT_TOKEN_ADDRESS}</span>
                  <button
                    onClick={handleCopyContract}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition shrink-0 cursor-pointer"
                  >
                    {copiedContract ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Blockchain Explorer:</span>
                <a
                  href={`https://bscscan.com/token/${BHFT_TOKEN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
                >
                  <span>BscScan.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            &copy; 2025 BinanceHarvest Ecosystem &bull; BEP-20 Standard
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleOpenStandaloneHtml}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Open Standalone HTML</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-[#F3BA2F] hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-[#F3BA2F]/20"
            >
              <span>Close</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
