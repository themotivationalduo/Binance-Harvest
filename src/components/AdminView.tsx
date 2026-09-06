import React, { useState, useEffect } from 'react';
import { UserProfile, TransactionRecord } from '../types';
import { getAllUsers, deleteUserProfile, updateUserProfileFields, getTransactionHistory } from '../services/firebase';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { Users, Trash2, Edit, CheckCircle2, XCircle, ShieldAlert, Activity, RefreshCw } from 'lucide-react';

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  const fetchUsers = async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    setUsers(allUsers.sort((a, b) => b.totalPoints - a.totalPoints));
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (walletAddress: string) => {
    if (!window.confirm(`Are you sure you want to completely delete miner ${walletAddress}?`)) return;
    
    await deleteUserProfile(walletAddress);
    setUsers(users.filter(u => u.walletAddress !== walletAddress));
    showSuccess({
      initiativeName: 'Admin Action',
      title: 'Miner Deleted',
      description: `User ${walletAddress} has been wiped from the ledger.`,
      badge: 'DELETED'
    });
  };

  const handleApproveWithdrawal = async (user: UserProfile) => {
    if (user.withdrawalStatus !== 'PENDING_ADMIN_APPROVAL') {
      showFailed({
        initiativeName: 'Admin Action',
        title: 'Action Denied',
        description: 'User does not have a pending withdrawal.'
      });
      return;
    }
    
    await updateUserProfileFields(user.walletAddress, { withdrawalStatus: 'APPROVED', isVerified: true });
    showSuccess({
      initiativeName: 'Admin Action',
      title: 'Withdrawal Approved',
      description: `Account verified and withdrawal approved for ${user.walletAddress}`,
      badge: 'APPROVED'
    });
    fetchUsers();
  };

  const handleRejectWithdrawal = async (user: UserProfile) => {
    await updateUserProfileFields(user.walletAddress, { withdrawalStatus: 'NOT_STARTED', isVerified: false });
    showSuccess({
      initiativeName: 'Admin Action',
      title: 'Withdrawal Rejected',
      description: `Settlement request rejected for ${user.walletAddress}`,
      badge: 'REJECTED'
    });
    fetchUsers();
  };

  const startEdit = (user: UserProfile) => {
    setEditingUser(user.walletAddress);
    setEditForm({
      totalPoints: user.totalPoints,
      currentTier: user.currentTier,
      loginStreak: user.loginStreak
    });
  };

  const saveEdit = async (walletAddress: string) => {
    await updateUserProfileFields(walletAddress, editForm);
    setEditingUser(null);
    showSuccess({
      initiativeName: 'Admin Action',
      title: 'Ledger Updated',
      description: `Miner settings updated successfully.`,
      badge: 'SAVED'
    });
    fetchUsers();
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-6">
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-red-500/20 p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                Treasury Administrator
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Terminal</h1>
            <p className="text-slate-400 text-sm mt-1">Manage global ledger, moderate withdrawals, and audit accounts.</p>
          </div>
          <button onClick={fetchUsers} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/10">
            <RefreshCw className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Registered Miners ({users.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 font-bold">
                <th className="p-4">Wallet ID</th>
                <th className="p-4">Points</th>
                <th className="p-4">Tier</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {users.map((user) => (
                <tr key={user.walletAddress} className="hover:bg-white/[0.02] transition">
                  <td className="p-4 font-mono text-slate-300 text-xs">
                    {user.walletAddress.substring(0, 6)}...{user.walletAddress.substring(user.walletAddress.length - 4)}
                  </td>
                  <td className="p-4 text-emerald-400 font-mono font-bold">
                    {editingUser === user.walletAddress ? (
                      <input 
                        type="number" 
                        value={editForm.totalPoints} 
                        onChange={(e) => setEditForm({ ...editForm, totalPoints: Number(e.target.value) })}
                        className="w-24 bg-slate-950 border border-emerald-500/50 rounded px-2 py-1 text-emerald-400 outline-none"
                      />
                    ) : (
                      user.totalPoints.toLocaleString()
                    )}
                  </td>
                  <td className="p-4 text-[#F3BA2F] font-bold">
                    {editingUser === user.walletAddress ? (
                      <input 
                        type="number" 
                        value={editForm.currentTier} 
                        onChange={(e) => setEditForm({ ...editForm, currentTier: Number(e.target.value) })}
                        className="w-16 bg-slate-950 border border-[#F3BA2F]/50 rounded px-2 py-1 text-[#F3BA2F] outline-none"
                      />
                    ) : (
                      `T${user.currentTier}`
                    )}
                  </td>
                  <td className="p-4">
                    {user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' ? (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">PENDING</span>
                    ) : user.withdrawalStatus === 'APPROVED' ? (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">APPROVED</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">MINING</span>
                    )}
                  </td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    {user.withdrawalStatus === 'PENDING_ADMIN_APPROVAL' && (
                      <>
                        <button onClick={() => handleApproveWithdrawal(user)} className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRejectWithdrawal(user)} className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    {editingUser === user.walletAddress ? (
                      <button onClick={() => saveEdit(user.walletAddress)} className="p-1.5 rounded bg-[#00C087]/20 text-[#00C087] hover:bg-[#00C087]/40 transition text-xs font-bold px-3">
                        Save
                      </button>
                    ) : (
                      <button onClick={() => startEdit(user)} className="p-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 transition">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button onClick={() => handleDeleteUser(user.walletAddress)} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/30 transition border border-red-500/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    No active miners found in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
