import confetti from 'canvas-confetti';

/**
 * Binance Smart Chain & Golden Harvest Color Palette
 */
export const BSC_CONFETTI_COLORS = [
  '#F3BA2F', // Binance Signature Gold
  '#F0B90B', // BSC BNB Primary Yellow
  '#FCD535', // Highlight Lemon Gold
  '#00C087', // BSC Mainnet Emerald
  '#10B981', // Mint Green
  '#FFFFFF', // Diamond White Sparkle
  '#FFA000', // Deep Amber
];

/**
 * Daily Streak Fiery Gold Palette
 */
export const STREAK_CONFETTI_COLORS = [
  '#F3BA2F',
  '#F97316', // Fiery Orange
  '#EF4444', // Flame Red
  '#FBBF24', // Warm Amber
  '#FFFFFF',
];

/**
 * Triggers a multi-stage celebratory confetti explosion when mining rewards are claimed.
 * 1. Dual-side cannons from bottom left & right aiming inward
 * 2. Center fountain explosion with realistic physics
 * 3. High-altitude lingering sparkle shower
 */
export function triggerMiningRewardConfetti() {
  if (typeof window === 'undefined') return;

  const baseConfig = {
    colors: BSC_CONFETTI_COLORS,
    zIndex: 999999, // Ensure visible above glass modals and overlays
    disableForReducedMotion: false,
  };

  try {
    // 1. Dual side corner cannons
    confetti({
      ...baseConfig,
      particleCount: 45,
      angle: 60,
      spread: 55,
      startVelocity: 50,
      origin: { x: 0.05, y: 0.85 },
    });

    confetti({
      ...baseConfig,
      particleCount: 45,
      angle: 120,
      spread: 55,
      startVelocity: 50,
      origin: { x: 0.95, y: 0.85 },
    });
  } catch (err) {
    console.warn('Corner confetti launch error:', err);
  }

  // 2. Center multi-tier fountain burst
  setTimeout(() => {
    try {
      const count = 160;
      const fireTier = (ratio: number, opts: confetti.Options) => {
        confetti({
          ...baseConfig,
          ...opts,
          origin: { x: 0.5, y: 0.65 },
          particleCount: Math.floor(count * ratio),
        });
      };

      fireTier(0.25, { spread: 35, startVelocity: 45 });
      fireTier(0.2, { spread: 60, startVelocity: 40 });
      fireTier(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
      fireTier(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fireTier(0.1, { spread: 130, startVelocity: 48 });
    } catch (err) {
      console.warn('Center confetti burst error:', err);
    }
  }, 160);

  // 3. Gentle golden descent shower
  setTimeout(() => {
    try {
      confetti({
        ...baseConfig,
        particleCount: 40,
        spread: 90,
        origin: { x: 0.5, y: 0.35 },
        scalar: 1.1,
        ticks: 240,
        gravity: 0.7,
      });
    } catch (err) {
      console.warn('Shower confetti error:', err);
    }
  }, 420);
}

/**
 * Triggers celebratory confetti for daily login streak claims
 */
export function triggerStreakRewardConfetti() {
  if (typeof window === 'undefined') return;

  try {
    confetti({
      particleCount: 80,
      spread: 75,
      origin: { y: 0.6 },
      colors: STREAK_CONFETTI_COLORS,
      zIndex: 999999,
    });
  } catch (err) {
    console.warn('Streak confetti error:', err);
  }
}

/**
 * Triggers a flexible custom confetti burst
 */
export function triggerCustomConfetti(options?: confetti.Options) {
  if (typeof window === 'undefined') return;

  try {
    confetti({
      colors: BSC_CONFETTI_COLORS,
      zIndex: 999999,
      ...options,
    });
  } catch (err) {
    console.warn('Custom confetti error:', err);
  }
}

export default triggerMiningRewardConfetti;
