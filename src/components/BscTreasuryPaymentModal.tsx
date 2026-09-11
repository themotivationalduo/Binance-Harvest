import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  X,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  ArrowRight,
  Clock,
  Loader2,
  Send,
  HelpCircle,
  Sparkles,
  Wallet,
  Coins,
  RefreshCw,
  Smartphone,
  Globe,
  Zap,
  Check,
  ChevronLeft,
  Layers,
} from 'lucide-react';
import { 
  TREASURY_WALLET, 
  sendBNBTransaction, 
  switchToBSC, 
  getOrInitSigner, 
  connectWallet, 
  SupportedWalletType 
} from '../services/web3';
import { useRuntimeContext } from '../services/runtimeContext';
import { getTonConnectUI, isValidTonAddress } from '../services/tonWallet';
import { ethers } from 'ethers';

export interface BscTreasuryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentType: 'UPGRADE' | 'WITHDRAW_FEE';
  targetTier?: number;
  costUSD: number;
  bnbPrice: number;
  userAddress: string;
  isTonWallet?: boolean;
  onSuccess: (result: {
    txHash: string;
    amountBNB: number;
    amountUSD: number;
    blockNumber: number;
    confirmations: number;
  }) => void;
}

export type CheckoutFlowMode = 'TELEGRAM_MINI_APP' | 'NATIVE_WEB3';

