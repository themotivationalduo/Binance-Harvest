import React, { useState, useEffect } from 'react';
import { UserProfile, TransactionRecord } from '../types';
import { getAllUsers, deleteUserProfile, updateUserProfileFields, getTransactionHistory } from '../services/firebase';
import { useInitiativeFeedback } from '../context/InitiativeFeedbackContext';
import { Users, Trash2, Edit, CheckCircle2, XCircle, ShieldAlert, Activity, RefreshCw, Search, X, Calendar, Award, Coins, Flame } from 'lucide-react';

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showFailed } = useInitiativeFeedback();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [modalEditForm, setModalEditForm] = useState<Partial<UserProfile>>({});

  const fetchUsers = async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    const validUsers = allUsers.filter(u => u && typeof u.walletAddress === 'string' && u.walletAddress.trim() !== '');
    setUsers(validUsers.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)));
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    (user.walletAddress || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openUserModal = (user: UserProfile) => {
    setSelectedUser(user);
    setModalEditForm({
      totalPoints: user.totalPoints || 0,
      miningBalanceBNB: user.miningBalanceBNB || 0,
      currentTier: user.currentTier || 1,
      loginStreak: user.loginStreak || 0
    });
  };

  const handleSaveModalEdit = async () => {
    if (!selectedUser) return;
    await updateUserProfileFields(selectedUser.walletAddress, modalEditForm);
    setSelectedUser(null);
    showSuccess({
      initiativeName: 'Admin Action',
      title: 'Miner Audited',
      description: `Settings updated successfully for ${selectedUser.walletAddress}`,
      badge: 'AUDITED'
    });
    fetchUsers();
  };

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
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Registered Miners ({filteredUsers.length} / {users.length})
          </h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search wallet address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50 backdrop-blur-md transition-all"
            />
          </div>
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
              {filteredUsers.map((user) => (
                <tr key={user.walletAddress} className="hover:bg-white/[0.02] transition">
                  <td 
                    onClick={() => openUserModal(user)}
                    className="p-4 font-mono text-[#F3BA2F]/90 text-xs cursor-pointer hover:text-[#F3BA2F] hover:underline font-semibold transition"
                    title="Click to view and audit detailed user statistics"
                  >
                    {user.walletAddress && user.walletAddress.length > 10 ? (
                      `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}`
                    ) : (
                      user.walletAddress || 'Unknown'
                    )}
                  </td>
                  <td className="p-4 text-emerald-400 font-mono font-bold">
                    {editingUser === user.walletAddress ? (
                      <input 
                        type="number" 
                        value={editForm.totalPoints || 0} 
                        onChange={(e) => setEditForm({ ...editForm, totalPoints: Number(e.target.value) })}
                        className="w-24 bg-slate-950 border border-emerald-500/50 rounded px-2 py-1 text-emerald-400 outline-none"
                      />
                    ) : (
                      (user.totalPoints || 0).toLocaleString()
                    )}
                  </td>
                  <td className="p-4 text-[#F3BA2F] font-bold">
                    {editingUser === user.walletAddress ? (
                      <input 
                        type="number" 
                        value={editForm.currentTier || 1} 
                        onChange={(e) => setEditForm({ ...editForm, currentTier: Number(e.target.value) })}
                        className="w-16 bg-slate-950 border border-[#F3BA2F]/50 rounded px-2 py-1 text-[#F3BA2F] outline-none"
                      />
                    ) : (
                      `T${user.currentTier || 1}`
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
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    {searchTerm ? "No miners matching search query found." : "No active miners found in the ledger."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Auditing and Editing Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-xl w-full mirror-glass rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 animate-in fade-in zoom-in duration-200">
            {/* Modal Glow effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#F3BA2F]/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00C087]/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F3BA2F]/20 text-[#F3BA2F] rounded-xl flex items-center justify-center border border-[#F3BA2F]/30">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Audit Miner Profile</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5 select-all">
                    {selectedUser.walletAddress}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 relative z-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* Core Ledger Parameters (Editable) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ledger Metrics (Editable)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Total Lifetime Points */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Total Lifetime Points
                    </label>
                    <input 
                      type="number"
                      value={modalEditForm.totalPoints || 0}
                      onChange={(e) => setModalEditForm({ ...modalEditForm, totalPoints: Number(e.target.value) })}
                      className="w-full bg-slate-950/80 border border-white/10 focus:border-amber-400/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition"
                    />
                  </div>

                  {/* Mining Balance BNB */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      Main Mining Balance (BNB)
                    </label>
                    <input 
                      type="number"
                      step="0.0001"
                      value={modalEditForm.miningBalanceBNB || 0}
                      onChange={(e) => setModalEditForm({ ...modalEditForm, miningBalanceBNB: Number(e.target.value) })}
                      className="w-full bg-slate-950/80 border border-white/10 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition"
                    />
                  </div>

                  {/* Current Miner Tier */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      Current Miner Tier
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="10"
                      value={modalEditForm.currentTier || 1}
                      onChange={(e) => setModalEditForm({ ...modalEditForm, currentTier: Number(e.target.value) })}
                      className="w-full bg-slate-950/80 border border-white/10 focus:border-blue-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition"
                    />
                  </div>

                  {/* Login Streak */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-red-400" />
                      Active Daily Streak
                    </label>
                    <input 
                      type="number"
                      value={modalEditForm.loginStreak || 0}
                      onChange={(e) => setModalEditForm({ ...modalEditForm, loginStreak: Number(e.target.value) })}
                      className="w-full bg-slate-950/80 border border-white/10 focus:border-red-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Historic Timestamps (Read-Only) */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Audit Trail & Identity
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Registration Date</span>
                    <span className="text-slate-300 font-semibold font-mono">
                      {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Last Active Timestamp</span>
                    <span className="text-slate-300 font-semibold font-mono">
                      {selectedUser.lastActiveTimestamp ? new Date(selectedUser.lastActiveTimestamp).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Last Claim Date</span>
                    <span className="text-slate-300 font-semibold font-mono">
                      {selectedUser.lastClaimDate || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Withdrawal Status</span>
                    <span className="text-slate-300 font-semibold">
                      {selectedUser.withdrawalStatus || 'NOT_STARTED'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-white/10 bg-black/40 flex flex-col sm:flex-row gap-2 sm:justify-between items-center relative z-10">
              <button
                onClick={() => {
                  handleDeleteUser(selectedUser.walletAddress);
                  setSelectedUser(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/25 transition text-xs font-bold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wipe Miner Ledger</span>
              </button>

              <div className="flex w-full sm:w-auto gap-2">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModalEdit}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold text-xs shadow-lg shadow-[#F3BA2F]/20 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
