import React, { useState, useEffect } from 'react';
import { TransactionRecord, UserProfile } from '../types';
import { getTransactionHistory } from '../services/firebase';
import { History, CheckCircle2, Clock, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';

interface TransactionHistoryProps {
  user: UserProfile;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess } = useInitiativeFeedback();

  const fetchTxs = async (manual = false) => {
    try {
      setLoading(true);
      const records = await getTransactionHistory(user.walletAddress);
      setTransactions(records);
      if (manual) {
        showSuccess({
          initiativeName: 'On-Chain Audit Records',
          title: 'Audit Ledger Refreshed',
          badge: `${records.length} Records`,
          description: `Successfully synchronized ${records.length} on-chain BSC transaction records.`,
        });
      }
    } catch (e) {
      console.error("Failed to load transaction history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTxs(false);
  }, [user.walletAddress]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 pb-36 sm:pb-40 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-[#F3BA2F]" />
            Transaction & Audit History
          </h1>
          <p className="text-xs text-[#848E9C]">
            Verified blockchain interaction logs for your account
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fetchTxs(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E2329] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-[#848E9C] hover:text-white transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </motion.button>
      </div>

      <div className="bg-[#1E2329] rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#848E9C]">Loading audit records...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Transaction Records Found</p>
            <p className="text-xs text-[#848E9C]">
              Your tier upgrades and verification payments will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)] text-[11px] uppercase tracking-wider text-[#848E9C] bg-[#0B0E11]/50">
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Tx Hash / ID</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-xs mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        tx.type === 'UPGRADE' ? 'bg-[#F3BA2F]' :
                        tx.type === 'WITHDRAW_FEE' ? 'bg-emerald-400' : 'bg-blue-400'
                      }`} />
                      {tx.type}
                    </td>
                    <td className="p-4 text-white">
                      {tx.amountBNB ? `${tx.amountBNB} BNB` : `$${tx.amountUSD} USD`}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 ${
                        tx.status === 'SUCCESS' ? 'bg-[#00C087]/20 text-[#00C087]' :
                        tx.status === 'PENDING' ? 'bg-[#F3BA2F]/20 text-[#F3BA2F]' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3" />}
                        {tx.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {tx.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-4 text-[#848E9C]">
                      {tx.txHash ? (
                        <a
                          href={`https://bscscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#0B0E11] hover:bg-white/10 px-2.5 py-1 rounded border border-white/10 flex items-center gap-1.5 w-fit text-[#F3BA2F] hover:text-amber-300 transition"
                          title="Verify transaction on BscScan"
                        >
                          <span className="font-mono">{tx.txHash.substring(0, 8)}...{tx.txHash.substring(tx.txHash.length - 6)}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="bg-[#0B0E11] px-2 py-1 rounded border border-white/5 font-mono text-slate-500">
                          {tx.id.substring(0, 10)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[#848E9C]">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
