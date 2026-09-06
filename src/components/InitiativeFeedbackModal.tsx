import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  X, 
  RotateCcw, 
  Sparkles, 
  ShieldAlert, 
  Zap, 
  ArrowRight,
  HelpCircle
} from 'lucide-react';

export interface InitiativeFeedbackData {
  type: 'success' | 'failed';
  title: string;
  description: string;
  initiativeName?: string;
  txHash?: string;
  badge?: string;
  details?: { label: string; value: string }[];
  actionLabel?: string;
  onAction?: () => void;
  autoCloseMs?: number;
}

interface InitiativeFeedbackModalProps {
  feedback: InitiativeFeedbackData | null;
  onClose: () => void;
}

export const InitiativeFeedbackModal: React.FC<InitiativeFeedbackModalProps> = ({
  feedback,
  onClose,
}) => {
  useEffect(() => {
    if (!feedback) return;
    const duration = feedback.autoCloseMs ?? (feedback.type === 'success' ? 5000 : 0);
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [feedback, onClose]);

  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  // Confetti particles for success animation
  const particleAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overscroll-contain">
        {/* Backdrop motion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={
            isSuccess
              ? { scale: 0.8, opacity: 0, y: 30 }
              : { scale: 0.9, opacity: 0, x: 0 }
          }
          animate={
            isSuccess
              ? { scale: 1, opacity: 1, y: 0 }
              : { 
                  scale: 1, 
                  opacity: 1, 
                  x: [-14, 14, -10, 10, -5, 5, -2, 2, 0] 
                }
          }
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{
            type: isSuccess ? 'spring' : 'keyframes',
            stiffness: 300,
            damping: 22,
            duration: isSuccess ? undefined : 0.5,
          }}
          className={`relative w-full max-w-md overflow-hidden rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-2xl border transition-all ${
            isSuccess
              ? 'bg-[#1E2329]/95 border-emerald-500/30 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(0,192,135,0.18)] ring-1 ring-emerald-500/20'
              : 'bg-[#1E2329]/95 border-red-500/30 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(239,68,68,0.22)] ring-1 ring-red-500/20'
          }`}
        >
          {/* Subtle Ambient Mirror Glass Glow */}
          <div
            className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 ${
              isSuccess ? 'bg-emerald-400' : 'bg-red-500'
            }`}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-[#848E9C] hover:text-white hover:bg-white/10 transition z-10"
            aria-label="Close feedback"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Initiative Tag / Eyebrow */}
          {feedback.initiativeName && (
            <div className="flex justify-center mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border ${
                  isSuccess
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-red-500/10 text-red-400 border-red-500/25'
                }`}
              >
                {isSuccess ? <Sparkles className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>{feedback.initiativeName}</span>
              </span>
            </div>
          )}

          {/* Main Icon with Animation */}
          <div className="relative flex justify-center my-4">
            {isSuccess ? (
              <div className="relative flex items-center justify-center">
                {/* Expanding pulse wave */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: [0.8, 1.4, 1.6], opacity: [0.8, 0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                  className="absolute w-20 h-20 rounded-full bg-emerald-500/25"
                />

                {/* Particle bursts */}
                {particleAngles.map((deg, i) => {
                  const rad = (deg * Math.PI) / 180;
                  const distance = 48;
                  const x = Math.cos(rad) * distance;
                  const y = Math.sin(rad) * distance;

                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                      animate={{
                        scale: [0, 1, 0.6],
                        x: [0, x],
                        y: [0, y],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 0.8,
                        ease: 'easeOut',
                        delay: 0.15 + i * 0.03,
                      }}
                      className="absolute w-2 h-2 rounded-full bg-gradient-to-tr from-[#F3BA2F] to-emerald-300 shadow-sm"
                    />
                  );
                })}

                {/* Center Success Badge */}
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
                  className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white"
                >
                  <motion.svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.25, ease: 'easeOut' }}
                    />
                  </motion.svg>
                </motion.div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                {/* Red Pulse wave */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0.7 }}
                  animate={{ scale: [0.8, 1.35, 1.5], opacity: [0.7, 0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
                  className="absolute w-20 h-20 rounded-full bg-red-500/25"
                />

                {/* Center Failed Badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                  className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 text-white"
                >
                  <XCircle className="w-10 h-10 text-white" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Optional Badge Value (e.g. +500 PTS or Tier 2) */}
          {feedback.badge && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block my-1"
            >
              <span className="font-mono text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F3BA2F] via-amber-300 to-emerald-300">
                {feedback.badge}
              </span>
            </motion.div>
          )}

          {/* Title */}
          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-2 mb-2"
          >
            {feedback.title}
          </motion.h3>

          {/* Description / Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto mb-4 break-words"
          >
            {feedback.description}
          </motion.p>

          {/* Extra Details (if any) */}
          {feedback.details && feedback.details.length > 0 && (
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-3.5 mb-4 text-xs space-y-2 text-left">
              {feedback.details.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">{d.label}</span>
                  <span className="font-mono text-white font-medium truncate max-w-[200px]">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Transaction BscScan Link */}
          {feedback.txHash && (
            <div className="mb-4">
              <a
                href={`https://bscscan.com/tx/${feedback.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F3BA2F] hover:text-amber-300 transition font-mono"
              >
                <span>BscScan: {feedback.txHash.substring(0, 8)}...{feedback.txHash.substring(feedback.txHash.length - 6)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            {feedback.onAction && feedback.actionLabel && (
              <button
                onClick={() => {
                  feedback.onAction?.();
                  onClose();
                }}
                className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition active:scale-95 ${
                  isSuccess
                    ? 'bg-[#F3BA2F] hover:bg-[#e2ad23] text-black shadow-[#F3BA2F]/20'
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                }`}
              >
                {!isSuccess && <RotateCcw className="w-4 h-4" />}
                <span>{feedback.actionLabel}</span>
                {isSuccess && <ArrowRight className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full sm:w-auto flex-1 py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm border border-white/10 transition active:scale-95"
            >
              {isSuccess ? 'Dismiss' : 'Close'}
            </button>
          </div>

          {/* Auto-dismiss progress indicator for success */}
          {isSuccess && (feedback.autoCloseMs ?? 5000) > 0 && (
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: (feedback.autoCloseMs ?? 5000) / 1000, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-[#F3BA2F]"
            />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
