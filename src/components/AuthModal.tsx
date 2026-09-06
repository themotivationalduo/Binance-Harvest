import React, { useState } from 'react';
import { Mail, Lock, CheckCircle2, AlertCircle, X, ShieldCheck, FileText, ChevronLeft, ArrowRight, Wallet } from 'lucide-react';
import { auth, getUserProfile, updateUserProfileFields } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { UserProfile } from '../types';
import { connectWallet } from '../services/web3';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  initialMode?: 'register' | 'login';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialMode = 'register',
}) => {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!acceptedTerms) {
        setError("You must accept the Terms and Conditions to register.");
        return;
      }
    }

    try {
      setLoading(true);
      const userEmail = email.trim();

      if (auth) {
        if (isRegister) {
          try {
            await createUserWithEmailAndPassword(auth, userEmail, password);
          } catch (err: any) {
            // If email already exists, continue to profile lookup
            if (err.code !== 'auth/email-already-in-use') {
              throw err;
            }
          }
        } else {
          try {
            await signInWithEmailAndPassword(auth, userEmail, password);
          } catch (err: any) {
            console.warn("Auth sign-in fallback:", err);
          }
        }
      }

      // Load or initialize profile
      const profile = await getUserProfile(userEmail);
      onLoginSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWeb3Login = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await connectWallet();
      if (res && res.address) {
        const profile = await getUserProfile(res.address);
        await updateUserProfileFields(res.address, { walletAddress: res.address });
        onLoginSuccess({ ...profile, walletAddress: res.address });
        onClose();
      }
    } catch (err: any) {
      console.error("Web3 login error:", err);
      if (err?.message?.includes("WEB3_WALLET_NOT_FOUND")) {
        setError("No Web3 wallet detected. Please install MetaMask, Trust Wallet, or open this app in your Web3 browser.");
      } else {
        setError(err?.message || "Failed to authenticate with Web3 wallet.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex min-h-screen items-center justify-center animate-fade-in overscroll-contain">
      <div className="relative w-full max-w-md my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-[#1E2329]/95 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.8)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Top Header - Fixed above scrollable body */}
        <div className="p-5 sm:p-6 pb-3 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#F3BA2F] rounded-xl flex items-center justify-center shadow-lg shadow-[#F3BA2F]/20">
                <ShieldCheck className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Binance<span className="text-[#F3BA2F]">Harvest</span>
                </h2>
                <p className="text-xs text-[#848E9C]">
                  Decentralized Cloud Mining Hub
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#848E9C] hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Segmented Tab Switcher for both Authentication Pages */}
          <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10 mt-4">
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
                setShowTermsModal(false);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isRegister && !showTermsModal
                  ? 'bg-[#F3BA2F] text-black shadow-md shadow-[#F3BA2F]/25'
                  : 'text-[#848E9C] hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Create Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
                setShowTermsModal(false);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                !isRegister && !showTermsModal
                  ? 'bg-[#F3BA2F] text-black shadow-md shadow-[#F3BA2F]/25'
                  : 'text-[#848E9C] hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body - Both Authentication Pages scroll smoothly */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 touch-pan-y custom-scrollbar">
          
          {showTermsModal ? (
            /* Scrollable Terms & Conditions reader view */
            <div className="space-y-4 text-xs text-[#848E9C]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="flex items-center gap-1 text-[#F3BA2F] hover:underline font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Registration</span>
                </button>
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Protocol Terms</span>
              </div>

              <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-3 leading-relaxed text-slate-300">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#F3BA2F]" />
                  <span>BinanceHarvest Mining Protocol Terms</span>
                </h4>
                <p>
                  1. <strong className="text-white">Proof of Stake & Cloud Mining:</strong> Users participate in automated cloud yield hashing pegged to real-time Binance Smart Chain (BSC) blocks.
                </p>
                <p>
                  2. <strong className="text-white">Tier Upgrades & Verification Fees:</strong> Upgrades to higher mining tiers require a $1.00 USD fee in BNB. Final withdrawal verification requires a $5.00 USD transaction sent to the verified Treasury Wallet. All fees are recorded on-chain.
                </p>
                <p>
                  3. <strong className="text-white">Blockchain Risks:</strong> Cryptocurrency values fluctuate based on open market conditions. Mining reward estimates are based on live BNB/USDT pricing feeds.
                </p>
                <p>
                  4. <strong className="text-white">Account Security:</strong> You are responsible for safeguarding your credentials and private Web3 wallet keys. Never share private keys with anyone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                className="w-full bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold py-2.5 rounded-xl text-xs transition active:scale-95 shadow-md shadow-[#F3BA2F]/20 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept Terms & Return</span>
              </button>
            </div>
          ) : isRegister ? (
            /* ==================================================== */
            /* PAGE 1: CREATE ACCOUNT (REGISTER) - FULLY SCROLLABLE */
            /* ==================================================== */
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Create Your Miner Account</h3>
                <p className="text-xs text-[#848E9C]">
                  Start fresh at Tier 1 with 0 points and initialize your mining dashboard.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#848E9C]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="miner@binanceharvest.io"
                      className="w-full bg-[#0B0E11]/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F3BA2F] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5">
                    Choose Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#848E9C]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0B0E11]/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F3BA2F] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#848E9C]" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0B0E11]/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F3BA2F] transition"
                    />
                  </div>
                </div>

                {/* Terms Agreement Checkbox & Scrollable Terms Link */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="terms-check"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-[#0B0E11] text-[#F3BA2F] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="terms-check" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-[#F3BA2F] font-semibold underline hover:text-amber-300 transition"
                      >
                        Terms and Conditions
                      </button>{' '}
                      and understand BSC blockchain mining protocol terms.
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold py-3 rounded-xl text-sm transition active:scale-95 disabled:opacity-50 shadow-lg shadow-[#F3BA2F]/20 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span>Registering Account...</span>
                  ) : (
                    <>
                      <span>Create Account & Start Fresh</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-[#848E9C] space-y-2">
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError(null);
                    }}
                    className="text-[#F3BA2F] font-bold hover:underline"
                  >
                    Sign In instead
                  </button>
                </p>

                <div className="pt-3 border-t border-white/10 flex flex-col items-center gap-2">
                  <div className="text-[11px] text-slate-400">Or authenticate via Web3 on-chain</div>
                  <button
                    type="button"
                    onClick={handleConnectWeb3Login}
                    disabled={loading}
                    className="w-full text-xs text-white hover:text-[#F3BA2F] transition flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 font-medium"
                  >
                    <Wallet className="w-4 h-4 text-[#F3BA2F]" />
                    <span>Sign in with Web3 Wallet (MetaMask / BSC)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==================================================== */
            /* PAGE 2: SIGN IN (LOGIN) - FULLY SCROLLABLE          */
            /* ==================================================== */
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Sign In to Mining Hub</h3>
                <p className="text-xs text-[#848E9C]">
                  Access your active cloud mining rigs, earned points, and withdrawal progress.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#848E9C]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="miner@binanceharvest.io"
                      className="w-full bg-[#0B0E11]/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F3BA2F] transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C]">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#848E9C]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0B0E11]/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F3BA2F] transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F3BA2F] hover:bg-[#e2ad23] text-black font-bold py-3 rounded-xl text-sm transition active:scale-95 disabled:opacity-50 shadow-lg shadow-[#F3BA2F]/20 flex items-center justify-center gap-2 mt-3"
                >
                  {loading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-[#848E9C] space-y-2">
                <p>
                  Need a new account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError(null);
                    }}
                    className="text-[#F3BA2F] font-bold hover:underline"
                  >
                    Create Account
                  </button>
                </p>

                <div className="pt-3 border-t border-white/10 flex flex-col items-center gap-2">
                  <div className="text-[11px] text-slate-400">Or authenticate via Web3 on-chain</div>
                  <button
                    type="button"
                    onClick={handleConnectWeb3Login}
                    disabled={loading}
                    className="w-full text-xs text-white hover:text-[#F3BA2F] transition flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 font-medium"
                  >
                    <Wallet className="w-4 h-4 text-[#F3BA2F]" />
                    <span>Sign in with Web3 Wallet (MetaMask / BSC)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subtle Footer hint indicating scrollability */}
        <div className="px-5 py-2.5 bg-black/40 border-t border-white/5 text-[11px] text-[#848E9C] text-center shrink-0">
          <span className="opacity-70">Scroll view to access all account settings</span>
        </div>
      </div>
    </div>
  );
};
