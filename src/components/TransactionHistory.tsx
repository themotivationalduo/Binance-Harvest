import React, { useState, useEffect } from 'react';
import { TransactionRecord, UserProfile, ReferralActivityEvent } from '../types';
import { getTransactionHistory, getReferralActivityHistory } from '../services/firebase';
import { 
  History, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ExternalLink, 
  RefreshCw, 
  Mail, 
  MailOpen, 
  Zap, 
  Users, 
  Sparkles, 
  Copy, 
  Check, 
  ChevronRight, 
  X, 
  ShieldCheck, 
  Layers, 
  ArrowUpRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';

interface TransactionHistoryProps {
  user: UserProfile;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'referrals' | 'transactions' | 'all'>('referrals');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [referralEvents, setReferralEvents] = useState<ReferralActivityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ReferralActivityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const { showSuccess } = useInitiativeFeedback();

  const fetchAllHistory = async (manual = false) => {
    try {
      setLoading(true);
      const [txRecords, refRecords] = await Promise.all([
        getTransactionHistory(user.walletAddress),
        getReferralActivityHistory(user.walletAddress, user),
      ]);
      setTransactions(txRecords);
      setReferralEvents(refRecords);

      if (manual) {
        showSuccess({
          initiativeName: 'Activity Ledger',
          title: 'History Synchronized',
          badge: `${txRecords.length + refRecords.length} Total Events`,
          description: `Loaded ${refRecords.length} referral events and ${txRecords.length} on-chain BSC transaction records.`,
        });
      }
    } catch (e) {
      console.error("Failed to load activity history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllHistory(false);
  }, [user.walletAddress, user.referralCount]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    setTimeout(() => setCopiedAddr(null), 2000);
    showSuccess({
      initiativeName: 'Address Copied',
      title: 'BEP-20 Address Copied',
      badge: 'Clipboard',
      description: text,
    });
  };

  const userReferralCount = Number(user.referralCount ?? (user.referredUsers ? user.referredUsers.length : 0));
  const userBoostPercent = (userReferralCount * 5) + (user.referredBy ? 5 : 0);

  // Unified items list
  const unifiedItems = [
    ...referralEvents.map(r => ({ kind: 'referral' as const, data: r, date: new Date(r.timestamp).getTime() })),
    ...transactions.map(t => ({ kind: 'tx' as const, data: t, date: new Date(t.timestamp).getTime() }))
  ].sort((a, b) => b.date - a.date);

  // Format relative time helper
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 pb-36 sm:pb-40 overflow-y-auto">
      
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                Audit & Activity Ledger
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" />
                +{userBoostPercent}% Hashrate Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Activity & Referral Notifications
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Transparent, immutable log of your BSC transactions and referral speed boosts. Track exactly when referees joined and when your daily mining velocity increased.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchAllHistory(true)}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer backdrop-blur-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh Ledger</span>
            </motion.button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('referrals')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'referrals'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Referral & Boost Inbox</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'referrals' ? 'bg-slate-950/30 text-slate-900' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {referralEvents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>On-Chain Transactions</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'transactions' ? 'bg-slate-950/30 text-slate-900' : 'bg-white/10 text-slate-300'
            }`}>
              {transactions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Unified Timeline</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'all' ? 'bg-slate-950/30 text-slate-900' : 'bg-white/10 text-slate-300'
            }`}>
              {referralEvents.length + transactions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        
        {/* 1. Referral & Boost Inbox (Email-like Notifications) */}
        {activeTab === 'referrals' && (
          <motion.div
            key="referrals-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl"
          >
            <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Referral Event Notifications</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chronological email-style dispatches for your syndicate expansions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>+5.0% Boost Per Referee</span>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                Fetching referral notification ledger...
              </div>
            ) : referralEvents.length === 0 ? (
              <div className="p-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                  <Mail className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Referral Notifications Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    When someone joins using your referral link, you will receive an instant email notification here and an automatic +5% daily mining boost.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {referralEvents.map((event) => {
                  const isWelcome = event.type === 'SPEED_BOOST_ACTIVATED';
                  return (
                    <motion.div
                      key={event.id}
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                      onClick={() => setSelectedEvent(event)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors group"
                    >
                      {/* Left: Avatar & Email details */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isWelcome
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isWelcome ? <Sparkles className="w-5 h-5 text-blue-400" /> : <Users className="w-5 h-5 text-emerald-400" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-200">
                              {isWelcome ? 'BSC Welcome Node' : 'Syndicate Gateway'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              &lt;daemon@binanceharvest.org&gt;
                            </span>
                            <span className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>

                          <div className="text-sm font-semibold text-white group-hover:text-amber-300 transition truncate">
                            {event.subject}
                          </div>

                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {event.details || 'Permanent +5.0% hashrate speed increase applied to your active BEP-20 node.'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Badges and Action */}
                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          +{event.speedIncreasePercent.toFixed(1)}% Boost
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10 hidden md:inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          VERIFIED
                        </span>

                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* 2. On-Chain Transactions */}
        {activeTab === 'transactions' && (
          <motion.div
            key="transactions-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl"
          >
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <span>On-Chain Settlement Records</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Tier upgrades, verification payments, and withdrawal records on Binance Smart Chain
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center text-xs text-slate-400">Loading records...</div>
            ) : transactions.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <History className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Transaction Records Found</p>
                <p className="text-xs text-slate-400">
                  Your tier upgrades and verification payments will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-white/5">
                      <th className="p-4 px-6">Type</th>
                      <th className="p-4 px-6">Amount</th>
                      <th className="p-4 px-6">Status</th>
                      <th className="p-4 px-6">Tx Hash / ID</th>
                      <th className="p-4 px-6">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition">
                        <td className="p-4 px-6 font-bold text-white flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            tx.type === 'UPGRADE' ? 'bg-[#F3BA2F]' :
                            tx.type === 'WITHDRAW_FEE' ? 'bg-emerald-400' : 'bg-blue-400'
                          }`} />
                          {tx.type}
                        </td>
                        <td className="p-4 px-6 text-white font-mono">
                          {tx.amountBNB ? `${tx.amountBNB} BNB` : `$${tx.amountUSD} USD`}
                        </td>
                        <td className="p-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 ${
                            tx.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            tx.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {tx.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3" />}
                            {tx.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {tx.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 px-6">
                          {tx.txHash ? (
                            <a
                              href={`https://bscscan.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition"
                              title="Verify transaction on BscScan"
                            >
                              <span className="font-mono">{tx.txHash.substring(0, 8)}...{tx.txHash.substring(tx.txHash.length - 6)}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-mono text-slate-500">
                              {tx.id.substring(0, 10)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 px-6 text-slate-400 font-mono text-xs">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* 3. Unified Timeline */}
        {activeTab === 'all' && (
          <motion.div
            key="unified-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>Combined Event Stream</span>
            </h2>

            <div className="space-y-4">
              {unifiedItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No activity events recorded yet.
                </div>
              ) : (
                unifiedItems.map((item, idx) => {
                  if (item.kind === 'referral') {
                    const evt = item.data;
                    return (
                      <div 
                        key={evt.id + idx}
                        onClick={() => setSelectedEvent(evt)}
                        className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between gap-4 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{evt.subject}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{new Date(evt.timestamp).toLocaleString()}</div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          +{evt.speedIncreasePercent.toFixed(1)}% Speed
                        </span>
                      </div>
                    );
                  } else {
                    const tx = item.data;
                    return (
                      <div 
                        key={tx.id + idx}
                        className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between gap-4 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <History className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{tx.type} Payment Settlement</div>
                            <div className="text-[11px] text-slate-400 font-mono">{new Date(tx.timestamp).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-white">
                            {tx.amountBNB ? `${tx.amountBNB} BNB` : `$${tx.amountUSD} USD`}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-semibold">{tx.status}</div>
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Detail Modal / Reader */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                    <MailOpen className="w-3.5 h-3.5 text-amber-400" />
                    Official BSC Notification
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-white/5">
                    ID: {selectedEvent.id.substring(0, 14)}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white leading-snug">
                  {selectedEvent.subject}
                </h3>
              </div>

              {/* Email Envelope Metadata */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">From:</span>
                  <span className="text-slate-200">Syndicate Protocol &lt;daemon@binanceharvest.org&gt;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">To:</span>
                  <span className="text-slate-200">{user.walletAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="text-slate-200">{new Date(selectedEvent.timestamp).toUTCString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-amber-400 font-bold">Binance Smart Chain (BEP-20)</span>
                </div>
              </div>

              {/* Body Message */}
              <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                <p>
                  {selectedEvent.details || 'A new miner registered on the Binance Smart Chain network using your invitation code. The protocol has automatically credited a permanent hashrate boost.'}
                </p>

                {/* Speed increment metrics card */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      Hashrate Speed Modification
                    </span>
                    <span className="font-mono">+{selectedEvent.speedIncreasePercent.toFixed(1)}% Applied</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    Cumulative syndicate boost is now active on all daily BHFT mining calculations.
                  </div>
                </div>

                {/* Referee Wallet Address */}
                {selectedEvent.refereeAddress && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-400 font-medium">Referee BEP-20 Address</div>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/60 border border-white/10 font-mono text-xs text-white">
                      <span className="truncate">{selectedEvent.refereeAddress}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => copyToClipboard(selectedEvent.refereeAddress)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                          title="Copy address"
                        >
                          {copiedAddr === selectedEvent.refereeAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`https://bscscan.com/address/${selectedEvent.refereeAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                          title="View on BscScan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Settled & Cryptographically Verified</span>
                </div>

                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
