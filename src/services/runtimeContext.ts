import { useState, useEffect } from 'react';

export interface TelegramUser {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}

export interface RuntimeContextInfo {
  /**
   * Strictly detects Telegram Mini App execution by checking
   * if window.Telegram?.WebApp?.initData exists and is non-empty.
   */
  isTelegram: boolean;
  hasInjectedEthereum: boolean;
  isWeb3Browser: boolean;
  detectedWalletName: string | null;
  telegramUser: TelegramUser | null;
  mode: 'telegram_mini_app' | 'native_dapp_browser';
  rawInitData: string;
}

/**
 * Returns true if running inside Telegram Mini App webview
 * Rule: window.Telegram?.WebApp?.initData exists and is non-empty
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === 'string' && initData.trim().length > 0;
}

/**
 * Returns true if any Web3 provider is injected (MetaMask, Trust, OKX, TokenPocket, Binance, SafePal, etc.)
 */
export function hasInjectedEthereum(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(
    w.ethereum ||
    w.tokenpocket ||
    w.trustwallet ||
    w.okxwallet ||
    w.BinanceChain ||
    w.bitkeep ||
    w.safepalProvider ||
    w.coinbaseWalletExtension ||
    w.phantom?.ethereum
  );
}

/**
 * Get the name of the detected Web3 wallet if available (general for all wallets)
 */
export function getDetectedWeb3WalletName(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const eth = w.ethereum;

  // Specific wallet identification (checked prior to isMetaMask to prevent false-positive MetaMask naming)
  if (w.tokenpocket || eth?.isTokenPocket) return 'TokenPocket';
  if (w.trustwallet || eth?.isTrust || eth?.isTrustWallet) return 'Trust Wallet';
  if (w.okxwallet || eth?.isOkxWallet || eth?.isOKExWallet) return 'OKX Wallet';
  if (w.BinanceChain || eth?.isBinance || eth?.isBscStorage) return 'Binance Web3 Wallet';
  if (eth?.isRabby) return 'Rabby Wallet';
  if (eth?.isSafePal || w.safepalProvider) return 'SafePal';
  if (w.bitkeep || eth?.isBitKeep || eth?.isBitget) return 'Bitget Wallet';
  if (w.coinbaseWalletExtension || eth?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (eth?.isRainbow) return 'Rainbow';
  if (eth?.isBraveWallet) return 'Brave Wallet';
  if (w.phantom?.ethereum || eth?.isPhantom) return 'Phantom EVM';
  if (eth?.isMetaMask) return 'MetaMask';
  if (eth || w.tokenpocket || w.trustwallet || w.okxwallet) return 'Web3 Injected Provider';
  return null;
}

/**
 * Get Telegram user information if available
 */
export function getTelegramUserInfo(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user || null;
}

/**
 * Detect full runtime environment information
 */
export function detectRuntimeContext(): RuntimeContextInfo {
  const isTg = isTelegramMiniApp();
  const hasEth = hasInjectedEthereum();
  const walletName = getDetectedWeb3WalletName();
  const tgUser = getTelegramUserInfo();
  const rawInitData = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';

  return {
    isTelegram: isTg,
    hasInjectedEthereum: hasEth,
    isWeb3Browser: hasEth,
    detectedWalletName: walletName,
    telegramUser: tgUser,
    mode: isTg ? 'telegram_mini_app' : 'native_dapp_browser',
    rawInitData,
  };
}

/**
 * React hook to reactively track runtime context
 */
export function useRuntimeContext(): RuntimeContextInfo {
  const [context, setContext] = useState<RuntimeContextInfo>(() => detectRuntimeContext());

  useEffect(() => {
    // Re-evaluate on mount (in case Telegram WebApp script finished loading)
    setContext(detectRuntimeContext());

    const handleCheck = () => {
      setContext(detectRuntimeContext());
    };

    window.addEventListener('focus', handleCheck);
    return () => {
      window.removeEventListener('focus', handleCheck);
    };
  }, []);

  return context;
}
