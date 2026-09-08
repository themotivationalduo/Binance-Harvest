import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Zap, ShieldCheck, Cpu, FileText, ExternalLink, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export const HelpView: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      category: "White Paper & PoE",
      question: "Where can I read the official BinanceHarvest White Paper?",
      answer: "The official BinanceHarvest White Paper (v1.0) is published as a standalone technical document detailing our Proof-of-Engagement (PoE) mining protocol, 10,000 fixed BHFT tokenomics, BEP-20 smart contract architecture, and roadmap. Click the 'Read White Paper' button above or below anytime to access the full document."
    },
    {
      category: "Tier Upgrades",
      question: "How do Tier upgrades work and what is the cost?",
      answer: "Users start at Tier 1 with a base mining rate of 500 points/day. You can upgrade your tier by paying exactly $1 USD equivalent in BNB. Each tier upgrade doubles your daily mining reward (Tier 2 = 1,000 PTS/day, Tier 3 = 2,000 PTS/day, etc.), significantly accelerating your path to withdrawal."
    },
    {
      category: "Tier Upgrades",
      question: "How is the hourly mining rate calculated?",
      answer: "The hourly mining rate is derived directly from your daily tier output divided by 24 hours. For example, at Tier 1 (500 points/day), your hourly rate is ~20.83 points per hour. You can view the full formula breakdown anytime by clicking the 'Rate Formula' info button on the dashboard."
    },
    {
      category: "Withdrawals & Fees",
      question: "What is the minimum withdrawal threshold?",
      answer: "The minimum withdrawal threshold is $10.00 USD (approx. 0.0132 BNB based on live BNB/USDT market rates). Once your mined balance reaches or exceeds this threshold, the 'Verify & Withdraw' button becomes active."
    },
    {
      category: "Withdrawals & Fees",
      question: "Why is a one-time verification fee required for withdrawal?",
      answer: "Withdrawals require a one-time verification fee ($5.00 USD equivalent in BNB) paid directly to the protocol Treasury Wallet. This smart contract security check verifies your Web3 wallet signature, prevents bot harvesting, and ensures secure payout distribution on Binance Smart Chain."
    },
    {
      category: "Mining Logic",
      question: "How do I claim points and keep my mining rig active?",
      answer: "Your mining rig operates 24/7 on BSC cloud nodes. You can claim accumulated rewards at any time using the 'Claim Points' button on your Dashboard. All claims and upgrades are securely recorded and logged in your Audit History."
    }
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 pb-36 sm:pb-40 overflow-y-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3">
          <HelpCircle className="w-8 h-8 text-[#F3BA2F]" />
          Help & Support Center
        </h1>
        <p className="text-sm text-[#848E9C]">
          Everything you need to know about BinanceHarvest cloud mining, tier upgrades, and withdrawals.
        </p>
      </div>

      {/* Official White Paper Callout */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#F3BA2F]/15 to-amber-500/10 border border-[#F3BA2F]/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5 text-left">
          <div className="w-11 h-11 rounded-xl bg-[#F3BA2F]/20 border border-[#F3BA2F]/40 flex items-center justify-center text-[#F3BA2F] shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Official White Paper (v1.0)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3BA2F]/20 text-[#F3BA2F] font-extrabold border border-[#F3BA2F]/40">
                PoE Protocol
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Read the comprehensive technical architecture, tokenomics, and roadmap.
            </p>
          </div>
        </div>

        <motion.a
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          href="/whitepaper.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#F3BA2F] hover:bg-[#e2ad23] text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-[#F3BA2F]/20 shrink-0"
        >
          <FileText className="w-4 h-4 text-slate-950" />
          <span>Read White Paper</span>
        </motion.a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="bg-[#1E2329] p-5 rounded-xl border border-[rgba(255,255,255,0.08)] flex items-start gap-3">
          <Zap className="w-6 h-6 text-[#F3BA2F] shrink-0 mt-1" />
          <div>
            <h3 className="text-sm font-bold text-white">Tier Rigs</h3>
            <p className="text-xs text-[#848E9C] mt-1">Upgrade tiers to double your daily mining output instantly.</p>
          </div>
        </div>

        <div className="bg-[#1E2329] p-5 rounded-xl border border-[rgba(255,255,255,0.08)] flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-[#00C087] shrink-0 mt-1" />
          <div>
            <h3 className="text-sm font-bold text-white">Secure Payouts</h3>
            <p className="text-xs text-[#848E9C] mt-1">$10 threshold with verified BSC treasury settlement.</p>
          </div>
        </div>

        <div className="bg-[#1E2329] p-5 rounded-xl border border-[rgba(255,255,255,0.08)] flex items-start gap-3">
          <Cpu className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
          <div>
            <h3 className="text-sm font-bold text-white">24/7 Cloud Nodes</h3>
            <p className="text-xs text-[#848E9C] mt-1">Real-time mining backed by immutable transaction history.</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1E2329] rounded-2xl border border-[rgba(255,255,255,0.08)] divide-y divide-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
        <div className="p-4 bg-[#0B0E11]/50 text-xs font-semibold uppercase tracking-wider text-[#848E9C]">
          Frequently Asked Questions (FAQ)
        </div>

        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="transition">
              <button
                onClick={() => toggleAccordion(index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F3BA2F]/10 text-[#F3BA2F] border border-[#F3BA2F]/30">
                    {faq.category}
                  </span>
                  <span className="text-sm font-bold text-white">{faq.question}</span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#F3BA2F] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#848E9C] shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs text-[#848E9C] leading-relaxed animate-fade-in bg-[#0B0E11]/30 pt-2">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-6 bg-gradient-to-r from-[#1E2329] to-[#0B0E11] rounded-2xl border border-[#F3BA2F]/20 text-center space-y-3">
        <h3 className="text-base font-bold text-white">Need Additional Support?</h3>
        <p className="text-xs text-[#848E9C] max-w-md mx-auto">
          Our support engineers are online 24/7 via Telegram and Discord channels for verified BinanceHarvest miners.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <a
            href="#telegram"
            onClick={(e) => e.preventDefault()}
            className="px-4 py-2 bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-semibold rounded-lg text-xs transition"
          >
            Join Telegram Support
          </a>
          <a
            href="/whitepaper.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[#F3BA2F]" />
            <span>White Paper</span>
          </a>
        </div>
      </div>
    </div>
  );
};