export const BscTreasuryPaymentModal: React.FC<BscTreasuryPaymentModalProps> = ({
  isOpen,
  onClose,
  paymentType,
  targetTier,
  costUSD,
  bnbPrice,
  userAddress,
  isTonWallet = false,
  onSuccess,
}) => {
  const runtime = useRuntimeContext();

  // Determine initial flow mode dynamically:
  // Telegram Mini App execution detected via window.Telegram?.WebApp?.initData (non-empty) or TON session
  const [activeFlow, setActiveFlow] = useState<CheckoutFlowMode>(() => {
    return runtime.isTelegram || isTonWallet ? 'TELEGRAM_MINI_APP' : 'NATIVE_WEB3';
  });

  // Steps for Telegram / Manual Flow: 'DETAILS' -> 'SUBMIT_TX' -> 'VERIFYING' -> 'SUCCESS'
  const [step, setStep] = useState<'DETAILS' | 'SUBMIT_TX' | 'VERIFYING' | 'SUCCESS'>('DETAILS');

  // Input states
  const [txInput, setTxInput] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [confirmations, setConfirmations] = useState<number>(0);
  const [requiredConfirmations, setRequiredConfirmations] = useState<number>(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<any>(null);

  // Sender address lookup helper
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [detectedTxs, setDetectedTxs] = useState<Array<{ hash: string; blockNumber: number; valueBNB: number }>>([]);

  // Direct Web3 (Native DApp Browser) states
  const [isDirectSigning, setIsDirectSigning] = useState(false);
  const [directSignStatus, setDirectSignStatus] = useState<string>('');
  const [isConnectingWeb3, setIsConnectingWeb3] = useState(false);
  const [connectedWeb3Address, setConnectedWeb3Address] = useState<string>(
    userAddress && userAddress.startsWith('0x') ? userAddress : ''
  );

  const effectiveBnbPrice = bnbPrice && bnbPrice > 0 ? bnbPrice : 750;
  const bnbAmount = Number((costUSD / effectiveBnbPrice).toFixed(5));

  // Sync flow whenever modal opens or runtime context changes
  useEffect(() => {
    if (isOpen) {
      const defaultFlow: CheckoutFlowMode =
        runtime.isTelegram || isTonWallet ? 'TELEGRAM_MINI_APP' : 'NATIVE_WEB3';
      setActiveFlow(defaultFlow);
      setStep('DETAILS');
      setTxInput('');
      setErrorMessage(null);
      setVerifiedData(null);
      setConfirmations(0);
      setDetectedTxs([]);
      setIsDirectSigning(false);
      setDirectSignStatus('');

      if (userAddress && userAddress.startsWith('0x')) {
        setConnectedWeb3Address(userAddress);
      }

      // Generate payment URI QR Code for BSC BEP-20
      const paymentUri = `ethereum:${TREASURY_WALLET}@56?value=${Math.floor(bnbAmount * 1e18)}`;
      QRCode.toDataURL(paymentUri, {
        width: 260,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {
          QRCode.toDataURL(TREASURY_WALLET, { width: 260, margin: 1 })
            .then(setQrDataUrl)
            .catch(console.error);
        });
    }
  }, [isOpen, costUSD, bnbAmount, runtime.isTelegram, isTonWallet, userAddress]);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(TREASURY_WALLET);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(bnbAmount.toString());
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  // Helper to lookup sender's transactions if they pasted a wallet address instead of TxID
  const handleLookupSender = async (address: string) => {
    if (!address.startsWith('0x') || address.length !== 42) return;
    try {
      setIsLookingUp(true);
      const res = await fetch('/api/lookup-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderAddress: address }),
      });
      const data = await res.json();
      if (data.transactions && data.transactions.length > 0) {
        setDetectedTxs(data.transactions);
      }
    } catch (e) {
      console.warn('Could not auto-lookup sender:', e);
    } finally {
      setIsLookingUp(false);
    }
  };

  // Trigger Backend RPC Payment Verification with 3-12 block confirmations check
  const handleVerifyPayment = async (hashToVerify?: string) => {
    const targetHash = (hashToVerify || txInput).trim();
    setErrorMessage(null);

    // If user provided a 42-char address instead of 66-char txHash
    if (targetHash.length === 42 && targetHash.startsWith('0x')) {
      handleLookupSender(targetHash);
      setErrorMessage('You entered a BNB Wallet Address. Looking up recent transactions from this address...');
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(targetHash)) {
      setErrorMessage(
        'Invalid TxID format. A Binance Smart Chain transaction hash must start with 0x followed by 64 hexadecimal characters.'
      );
      return;
    }

    setIsVerifying(true);
    setStep('VERIFYING');
    setVerifyMessage('Connecting to Binance Smart Chain RPC for block confirmation...');

    const payload = {
      txHash: targetHash,
      userAddress: connectedWeb3Address || userAddress,
      paymentType,
      targetTier,
      expectedUSD: costUSD,
      bnbPrice: effectiveBnbPrice,
    };

    const pollVerification = async (attempt = 1) => {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.status === 409 || data.code === 'REPLAY_ATTACK') {
          // Replay attack caught!
          setIsVerifying(false);
          setIsDirectSigning(false);
          setErrorMessage(
            data.error || 'REPLAY ATTACK PREVENTED: This transaction hash has already been credited in the system.'
          );
          return;
        }

        if (!response.ok && !data.pending) {
          setIsVerifying(false);
          setIsDirectSigning(false);
          setErrorMessage(data.error || 'Verification failed on Binance Smart Chain.');
          return;
        }

        if (data.pending) {
          // In progress: waiting for block confirmation
          setConfirmations(data.confirmations || 1);
          setRequiredConfirmations(data.requiredConfirmations || 3);
          setVerifyMessage(data.message || 'Waiting for block confirmations on BNB Chain...');

          if (attempt < 25) {
            setTimeout(() => pollVerification(attempt + 1), 3000);
          } else {
            setIsVerifying(false);
            setIsDirectSigning(false);
            setErrorMessage(
              'Network confirmation timeout. The transaction is still propagating on BSC. Tap Verify again in a few seconds.'
            );
          }
          return;
        }

        if (data.success) {
          // Verified successfully!
          setIsVerifying(false);
          setIsDirectSigning(false);
          setStep('SUCCESS');
          setVerifiedData(data);

          // Confetti celebration
          confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
          });

          onSuccess({
            txHash: data.txHash,
            amountBNB: data.amountBNB,
            amountUSD: data.amountUSD,
            blockNumber: data.blockNumber,
            confirmations: data.confirmations,
          });
        }
      } catch (err: any) {
        console.error('Payment verification error:', err);
        setIsVerifying(false);
        setIsDirectSigning(false);
        setErrorMessage(err.message || 'Unable to communicate with backend verification service.');
      }
    };

    pollVerification();
  };

  // Direct 1-Tap On-Chain Web3 Checkout Flow (Native DApp Browser / window.ethereum / WalletConnect)
  const handleDirectWeb3Pay = async () => {
    try {
      setErrorMessage(null);
      setIsDirectSigning(true);
      setDirectSignStatus('Initializing Web3 signer and checking network...');

      let signer: ethers.Signer | null = null;
      try {
        signer = await getOrInitSigner();
      } catch (signerErr) {
        console.warn('Signer acquisition notice, attempting fresh provider:', signerErr);
      }

      if (!signer) {
        // Attempt connecting with injected provider (MetaMask / Trust / OKX / TokenPocket)
        setDirectSignStatus('Connecting to your Web3 wallet...');
        const hasEth = typeof window !== 'undefined' && Boolean((window as any).ethereum);
        const res = await connectWallet(hasEth ? 'injected' : 'walletconnect');
        signer = res.signer;
        setConnectedWeb3Address(res.address);
      }

      // Check BSC chain
      if (signer.provider) {
        const net = await signer.provider.getNetwork();
        if (Number(net.chainId) !== 56) {
          setDirectSignStatus('Switching wallet to Binance Smart Chain Mainnet (Chain ID 56)...');
          const switched = await switchToBSC();
          if (!switched) {
            throw new Error('Please switch your wallet to Binance Smart Chain Mainnet (Chain ID 56).');
          }
        }
      }

      setDirectSignStatus('Please confirm transaction in your Web3 wallet...');
      const { txHash, bnbAmountStr } = await sendBNBTransaction(signer, costUSD, bnbPrice);

      setDirectSignStatus(`Broadcasted! Hash: ${txHash.substring(0, 10)}... Verifying on BSC...`);
      // Seamlessly hand over to backend RPC verification & block confirmation
      await handleVerifyPayment(txHash);
    } catch (err: any) {
      console.error('Direct Web3 Payment error:', err);
      setIsDirectSigning(false);
      setDirectSignStatus('');
      setErrorMessage(
        err?.message || 'Transaction was cancelled or failed in your Web3 wallet.'
      );
    }
  };

  // Connect Web3 wallet directly from inside the checkout modal
  const handleConnectWeb3InModal = async (type: SupportedWalletType = 'injected') => {
    try {
      setIsConnectingWeb3(true);
      setErrorMessage(null);
      const res = await connectWallet(type);
      if (res && res.address) {
        setConnectedWeb3Address(res.address);
      }
    } catch (err: any) {
      console.warn('Modal Web3 connect notice:', err);
      setErrorMessage(err.message || 'Could not connect Web3 wallet.');
    } finally {
      setIsConnectingWeb3(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-lg bg-[#0B0E11]/95 border border-white/20 rounded-3xl p-5 sm:p-6 md:p-7 shadow-[0_16px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10 backdrop-blur-2xl text-white my-6 max-h-[92vh] overflow-y-auto custom-scrollbar"
      >
        {/* Glow ambient highlights */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#F3BA2F]/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -ml-12 -mb-12" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/40 flex items-center justify-center shadow-md shadow-amber-500/10">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Web3 Checkout
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold font-mono">
                  BSC Mainnet (56)
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {paymentType === 'UPGRADE'
                  ? `Mining Cluster Upgrade (Tier ${targetTier})`
                  : 'On-Chain KYC Verification Fee'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Runtime Environment Context Badge & Dynamic Flow Switcher */}
        <div className="mt-3.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-1 relative z-10">
          <button
            type="button"
            onClick={() => {
              setActiveFlow('TELEGRAM_MINI_APP');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeFlow === 'TELEGRAM_MINI_APP'
                ? 'bg-sky-500/20 border border-sky-400/40 text-sky-200 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span>Telegram OTC</span>
            {runtime.isTelegram && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-sky-400/30 text-sky-200 font-bold">
                Auto
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFlow('NATIVE_WEB3');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeFlow === 'NATIVE_WEB3'
                ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Direct on-chain</span>
            {!runtime.isTelegram && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/30 text-amber-200 font-bold">
                Auto
              </span>
            )}
          </button>
        </div>

        {/* Detected Context Banner */}
        <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activeFlow === 'TELEGRAM_MINI_APP' ? 'bg-sky-400' : 'bg-emerald-400'
              } animate-pulse`}
            />
            <span>Active Checkout Mode:</span>
            <strong className="text-white">
              {activeFlow === 'TELEGRAM_MINI_APP'
                ? 'Telegram Mini App (OTC / QR & TxID)'
                : 'Native Web3 / DApp In-Browser Signing'}
            </strong>
          </span>
          <span className="text-[10px] text-slate-500">
            {runtime.isTelegram ? 'Telegram WebApp Detected' : 'External DApp Browser'}
          </span>
        </div>

        {/* Error Notification */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-3.5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 shadow-lg shadow-rose-500/10"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold block text-rose-200">Checkout Notice</span>
                <span className="leading-relaxed break-words text-[11px]">{errorMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* FLOW 1: TELEGRAM MINI APP FLOW                                           */}
        {/* ========================================================================= */}
        {activeFlow === 'TELEGRAM_MINI_APP' && (
          <div className="relative z-10">
            {/* TON Connect Banner inside Telegram */}
            <div className="mt-3.5 p-3 rounded-2xl bg-sky-950/40 border border-sky-500/30 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center font-bold text-xs shrink-0">
                  💎
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    TON Connect Active
                    <span className="text-[9px] px-1.5 py-0.2 bg-sky-400/20 text-sky-300 rounded font-semibold border border-sky-400/30">
                      Telegram Webview
                    </span>
                  </div>
                  <p className="text-[10px] text-sky-300/70 truncate font-mono">
                    {userAddress ? `${userAddress.substring(0, 10)}...${userAddress.substring(userAddress.length - 4)}` : 'Logged in via Telegram Bot'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    getTonConnectUI().openModal();
                  } catch (e) {
                    console.warn("TON modal notice:", e);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[10px] text-sky-300 font-semibold transition cursor-pointer shrink-0"
              >
                Switch TON
              </button>
            </div>

            {/* STEP 1: DETAILS & QR CODE */}
            {step === 'DETAILS' && (
              <div className="mt-4 space-y-4">
                {/* Dynamic Amount Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-950 border border-amber-500/30">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Required Treasury Fee</span>
                    <span className="font-semibold text-amber-400">
                      {paymentType === 'UPGRADE' ? `Tier ${targetTier} Upgrade` : 'KYC Verification'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
                        {bnbAmount} <span className="text-sm font-semibold text-white/80">BNB</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ≈ ${costUSD.toFixed(2)} USD (Live Oracle: ${effectiveBnbPrice.toFixed(0)}/BNB)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedAmount ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{copiedAmount ? 'Copied' : 'Copy Amount'}</span>
                    </button>
                  </div>
                </div>

                {/* QR Code & Treasury Address Component */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col items-center text-center">
                  <div className="p-2.5 bg-white rounded-2xl shadow-xl border border-amber-500/40">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Binance Smart Chain Treasury QR Code"
                        className="w-40 h-40 sm:w-44 sm:h-44 rounded-lg"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center">
                        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Scan with Trust Wallet, Binance, OKX, or TokenPocket</span>
                  </div>

                  {/* Address with One-Tap Copy Button */}
                  <div className="w-full mt-3 p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2 text-left">
                    <div className="overflow-hidden min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                        BSC Treasury Wallet (BEP-20)
                      </div>
                      <div className="font-mono text-xs text-amber-300 truncate select-all">
                        {TREASURY_WALLET}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="shrink-0 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAddress ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Over-The-Counter Mobile Instructions */}
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-slate-300">
                  <div className="font-semibold text-white flex items-center gap-1.5 text-[11px]">
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Manual Transfer Guide:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                    <li>Copy the Treasury Address above.</li>
                    <li>Open Binance, Trust Wallet, OKX, or Bitget.</li>
                    <li>Send exactly <strong className="text-amber-300 font-mono">{bnbAmount} BNB</strong> on <strong className="text-white">BNB Smart Chain (BEP-20)</strong>.</li>
                    <li>Tap <strong className="text-white">"I Have Transferred BNB"</strong> below to paste your TxID.</li>
                  </ol>
                </div>

                {/* Next Step Button */}
                <button
                  type="button"
                  onClick={() => setStep('SUBMIT_TX')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>I Have Transferred BNB (Enter TxID)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: SUBMIT TRANSACTION HASH FORM */}
            {step === 'SUBMIT_TX' && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('DETAILS')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back to QR & Address</span>
                  </button>
                  <span className="text-[11px] text-amber-400 font-mono">Step 2: Verification</span>
                </div>

                {/* Form Input Container */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3">
                  <label className="block text-xs font-semibold text-slate-200">
                    Submit BSC Transaction Hash (TxID)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={txInput}
                      onChange={(e) => {
                        setTxInput(e.target.value.trim());
                        setErrorMessage(null);
                        if (e.target.value.trim().length === 42) {
                          handleLookupSender(e.target.value.trim());
                        }
                      }}
                      placeholder="0x... (66-character BSC transaction hash)"
                      className="w-full py-3 px-3.5 rounded-xl bg-slate-900 border border-white/20 text-white placeholder-slate-500 text-xs font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    {txInput && (
                      <button
                        type="button"
                        onClick={() => setTxInput('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Clipboard helper */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setTxInput(text.trim());
                            if (text.trim().length === 42) {
                              handleLookupSender(text.trim());
                            }
                          }
                        } catch {
                          // Clipboard permission
                        }
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Paste from Clipboard</span>
                    </button>
                    <span className="text-[10px] text-slate-400">BEP-20 network only</span>
                  </div>
                </div>

                {/* Auto-detected candidate transactions if user entered sender address */}
                {isLookingUp && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-amber-300">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Searching Binance Smart Chain for recent transfers...</span>
                  </div>
                )}

                {detectedTxs.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Detected Recent Transfers to Treasury:
                    </div>
                    {detectedTxs.map((t) => (
                      <button
                        key={t.hash}
                        type="button"
                        onClick={() => {
                          setTxInput(t.hash);
                          handleVerifyPayment(t.hash);
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-left flex items-center justify-between gap-2 text-xs transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-white text-[11px] truncate">{t.hash}</div>
                          <div className="text-[10px] text-slate-400">Block #{t.blockNumber}</div>
                        </div>
                        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold shrink-0">
                          {t.valueBNB} BNB
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Verification Notice */}
                <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5 text-[11px] text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    Verification is performed server-side via BSC RPC nodes. Replay attacks are rejected, and 3-12 block confirmations are verified.
                  </p>
                </div>

                {/* Submit TxID Button */}
                <button
                  type="button"
                  disabled={isVerifying || !txInput.trim()}
                  onClick={() => handleVerifyPayment()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Validating on BSC...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Payment on BSC</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 2: STANDARD WEB3 / NATIVE DAPP BROWSER FLOW                          */}
        {/* ========================================================================= */}
        {activeFlow === 'NATIVE_WEB3' && step !== 'VERIFYING' && step !== 'SUCCESS' && (
          <div className="mt-4 space-y-4 relative z-10">
            {/* Connected Wallet Info Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-black border border-white/15 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Web3 Connected Wallet</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  BSC Network (56)
                </span>
              </div>

              {connectedWeb3Address && connectedWeb3Address.startsWith('0x') ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      ⚡
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-xs font-bold text-white font-mono truncate">
                        {connectedWeb3Address.substring(0, 10)}...{connectedWeb3Address.substring(connectedWeb3Address.length - 6)}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        Ready for Direct In-App Signature
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-mono">
                    BEP-20
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <p className="text-xs text-amber-200">
                    No active Web3 wallet connected yet. Connect with your browser wallet or WalletConnect:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {typeof window !== 'undefined' && Boolean((window as any).ethereum) && (
                      <button
                        type="button"
                        disabled={isConnectingWeb3}
                        onClick={() => handleConnectWeb3InModal('injected')}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Direct Connect</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isConnectingWeb3}
                      onClick={() => handleConnectWeb3InModal('walletconnect')}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Wallet Connect</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Payable Amount
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5">
                    {bnbAmount} <span className="text-xs font-semibold text-white/70">BNB</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ≈ ${costUSD.toFixed(2)} USD (@ ${effectiveBnbPrice.toFixed(0)}/BNB)
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Recipient
                  </div>
                  <div className="text-xs text-amber-300 font-mono font-semibold">
                    Treasury Pool
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                    {TREASURY_WALLET.substring(0, 6)}...{TREASURY_WALLET.substring(TREASURY_WALLET.length - 4)}
                  </div>
                </div>
              </div>
            </div>

            {/* Direct 1-Tap Sign Button */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isDirectSigning}
                onClick={handleDirectWeb3Pay}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isDirectSigning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    <span>{directSignStatus || 'Processing in Wallet...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-slate-950" />
                    <span>1-Tap Sign & Pay ({bnbAmount} BNB)</span>
                  </>
                )}
              </button>

              {/* Fallback to manual QR & TxID payment */}
              <button
                type="button"
                onClick={() => {
                  setActiveFlow('TELEGRAM_MINI_APP');
                  setStep('DETAILS');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-amber-300 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Prefer Manual OTC Transfer? View QR & Address</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SHARED STEP 3: VERIFYING PROGRESS (BLOCK CONFIRMATIONS)                   */}
        {/* ========================================================================= */}
        {step === 'VERIFYING' && (
          <div className="mt-5 py-6 px-4 rounded-2xl bg-slate-950/70 border border-amber-500/30 text-center space-y-4 relative z-10">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              <Coins className="w-7 h-7 text-amber-400" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                Validating On-Chain Payment
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto leading-relaxed">
                {verifyMessage}
              </p>
            </div>

            {/* Block confirmation progress badge */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 inline-flex flex-col items-center gap-1.5">
              <div className="text-[11px] text-slate-400 font-semibold">
                Binance Smart Chain Block Confirmations
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className={`w-8 h-2 rounded-full transition-all duration-500 ${
                      confirmations >= num
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs font-mono font-bold text-amber-300">
                {confirmations} / {requiredConfirmations} Blocks Verified
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              Guarding against chain re-organizations and verifying recipient address...
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SHARED STEP 4: SUCCESS CONFIRMATION                                       */}
        {/* ========================================================================= */}
        {step === 'SUCCESS' && (
          <div className="mt-5 py-6 px-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 text-center space-y-4 relative z-10">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Payment Confirmed On-Chain!</h3>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                {paymentType === 'UPGRADE'
                  ? `Your Mining Rig has been upgraded to Tier ${targetTier}!`
                  : 'Your account KYC is officially verified on BSC!'}
              </p>
            </div>

            {verifiedData && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Hash:</span>
                  <a
                    href={`https://bscscan.com/tx/${verifiedData.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 font-mono hover:underline flex items-center gap-1"
                  >
                    {verifiedData.txHash?.substring(0, 10)}... <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Verified:</span>
                  <span className="font-mono text-white font-bold">
                    {verifiedData.amountBNB} BNB (${verifiedData.amountUSD?.toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Confirmations:</span>
                  <span className="text-emerald-400 font-bold">
                    {verifiedData.confirmations} Blocks Verified
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-white">Binance Smart Chain (BEP-20)</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              Continue Mining
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
};
